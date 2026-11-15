import { ElectronMarkupStore } from "./electronStore";
import { MemoryMarkupStore, type MarkupStore } from "./markupStore";
import { TauriMarkupStore } from "./tauriStore";

/** The Electron shell's store when `window.collide` exists, Tauri's in the Tauri shell, else the localStorage-backed memory store (browser, e2e). */
export function createMarkupStore(): MarkupStore {
  if (typeof window !== "undefined" && window.collide) return new ElectronMarkupStore(window.collide.markups);
  const native = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  return native ? new TauriMarkupStore() : new MemoryMarkupStore(true);
}

export * from "./markupStore";
