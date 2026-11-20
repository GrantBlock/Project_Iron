// T44 (5.1): the Connected pill's light. (A, ISSUES 44) "server reached" = the address saved in Settings answers.
import { describe, expect, it, vi } from "vitest";
import { checkServer, serverUrl } from "./connected";

describe("serverUrl (T44)", () => {
  it("no address gives no URL", () => {
    expect(serverUrl("")).toBeNull();
    expect(serverUrl("   ")).toBeNull();
  });
  it("an address without a scheme is http; http and https are kept", () => {
    expect(serverUrl("server-pc:3500")).toBe("http://server-pc:3500/");
    expect(serverUrl(" http://server-pc:3500 ")).toBe("http://server-pc:3500/");
    expect(serverUrl("https://server-pc")).toBe("https://server-pc/");
  });
  it("anything that is not an http address gives no URL", () => {
    expect(serverUrl("file:///c:/x")).toBeNull();
    expect(serverUrl("javascript:alert(1)")).toBeNull();
    expect(serverUrl("http://")).toBeNull();
  });
});

describe("checkServer (T44)", () => {
  it("no address: off, and nothing is asked", async () => {
    const f = vi.fn();
    expect(await checkServer("", { fetch: f })).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("any answer from the address: reached", async () => {
    const f = vi.fn<(url: string) => Promise<Response>>(async () => new Response(null, { status: 404 }));
    expect(await checkServer("server-pc:3500", { fetch: f })).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe("http://server-pc:3500/");
  });
  it("no answer (a network error): off", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await checkServer("server-pc:3500", { fetch: f })).toBe(false);
  });
  it("no answer in time: off", async () => {
    vi.useFakeTimers();
    try {
      const f = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
      const r = checkServer("server-pc:3500", { fetch: f, timeoutMs: 3000 });
      await vi.advanceTimersByTimeAsync(3000);
      expect(await r).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
