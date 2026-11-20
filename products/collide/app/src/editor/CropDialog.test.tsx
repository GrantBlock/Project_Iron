// T39: Crop's drag rules and the dialog's keys.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

afterEach(cleanup);
import { CropDialog, dragCrop, MIN_CROP } from "./CropDialog";

describe("T39 dragCrop", () => {
  const o = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
  it("move stays inside the image", () => {
    expect(dragCrop("move", o, { x: 0.3, y: 0.3 }, { x: 0.9, y: 0.0 })).toEqual({ x: 0.6, y: 0, w: 0.4, h: 0.4 });
  });
  it("a corner resizes and the opposite corner stays", () => {
    const r = dragCrop("se", o, { x: 0.6, y: 0.6 }, { x: 0.5, y: 0.7 });
    expect(r.x).toBe(0.2);
    expect(r.y).toBe(0.2);
    expect(r.w).toBeCloseTo(0.3);
    expect(r.h).toBeCloseTo(0.5);
  });
  it("a corner never makes the crop smaller than the minimum", () => {
    expect(dragCrop("nw", o, { x: 0.2, y: 0.2 }, { x: 0.9, y: 0.9 }).w).toBeCloseTo(MIN_CROP);
  });
  it("outside: a new box from the press to the pointer", () => {
    const r = dragCrop("new", o, { x: 0.8, y: 0.1 }, { x: 0.7, y: 0.3 });
    expect(r.x).toBeCloseTo(0.7);
    expect(r.y).toBeCloseTo(0.1);
    expect(r.w).toBeCloseTo(0.1);
    expect(r.h).toBeCloseTo(0.2);
  });
});

describe("T39 CropDialog", () => {
  const props = () => ({ src: "data:image/png;base64,AA", file: { width: 1280, height: 720 }, crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, onApply: vi.fn(), onCancel: vi.fn() });
  it("shows the kept size, Enter applies the crop, Esc cancels", () => {
    const p = props();
    const r = render(<CropDialog {...p} />);
    expect(r.getByTestId("crop-size").textContent).toBe("640 × 360 of 1280 × 720");
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(p.onApply).toHaveBeenCalledWith(p.crop);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(p.onCancel).toHaveBeenCalled();
  });
  it("Reset goes back to the whole image", () => {
    const p = props();
    const r = render(<CropDialog {...p} />);
    fireEvent.click(r.getByText("Reset"));
    expect(r.getByTestId("crop-size").textContent).toBe("1280 × 720 of 1280 × 720");
  });
});
