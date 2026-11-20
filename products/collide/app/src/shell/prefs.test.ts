import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, defaultPrefs, loadPrefs, resolveTheme, savePref } from "./prefs";

const fake = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

/** A computer that asks for light or dark (jsdom has no matchMedia). */
const computer = (dark: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("dark") ? dark : !dark, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
afterEach(() => vi.unstubAllGlobals());

describe("shell prefs", () => {
  it("nothing stored, or no storage at all: the defaults", () => {
    expect(loadPrefs(fake())).toEqual(defaultPrefs);
    expect(loadPrefs(null)).toEqual(defaultPrefs);
    expect(defaultPrefs).toMatchObject({ theme: "system", aura: "sage", snipDelay: 0, addMode: "Current", collapsed: false });
  });

  it("each choice is remembered and read back", () => {
    const s = fake();
    savePref("theme", "aura", s);
    savePref("aura", "cobalt", s);
    savePref("snipDelay", 5, s);
    savePref("addMode", "Behind", s);
    savePref("collapsed", true, s);
    savePref("settings", { keep: "200", mode: "client", server: "office-pc" }, s);
    expect(loadPrefs(s)).toEqual({ theme: "aura", aura: "cobalt", snipDelay: 5, addMode: "Behind", collapsed: true, settings: { keep: "200", mode: "client", server: "office-pc" } });
  });

  it("values that are not a choice fall back to the default", () => {
    const s = fake({ "collide.theme": "neon", "collide.aura": "mud", "collide.snipDelay": "7", "collide.addMode": "Over", "collide.settings": "{not json" });
    expect(loadPrefs(s)).toEqual(defaultPrefs);
    expect(loadPrefs(fake({ "collide.settings": '{"keep":"lots","mode":"other","server":5}' })).settings).toEqual(defaultPrefs.settings);
  });

  it("storage that throws is not an error: the choice still applies this session", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
    expect(loadPrefs(broken)).toEqual(defaultPrefs);
    expect(savePref("snipDelay", 3, broken)).toBe(false);
    expect(savePref("snipDelay", 3, null)).toBe(false);
  });

  it("system follows the computer: Paper (the Aura look) or Dark (T52: was Light or Dark)", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("aura");
    expect(resolveTheme("aura", true)).toBe("aura");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("the theme goes on the root element; the Aura ground only with Aura", () => {
    const root = document.createElement("html");
    applyTheme("aura", "moss", root);
    expect(root.dataset).toMatchObject({ appTheme: "aura", auraTheme: "moss" });
    applyTheme("dark", "moss", root);
    expect(root.dataset.appTheme).toBe("dark");
    expect(root.dataset.auraTheme).toBeUndefined();
  });

  it("T52: Paper is the Aura paper ground: applyTheme('aura', 'paper') sets data-app-theme=aura and data-aura-theme=paper", () => {
    const root = document.createElement("html");
    applyTheme("aura", "paper", root);
    expect(root.dataset).toMatchObject({ appTheme: "aura", auraTheme: "paper" });
  });

  it("T52: Match system on a light computer gives the same Paper look; on a dark computer, Dark", () => {
    const root = document.createElement("html");
    computer(false);
    applyTheme("system", "sage", root);
    expect(root.dataset).toMatchObject({ appTheme: "aura", auraTheme: "paper" });
    computer(true);
    applyTheme("system", "sage", root);
    expect(root.dataset.appTheme).toBe("dark");
    expect(root.dataset.auraTheme).toBeUndefined();
  });

  it("T52: Match system on a light computer ignores the remembered Aura ground", () => {
    const root = document.createElement("html");
    computer(false);
    applyTheme("system", "cobalt", root);
    expect(root.dataset).toMatchObject({ appTheme: "aura", auraTheme: "paper" });
  });

  it("T52: Match system never resolves to the old Light", () => {
    expect(resolveTheme("system", false)).not.toBe("light");
    expect(resolveTheme("system", true)).not.toBe("light");
  });

  it("T52: a stored collide.theme = light still works: loaded as light and applied with the old Light styles", () => {
    expect(loadPrefs(fake({ "collide.theme": "light" })).theme).toBe("light");
    const root = document.createElement("html");
    computer(true);
    applyTheme("light", "paper", root);
    expect(root.dataset.appTheme).toBe("light");
    expect(root.dataset.auraTheme).toBeUndefined();
  });
});
