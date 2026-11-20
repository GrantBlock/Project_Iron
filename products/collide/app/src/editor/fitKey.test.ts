import { describe, expect, it } from "vitest";
import { isFitKey } from "./fitKey";
import { TOOL_KEYS } from "./tools";

const press = (init: KeyboardEventInit, target?: HTMLElement) => {
  const e = new KeyboardEvent("keydown", { bubbles: true, ...init });
  if (target) Object.defineProperty(e, "target", { value: target });
  return e;
};

describe("the F key fits (T48)", () => {
  it("F is not a tool hotkey", () => {
    expect(TOOL_KEYS.f).toBeUndefined();
  });

  it("plain F (or Shift+F) on the page fits; with Ctrl, Alt or Meta it does not", () => {
    expect(isFitKey(press({ key: "f" }, document.body))).toBe(true);
    expect(isFitKey(press({ key: "F", shiftKey: true }, document.body))).toBe(true);
    expect(isFitKey(press({ key: "f", ctrlKey: true }, document.body))).toBe(false);
    expect(isFitKey(press({ key: "f", altKey: true }, document.body))).toBe(false);
    expect(isFitKey(press({ key: "f", metaKey: true }, document.body))).toBe(false);
    expect(isFitKey(press({ key: "g" }, document.body))).toBe(false);
    expect(isFitKey(press({ key: "0" }, document.body))).toBe(false);
  });

  it("not while typing: inputs, text areas, selects and contentEditable", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.append(editable);
    for (const el of [document.createElement("input"), document.createElement("textarea"), document.createElement("select"), editable]) {
      expect(isFitKey(press({ key: "f" }, el))).toBe(false);
    }
    editable.remove();
  });
});
