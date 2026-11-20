// What the shell remembers on this computer (RUN3 T31): theme, Aura ground, the New snip delay,
// the Add snip choice, collapsed, and the settings fields. localStorage may be missing or blocked,
// so nothing here is ever required. The access password is never stored (no server to send it to yet).

export const THEMES = ["system", "light", "dark", "aura"] as const;
export type Theme = (typeof THEMES)[number];

/** The 14 Aura grounds (aura.css). Sage is the default. */
export const AURA_GROUNDS = ["sage", "stone", "slate", "ash", "umber", "cobalt", "bone", "moss", "jade", "linen", "fog", "olive", "lichen", "paper"] as const;
export type AuraGround = (typeof AURA_GROUNDS)[number];

/** Snip delay choices in seconds, as in Windows Snipping Tool. */
export const SNIP_DELAYS = [0, 3, 5, 10] as const;
export const ADD_MODES = ["Current", "Behind"] as const;
export type AddMode = (typeof ADD_MODES)[number];

export interface Settings {
  /** Delete the oldest automatically after this many files; "" = not set. */
  keep: string;
  mode: "server" | "client";
  /** Server address, for a Connected computer. */
  server: string;
}

export interface Prefs {
  theme: Theme;
  aura: AuraGround;
  /** Seconds. */
  snipDelay: number;
  addMode: AddMode;
  collapsed: boolean;
  settings: Settings;
}

export const defaultPrefs: Prefs = { theme: "system", aura: "sage", snipDelay: 0, addMode: "Current", collapsed: false, settings: { keep: "", mode: "server", server: "" } };

const KEYS = { theme: "collide.theme", aura: "collide.aura", snipDelay: "collide.snipDelay", addMode: "collide.addMode", collapsed: "collide.collapsed", settings: "collide.settings" } as const;

type Store = Pick<Storage, "getItem" | "setItem">;
const storage = (): Store | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};
const oneOf = <T extends string | number>(list: readonly T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

export function loadPrefs(store: Store | null = storage()): Prefs {
  const get = (k: string) => {
    try {
      return store?.getItem(k) ?? null;
    } catch {
      return null;
    }
  };
  let settings = defaultPrefs.settings;
  try {
    const raw = JSON.parse(get(KEYS.settings) ?? "null") as Partial<Settings> | null;
    if (raw && typeof raw === "object") {
      settings = {
        keep: typeof raw.keep === "string" && /^\d*$/.test(raw.keep) ? raw.keep : "",
        mode: oneOf(["server", "client"] as const, raw.mode, "server"),
        server: typeof raw.server === "string" ? raw.server : "",
      };
    }
  } catch {
    /* a bad value: the defaults */
  }
  const delay = get(KEYS.snipDelay);
  return {
    theme: oneOf(THEMES, get(KEYS.theme), defaultPrefs.theme),
    aura: oneOf(AURA_GROUNDS, get(KEYS.aura), defaultPrefs.aura),
    snipDelay: delay === null ? 0 : oneOf(SNIP_DELAYS, Number(delay), 0),
    addMode: oneOf(ADD_MODES, get(KEYS.addMode), defaultPrefs.addMode),
    collapsed: get(KEYS.collapsed) === "1",
    settings,
  };
}

/** Remember one choice. Returns false when it could not be stored (it still applies this session). */
export function savePref<K extends keyof Prefs>(key: K, value: Prefs[K], store: Store | null = storage()): boolean {
  try {
    if (!store) return false;
    store.setItem(KEYS[key], key === "settings" ? JSON.stringify(value) : key === "collapsed" ? (value ? "1" : "0") : String(value));
    return true;
  } catch {
    return false;
  }
}

/** Light or Dark for "system", from the computer's own setting. */
export function resolveTheme(theme: Theme, prefersDark: boolean): Exclude<Theme, "system"> {
  return theme === "system" ? (prefersDark ? "dark" : "light") : theme;
}

export const prefersDark = (): boolean => {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)").matches : true;
  } catch {
    return true;
  }
};

/** Put the theme on <html>: data-app-theme is the look in use (light, dark or aura); data-aura-theme the Aura ground. */
export function applyTheme(theme: Theme, aura: AuraGround, root: HTMLElement = document.documentElement): void {
  root.dataset.appTheme = resolveTheme(theme, prefersDark());
  if (theme === "aura") root.dataset.auraTheme = aura;
  else delete root.dataset.auraTheme;
}
