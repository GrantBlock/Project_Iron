import { MemoryMarkupStore, type MarkupStore } from "./markupStore";
import { TauriMarkupStore } from "./tauriStore";

/** Tauri when running in the native shell, else the localStorage-backed memory store (browser, e2e). */
export function createMarkupStore(): MarkupStore {
  const native = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  return native ? new TauriMarkupStore() : new MemoryMarkupStore(true);
}

export * from "./markupStore";
