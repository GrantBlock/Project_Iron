// T48 (Grant 2026-11-20): the plain F key fits the canvas, like Ctrl+0 (kept). Shortcuts stay provisional (ISSUES 10).
// Shared by the Snip, Markdown and PDF editors.

/** True while the target takes typed text: an input, a text area, a select or anything contentEditable (a note being edited). */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable) return true;
  // jsdom has no isContentEditable.
  return !!t.closest('[contenteditable]:not([contenteditable="false"])');
}

/** F (Shift allowed), with no Ctrl, Alt or Meta, while not typing. */
export function isFitKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (e.key.toLowerCase() !== "f") return false;
  return !isTypingTarget(e.target);
}

/** T48: collapsed, the workspace is hidden (the compact view); the editor in it takes no keys. */
export function workspaceHidden(): boolean {
  return !!document.querySelector('section.ws[hidden]');
}
