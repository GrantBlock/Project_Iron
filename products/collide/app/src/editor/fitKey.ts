// T48 (Grant 2026-11-20): the plain F key fits the canvas, like Ctrl+0 (which stays). F is not a tool key (TOOL_KEYS).
// It counts with or without Shift (Caps Lock gives "F"), never with Ctrl, Alt or Meta, and never while typing:
// in an input, a textarea, a select or anything contentEditable (a descendant of one included). Shortcuts stay
// provisional until the accessibility spec (ISSUES 10).

export interface FitKeyEvent {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
}

/** True when the key goes into text: inputs, textareas, selects and contentEditable content. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  if (target.closest("input, textarea, select")) return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  // jsdom has no isContentEditable: the nearest contenteditable attribute decides ("false" switches it off).
  const host = target.closest("[contenteditable]");
  return !!host && host.getAttribute("contenteditable")?.toLowerCase() !== "false";
}

/** The plain F key, outside text fields: fit the canvas. */
export function isFitKey(e: FitKeyEvent): boolean {
  if (e.key !== "f" && e.key !== "F") return false;
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  return !isTypingTarget(e.target);
}
