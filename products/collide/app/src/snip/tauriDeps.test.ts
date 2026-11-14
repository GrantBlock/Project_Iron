import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (e: { payload: unknown }) => void>();
const emitted: [string, unknown][] = [];
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, h: (e: { payload: unknown }) => void) => {
    handlers.set(name, h);
    return () => handlers.delete(name);
  }),
  emit: vi.fn(async (name: string, payload?: unknown) => void emitted.push([name, payload])),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { tauriDeps } from "./tauriDeps";

const fire = (name: string, payload: unknown) => handlers.get(name)?.({ payload });
const deps = () => tauriDeps({ openImage: vi.fn(), notify: vi.fn() });

beforeEach(() => {
  handlers.clear();
  emitted.length = 0;
});

describe("tauriDeps snipId filtering", () => {
  it("sendFrame resolves only on the ack for its own snipId", async () => {
    const p = deps().sendFrame("png", 1, 10, 10, 2);
    let done = false;
    void p.then(() => (done = true));
    await vi.waitFor(() => expect(emitted.some(([n]) => n === "collide:overlay-frame")).toBe(true));
    expect(emitted.find(([n]) => n === "collide:overlay-frame")![1]).toMatchObject({ snipId: 2 });
    fire("collide:overlay-frame-ack", { snipId: 1 }); // stale
    fire("collide:overlay-frame-ack", {}); // id-less
    await new Promise((r) => setTimeout(r, 5));
    expect(done).toBe(false);
    fire("collide:overlay-frame-ack", { snipId: 2 });
    await p;
    expect(done).toBe(true);
  });

  it("waitForOverlayResult ignores stale and id-less results", async () => {
    const p = deps().waitForOverlayResult(5);
    await vi.waitFor(() => expect(handlers.has("collide:overlay-result")).toBe(true));
    fire("collide:overlay-result", { kind: "cancel", snipId: 4 });
    fire("collide:overlay-result", { kind: "cancel" });
    fire("collide:overlay-result", { kind: "crop", box: { x: 1, y: 1, w: 2, h: 2 }, scale: 1, snipId: 5 });
    await expect(p).resolves.toMatchObject({ kind: "crop", snipId: 5 });
  });
});
