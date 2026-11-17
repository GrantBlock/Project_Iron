// T14: electron/preload.cjs, run against a fake `electron` module. A sandboxed
// preload cannot import bridge.ts, so this test is what keeps the two in step.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { BRIDGE_KEYS, INVOKE_CHANNELS, OVERLAY_EVENT_CHANNEL, OVERLAY_EVENTS, SNIP_REQUEST_CHANNEL, type CollideBridge, type InvokeMethod, type IpcReply } from "./bridge";

const source = readFileSync(resolve(process.cwd(), "electron/preload.cjs"), "utf8");

type Listener = (event: unknown, ...args: unknown[]) => void;

function loadPreload(answer: (channel: string, args: unknown[]) => IpcReply | undefined = () => ({ ok: true, value: undefined })) {
  const exposed: Record<string, unknown> = {};
  const invoked: [string, ...unknown[]][] = [];
  const sent: [string, ...unknown[]][] = [];
  const listeners = new Map<string, Set<Listener>>();
  const required: string[] = [];
  const electron = {
    contextBridge: { exposeInMainWorld: (key: string, api: unknown) => void (exposed[key] = api) },
    ipcRenderer: {
      invoke: async (channel: string, ...args: unknown[]) => {
        invoked.push([channel, ...args]);
        return answer(channel, args);
      },
      send: (channel: string, ...args: unknown[]) => void sent.push([channel, ...args]),
      on: (channel: string, l: Listener) => void (listeners.get(channel) ?? listeners.set(channel, new Set()).get(channel)!).add(l),
      removeListener: (channel: string, l: Listener) => void listeners.get(channel)?.delete(l),
    },
  };
  const fakeRequire = (id: string) => {
    required.push(id);
    if (id !== "electron") throw new Error(`a sandboxed preload cannot require ${id}`);
    return electron;
  };
  new Function("require", source)(fakeRequire);
  const fire = (channel: string, ...args: unknown[]) => listeners.get(channel)?.forEach((l) => l({ sender: "ipc" }, ...args));
  const count = (channel: string) => listeners.get(channel)?.size ?? 0;
  return { exposed, collide: exposed.collide as CollideBridge, invoked, sent, fire, count, required };
}

/** Call a bridge method by its "a.b" name. */
function method(collide: CollideBridge, name: InvokeMethod): (...args: unknown[]) => Promise<unknown> {
  const target = name.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], collide);
  return target as (...args: unknown[]) => Promise<unknown>;
}

describe("electron/preload.cjs", () => {
  it("exposes window.collide with exactly the bridge's keys, and nothing else", () => {
    const { exposed, collide, required } = loadPreload();
    expect(Object.keys(exposed)).toEqual(["collide"]);
    expect(Object.keys(collide).sort()).toEqual([...BRIDGE_KEYS]);
    expect(Object.keys(collide.markups).sort()).toEqual(["list", "open", "pick", "remove", "save"]);
    expect(Object.keys(collide.collideFiles).sort()).toEqual(["open", "pick", "save"]);
    expect(Object.keys(collide.overlay).sort()).toEqual(["emit", "on"]);
    expect(required).toEqual(["electron"]);
  });

  it("every invoke method calls its own channel with its arguments and resolves with the value", async () => {
    const { collide, invoked } = loadPreload((channel) => ({ ok: true, value: `value of ${channel}` }));
    const args: Partial<Record<InvokeMethod, unknown[]>> = {
      cropCapture: [{ x: 1, y: 2, w: 3, h: 4 }, 1.5],
      showOverlay: [{ x: -1920, y: 0, width: 1920, height: 1080 }],
      copyImage: ["data:image/png;base64,AAAA"],
      collapse: [{ collapsed: true, canvas: false }],
      "markups.save": ["2026-11-15_snip", { annotations: "{}" }],
      "markups.open": ["folder"],
      "markups.remove": ["folder"],
      "collideFiles.save": ["line-3.collide", new Uint8Array([0x50, 0x4b]), false],
      "collideFiles.open": ["line-3.collide"],
    };
    for (const name of Object.keys(INVOKE_CHANNELS) as InvokeMethod[]) {
      invoked.length = 0;
      const sentArgs = args[name] ?? [];
      await expect(method(collide, name)(...sentArgs)).resolves.toBe(`value of ${INVOKE_CHANNELS[name]}`);
      expect(invoked, name).toEqual([[INVOKE_CHANNELS[name], ...sentArgs]]);
    }
  });

  it("a failure reply rejects with the main process's message, unchanged", async () => {
    const { collide } = loadPreload(() => ({ ok: false, error: "No capture to crop — start a new snip." }));
    const err = await collide.cropCapture({ x: 0, y: 0, w: 1, h: 1 }, 1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("No capture to crop — start a new snip.");
    const silent = loadPreload(() => undefined);
    await expect(silent.collide.captureMonitor()).rejects.toThrow("did not answer — restart Collide");
  });

  it("overlay events: only the five known names, delivered to their own listeners until unsubscribed", () => {
    const { collide, sent, fire, count } = loadPreload();
    for (const name of OVERLAY_EVENTS) collide.overlay.emit(name, { snipId: 1 });
    expect(sent).toEqual(OVERLAY_EVENTS.map((name) => [OVERLAY_EVENT_CHANNEL, name, { snipId: 1 }]));
    expect(() => collide.overlay.emit("collide:capture-monitor" as never)).toThrow("Unknown overlay event");
    expect(() => collide.overlay.on("anything" as never, () => undefined)).toThrow("Unknown overlay event");
    expect(sent).toHaveLength(OVERLAY_EVENTS.length);

    const onFrame = vi.fn();
    const onResult = vi.fn();
    const offFrame = collide.overlay.on("collide:overlay-frame", onFrame);
    collide.overlay.on("collide:overlay-result", onResult);
    fire(OVERLAY_EVENT_CHANNEL, "collide:overlay-frame", { png: "p", snipId: 2 });
    expect(onFrame.mock.calls).toEqual([[{ png: "p", snipId: 2 }]]); // the payload only, never the IPC event
    expect(onResult).not.toHaveBeenCalled();
    offFrame();
    fire(OVERLAY_EVENT_CHANNEL, "collide:overlay-frame", {});
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(count(OVERLAY_EVENT_CHANNEL)).toBe(1);
  });

  it("onSnipRequest calls back with no arguments until unsubscribed", () => {
    const { collide, fire, count } = loadPreload();
    const cb = vi.fn();
    const off = collide.onSnipRequest(cb);
    fire(SNIP_REQUEST_CHANNEL, "ignored");
    expect(cb.mock.calls).toEqual([[]]);
    off();
    fire(SNIP_REQUEST_CHANNEL);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(count(SNIP_REQUEST_CHANNEL)).toBe(0);
  });
});
