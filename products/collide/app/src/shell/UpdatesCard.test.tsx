// Settings → Updates (Grant 2026-11-17).
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { UpdatesCard, updateLine } from "./UpdatesCard";
import type { UpdateStatus } from "../native/bridge";

afterEach(cleanup);
const base: UpdateStatus = { state: "idle", current: "0.1.0", version: null, percent: null, message: null, auto: true, lastChecked: null };

function fakeBridge(start: UpdateStatus) {
  let cb: ((s: UpdateStatus) => void) | null = null;
  const updates = {
    status: vi.fn(async () => start),
    check: vi.fn(async () => start),
    install: vi.fn(async () => undefined),
    setAuto: vi.fn(async (on: boolean) => ({ ...start, auto: on })),
    onStatus: (f: (s: UpdateStatus) => void) => ((cb = f), () => (cb = null)),
  };
  return { bridge: { updates }, updates, push: (s: UpdateStatus) => act(() => cb?.(s)) };
}

describe("updateLine", () => {
  it("says what is happening and what to do", () => {
    expect(updateLine({ ...base, state: "none" })).toBe("Collide 0.1.0 is the newest version.");
    expect(updateLine({ ...base, state: "downloading", version: "0.2.0", percent: 40 })).toBe("Downloading Collide 0.2.0 · 40%…");
    expect(updateLine({ ...base, state: "ready", version: "0.2.0" })).toMatch(/^Collide 0.2.0 is ready/);
    expect(updateLine({ ...base, state: "unsupported", message: "The portable Collide cannot update itself." })).toMatch(/portable/);
    expect(updateLine({ ...base, auto: false })).toMatch(/off/);
  });
});

describe("UpdatesCard", () => {
  it("in a browser: says updates are for the installed app", () => {
    const r = render(<UpdatesCard bridge={undefined} />);
    expect(r.getByText("Updates work in the installed Collide app.")).toBeTruthy();
  });

  it("shows the version; Check now; a ready update offers Restart to update; the toggle saves", async () => {
    const f = fakeBridge(base);
    const r = render(<UpdatesCard bridge={f.bridge} />);
    expect((await r.findByTestId("update-version")).textContent).toBe("Version 0.1.0");
    fireEvent.click(r.getByText("Check now"));
    expect(f.updates.check).toHaveBeenCalled();
    f.push({ ...base, state: "ready", version: "0.2.0" });
    fireEvent.click(r.getByText("Restart to update"));
    expect(f.updates.install).toHaveBeenCalled();
    fireEvent.click(r.getByLabelText(/Check for updates automatically/));
    expect(f.updates.setAuto).toHaveBeenCalledWith(false);
  });

  it("a copy that cannot update: the reason, no buttons", async () => {
    const f = fakeBridge({ ...base, state: "unsupported", message: "The portable Collide cannot update itself." });
    const r = render(<UpdatesCard bridge={f.bridge} />);
    expect((await r.findByTestId("update-line")).textContent).toMatch(/portable/);
    expect(r.queryByText("Check now")).toBeNull();
  });
});
