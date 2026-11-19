import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRIDGE_KEYS } from "../renderer/bridge";

// Runs electron/preload.cjs with a fake `electron` and a sandbox-like `process`.
function runPreload() {
  const sent: unknown[][] = [];
  const handlers: Record<string, (event: unknown, ...args: unknown[]) => void> = {};
  const source = readFileSync(new URL("../../electron/preload.cjs", import.meta.url), "utf8");
  const exposed: Record<string, unknown> = {};
  const required: string[] = [];
  const fakeRequire = (name: string) => {
    required.push(name);
    if (name !== "electron") throw new Error(`a sandboxed preload cannot require ${name}`);
    return {
      contextBridge: { exposeInMainWorld: (key: string, api: unknown) => (exposed[key] = api) },
      ipcRenderer: {
        invoke: (channel: string, ...args: unknown[]) => Promise.resolve({ channel, args }),
        send: (channel: string, ...args: unknown[]) => sent.push([channel, ...args]),
        on: (channel: string, handler: (event: unknown, ...args: unknown[]) => void) => (handlers[channel] = handler),
      },
    };
  };
  const fakeProcess = { platform: "win32", versions: { electron: "33.4.11", chrome: "130.0.0.0", node: "20.18.1" } };
  new Function("require", "process", source)(fakeRequire, fakeProcess);
  return { exposed, required, sent, handlers };
}

describe("preload", () => {
  it("requires only electron and exposes exactly window.lite with the bridge keys", () => {
    const { exposed, required } = runPreload();
    expect(required).toEqual(["electron"]);
    expect(Object.keys(exposed)).toEqual(["lite"]);
    const lite = exposed.lite as Record<string, unknown>;
    expect(Object.keys(lite).sort()).toEqual([...BRIDGE_KEYS]);
    expect(lite).toMatchObject({ desktop: true, platform: "win32", versions: { electron: "33.4.11", chrome: "130.0.0.0" } });
    expect(Object.isFrozen(lite)).toBe(true);
  });

  it("window buttons: three actions on one channel; the maximized state comes back as a boolean only", () => {
    const { exposed, sent, handlers } = runPreload();
    const lite = exposed.lite as { minimize(): void; toggleMaximize(): void; close(): void; onMaximizedChange(l: unknown): () => void };
    lite.minimize();
    lite.toggleMaximize();
    lite.close();
    expect(sent).toEqual([["lite:window", "minimize"], ["lite:window", "toggle-maximize"], ["lite:window", "close"]]);
    expect(Object.keys(handlers)).toEqual(["lite:maximized"]);

    const seen: unknown[][] = [];
    const off = lite.onMaximizedChange((...args: unknown[]) => seen.push(args));
    expect(seen).toEqual([[false]]); // the current state at once
    handlers["lite:maximized"]({ sender: "ipc event, not passed on" }, true);
    handlers["lite:maximized"]({}, "yes"); // anything but true is false
    off();
    handlers["lite:maximized"]({}, true);
    expect(seen).toEqual([[false], [true], [false]]);
    // A late subscriber gets the last state.
    const late: unknown[] = [];
    lite.onMaximizedChange((v: unknown) => late.push(v));
    expect(late).toEqual([true]);
    expect(typeof lite.onMaximizedChange("not a function")).toBe("function");
  });

  it("openFolder and readFile are the folder calls, each one IPC channel; the path goes as a string", async () => {
    const lite = runPreload().exposed.lite as { openFolder(): Promise<unknown>; readFile(p: unknown): Promise<unknown> };
    expect(await lite.openFolder()).toEqual({ channel: "lite:open-folder", args: [] });
    expect(await lite.readFile("a/b.txt")).toEqual({ channel: "lite:read-file", args: ["a/b.txt"] });
    expect(await lite.readFile({ toString: () => "x" })).toEqual({ channel: "lite:read-file", args: ["x"] });
  });
});
