// T42 (1.1): the starting crosshair. Before the press it marks the pointer with a light core and a dark outline;
// once the drag starts it goes and the drag box is drawn exactly as before.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CROSSHAIR } from "./crosshair";
import { Overlay } from "./Overlay";

beforeAll(() => {
  // jsdom has no pointer capture.
  HTMLElement.prototype.setPointerCapture ??= () => undefined;
  // jsdom lays nothing out: the overlay is an 800 x 600 screen at the origin.
  HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}) });
});
afterEach(cleanup);

const mount = () => {
  const onResult = vi.fn();
  render(<Overlay frame="data:image/png;base64," scale={1} onResult={onResult} />);
  return { root: screen.getByTestId("overlay"), onResult };
};
const at = (x: number, y: number, button = 0) => ({ clientX: x, clientY: y, button, pointerId: 1 });

describe("T42 starting crosshair", () => {
  it("is not drawn until the pointer is over the overlay; the system crosshair shows meanwhile", () => {
    const { root } = mount();
    expect(screen.queryByTestId("overlay-crosshair")).toBeNull();
    expect(root.style.cursor).toBe("crosshair");
  });

  it("follows the pointer before the press, centred on it, with a light core and a dark outline from the tokens", () => {
    const { root } = mount();
    act(() => void fireEvent.pointerMove(root, at(150, 120)));
    const cross = screen.getByTestId("overlay-crosshair");
    expect(cross.style.left).toBe("150px");
    expect(cross.style.top).toBe("120px");
    const bars = cross.querySelectorAll<HTMLElement>("[data-part=bar]");
    expect(bars).toHaveLength(2);
    for (const bar of bars) {
      expect(bar.style.background).toBe(CROSSHAIR.core);
      expect(bar.style.boxShadow).toContain(CROSSHAIR.outline);
    }
    expect(CROSSHAIR.core).toMatch(/^var\(--[\w-]+\)$/);
    expect(CROSSHAIR.outline).toMatch(/^var\(--[\w-]+\)$/);
    // Our crosshair replaces the thin system one while it is drawn; it never takes the pointer.
    expect(root.style.cursor).toBe("none");
    expect(cross.style.pointerEvents).toBe("none");

    act(() => void fireEvent.pointerMove(root, at(30, 40)));
    expect(screen.getByTestId("overlay-crosshair").style.left).toBe("30px");
    expect(screen.getByTestId("overlay-crosshair").style.top).toBe("40px");
  });

  it("goes when the drag starts; the drag box and cursor are as before", () => {
    const { root } = mount();
    act(() => void fireEvent.pointerMove(root, at(100, 80)));
    act(() => void fireEvent.pointerDown(root, at(100, 80)));
    act(() => void fireEvent.pointerMove(root, at(220, 180)));
    expect(screen.queryByTestId("overlay-crosshair")).toBeNull();
    expect(root.style.cursor).toBe("crosshair");
    const sel = screen.getByTestId("overlay-selection");
    expect(sel.style.outline).toBe("1px dashed var(--line-dashed)");
    expect(sel.style.boxShadow).toBe("0 0 0 100vmax color-mix(in srgb, var(--ink-975) 50%, transparent)");
    expect([sel.style.left, sel.style.top, sel.style.width, sel.style.height]).toEqual(["100px", "80px", "120px", "100px"]);
    const handles = sel.querySelectorAll<HTMLElement>("span");
    expect(handles).toHaveLength(4);
    for (const h of handles) expect(h.style.background).toBe("var(--ink-50)");
  });

  it("comes back after a plain click (no box) and hides when the pointer leaves", () => {
    const { root, onResult } = mount();
    act(() => void fireEvent.pointerMove(root, at(60, 60)));
    act(() => void fireEvent.pointerDown(root, at(60, 60)));
    act(() => void fireEvent.pointerUp(root, at(60, 60)));
    expect(onResult).not.toHaveBeenCalled();
    expect(screen.getByTestId("overlay-crosshair").style.left).toBe("60px");
    act(() => void fireEvent.pointerLeave(root, at(-1, -1)));
    expect(screen.queryByTestId("overlay-crosshair")).toBeNull();
  });
});
