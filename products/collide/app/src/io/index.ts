import { ElectronMarkupStore } from "./electronStore";
import { MemoryMarkupStore, type MarkupStore } from "./markupStore";

/** The Electron shell's store when `window.collide` exists, else the localStorage-backed memory store (browser, e2e). */
export function createMarkupStore(): MarkupStore {
  if (typeof window !== "undefined" && window.collide) return new ElectronMarkupStore(window.collide.markups);
  return new MemoryMarkupStore(true);
}

export * from "./markupStore";
