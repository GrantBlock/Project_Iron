import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRIDGE_KEYS } from "../renderer/bridge";

// Runs electron/preload.cjs with a fake `electron` and a sandbox-like `process`.
function runPreload() {
  const source = readFileSync(new URL("../../electron/preload.cjs", import.meta.url), "utf8");
  const exposed: Record<string, unknown> = {};
  const required: string[] = [];
  const fakeRequire = (name: string) => {
    required.push(name);
    if (name !== "electron") throw new Error(`a sandboxed preload cannot require ${name}`);
    return {
      contextBridge: { exposeInMainWorld: (key: string, api: unknown) => (exposed[key] = api) },
      ipcRenderer: { invoke: (channel: string, ...args: unknown[]) => Promise.resolve({ channel, args }) },
    };
  };
  const fakeProcess = { platform: "win32", versions: { electron: "33.4.11", chrome: "130.0.0.0", node: "20.18.1" } };
  new Function("require", "process", source)(fakeRequire, fakeProcess);
  return { exposed, required };
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

  it("openFolder and readFile are the only calls, each one IPC channel; the path goes as a string", async () => {
    const lite = runPreload().exposed.lite as { openFolder(): Promise<unknown>; readFile(p: unknown): Promise<unknown> };
    expect(await lite.openFolder()).toEqual({ channel: "lite:open-folder", args: [] });
    expect(await lite.readFile("a/b.txt")).toEqual({ channel: "lite:read-file", args: ["a/b.txt"] });
    expect(await lite.readFile({ toString: () => "x" })).toEqual({ channel: "lite:read-file", args: ["x"] });
  });
});
