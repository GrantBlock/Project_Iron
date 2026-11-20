// T48 (Grant 2026-11-20): the plain F key fits the canvas, like Ctrl+0. This is the pure test of which key events count.
// Written before the code (Lydia, tests first): `src/editor/fitKey.ts` exports `isFitKey(e)`.
import { describe, expect, it } from "vitest";
import { isFitKey } from "./fitKey";
import { TOOL_KEYS } from "./tools";

type Init = { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; shiftKey?: boolean };
const press = (init: Init, target: Element | null = document.body) => ({ ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...init, target });

describe("the F key fits (T48)", () => {
  it("F is not already a tool hotkey", () => {
    expect(TOOL_KEYS.f).toBeUndefined();
    expect(TOOL_KEYS.F).toBeUndefined();
  });

  it("plain F (also with Caps Lock or Shift: key 'F') counts", () => {
    expect(isFitKey(press({ key: "f" }))).toBe(true);
    expect(isFitKey(press({ key: "F" }))).toBe(true);
    expect(isFitKey(press({ key: "F", shiftKey: true }))).toBe(true);
  });

  it("with Ctrl, Alt or Meta it does not", () => {
    for (const mod of ["ctrlKey", "altKey", "metaKey"] as const) {
      expect(isFitKey(press({ key: "f", [mod]: true }))).toBe(false);
    }
  });

  it("other keys do not", () => {
    for (const key of ["g", "0", "Escape", "Enter", " ", "ff", ""]) expect(isFitKey(press({ key }))).toBe(false);
  });

  it("never while typing: input, textarea, select and contentEditable", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const plain = document.createElement("div");
    plain.setAttribute("contenteditable", "plaintext-only");
    const inner = document.createElement("span");
    editable.append(inner);
    document.body.append(editable, plain);
    const targets = [document.createElement("input"), document.createElement("textarea"), document.createElement("select"), editable, plain, inner];
    for (const el of targets) expect(isFitKey(press({ key: "f" }, el))).toBe(false);
    editable.remove();
    plain.remove();
  });

  it("buttons, the canvas and the page body are not typing", () => {
    const button = document.createElement("button");
    const canvas = document.createElement("canvas");
    const off = document.createElement("div");
    off.setAttribute("contenteditable", "false");
    for (const el of [button, canvas, off, document.body]) expect(isFitKey(press({ key: "f" }, el))).toBe(true);
  });

  it("a missing target is not typing; a real KeyboardEvent works too", () => {
    expect(isFitKey(press({ key: "f" }, null))).toBe(true);
    const e = new KeyboardEvent("keydown", { key: "f", bubbles: true });
    document.body.dispatchEvent(e);
    expect(isFitKey(e)).toBe(true);
    const input = document.createElement("input");
    document.body.append(input);
    let seen: boolean | null = null;
    input.addEventListener("keydown", (ev) => (seen = isFitKey(ev)));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "f", bubbles: true }));
    expect(seen).toBe(false);
    input.remove();
  });
});
