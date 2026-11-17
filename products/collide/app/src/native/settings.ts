// T15: `settings.json` in the app's user-data folder, e.g. `{ "hotkey": "Ctrl+Alt+S" }`,
// ported from the Rust shell's settings.rs plus `setup_hotkey` from lib.rs.
//
// Missing file -> written with defaults. Invalid hotkey (unparseable, or the
// Windows-owned Win+Shift+S) -> default hotkey plus a warning naming the fix.
// Nothing here imports Node or Electron: `fs`, `path` and `globalShortcut` are
// passed in, so the tests run with a temp folder and a fake shortcut registry.

import type { SettingsStatus } from "./bridge";

export const DEFAULT_HOTKEY = "Ctrl+Alt+S";
export const FILE_NAME = "settings.json";

export interface Settings {
  hotkey: string;
}

export const DEFAULT_SETTINGS: Settings = { hotkey: DEFAULT_HOTKEY };

/** A parsed hotkey: its modifiers, the key (a `KeyboardEvent.code` name), and how Electron spells it. */
export interface Hotkey {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** The Windows key (Command on a Mac). */
  super: boolean;
  code: string;
  /** Electron accelerator, e.g. "Control+Alt+S"; null for a key Electron has no global shortcut for. */
  accelerator: string | null;
}

/** [aliases as typed (upper case), key code, Electron's name for the key or null]. The names the Rust shell accepted. */
const KEY_ROWS: [string[], string, string | null][] = [
  [["BACKQUOTE", "`"], "Backquote", "`"],
  [["BACKSLASH", "\\"], "Backslash", "\\"],
  [["BRACKETLEFT", "["], "BracketLeft", "["],
  [["BRACKETRIGHT", "]"], "BracketRight", "]"],
  [["PAUSE", "PAUSEBREAK"], "Pause", null],
  [["COMMA", ","], "Comma", ","],
  [["EQUAL", "="], "Equal", "="],
  [["MINUS", "-"], "Minus", "-"],
  [["PERIOD", "."], "Period", "."],
  [["QUOTE", "'"], "Quote", "'"],
  [["SEMICOLON", ";"], "Semicolon", ";"],
  [["SLASH", "/"], "Slash", "/"],
  [["BACKSPACE"], "Backspace", "Backspace"],
  [["CAPSLOCK"], "CapsLock", "Capslock"],
  [["ENTER"], "Enter", "Enter"],
  [["SPACE"], "Space", "Space"],
  [["TAB"], "Tab", "Tab"],
  [["DELETE"], "Delete", "Delete"],
  [["END"], "End", "End"],
  [["HOME"], "Home", "Home"],
  [["INSERT"], "Insert", "Insert"],
  [["PAGEDOWN"], "PageDown", "PageDown"],
  [["PAGEUP"], "PageUp", "PageUp"],
  [["PRINTSCREEN"], "PrintScreen", "PrintScreen"],
  [["SCROLLLOCK"], "ScrollLock", "Scrolllock"],
  [["ARROWDOWN", "DOWN"], "ArrowDown", "Down"],
  [["ARROWLEFT", "LEFT"], "ArrowLeft", "Left"],
  [["ARROWRIGHT", "RIGHT"], "ArrowRight", "Right"],
  [["ARROWUP", "UP"], "ArrowUp", "Up"],
  [["NUMLOCK"], "NumLock", "Numlock"],
  [["NUMPADADD", "NUMADD", "NUMPADPLUS", "NUMPLUS"], "NumpadAdd", "numadd"],
  [["NUMPADDECIMAL", "NUMDECIMAL"], "NumpadDecimal", "numdec"],
  [["NUMPADDIVIDE", "NUMDIVIDE"], "NumpadDivide", "numdiv"],
  [["NUMPADENTER", "NUMENTER"], "NumpadEnter", null],
  [["NUMPADEQUAL", "NUMEQUAL"], "NumpadEqual", null],
  [["NUMPADMULTIPLY", "NUMMULTIPLY"], "NumpadMultiply", "nummult"],
  [["NUMPADSUBTRACT", "NUMSUBTRACT"], "NumpadSubtract", "numsub"],
  [["ESCAPE", "ESC"], "Escape", "Escape"],
  [["AUDIOVOLUMEDOWN", "VOLUMEDOWN"], "AudioVolumeDown", "VolumeDown"],
  [["AUDIOVOLUMEUP", "VOLUMEUP"], "AudioVolumeUp", "VolumeUp"],
  [["AUDIOVOLUMEMUTE", "VOLUMEMUTE"], "AudioVolumeMute", "VolumeMute"],
  [["MEDIAPLAY"], "MediaPlay", null],
  [["MEDIAPAUSE"], "MediaPause", null],
  [["MEDIAPLAYPAUSE"], "MediaPlayPause", "MediaPlayPause"],
  [["MEDIASTOP"], "MediaStop", "MediaStop"],
  [["MEDIATRACKNEXT"], "MediaTrackNext", "MediaNextTrack"],
  [["MEDIATRACKPREV", "MEDIATRACKPREVIOUS"], "MediaTrackPrevious", "MediaPreviousTrack"],
];

const KEYS = new Map<string, { code: string; electron: string | null }>();
for (const [aliases, code, electron] of KEY_ROWS) for (const a of aliases) KEYS.set(a, { code, electron });
for (let d = 0; d <= 9; d++) {
  for (const a of [`DIGIT${d}`, `${d}`]) KEYS.set(a, { code: `Digit${d}`, electron: `${d}` });
  for (const a of [`NUMPAD${d}`, `NUM${d}`]) KEYS.set(a, { code: `Numpad${d}`, electron: `num${d}` });
}
for (let c = 65; c <= 90; c++) {
  const letter = String.fromCharCode(c);
  for (const a of [`KEY${letter}`, letter]) KEYS.set(a, { code: `Key${letter}`, electron: letter });
}
for (let f = 1; f <= 24; f++) KEYS.set(`F${f}`, { code: `F${f}`, electron: `F${f}` });

type Modifier = "ctrl" | "alt" | "shift" | "super";

function modifier(token: string, mac: boolean): Modifier | undefined {
  switch (token) {
    case "OPTION":
    case "ALT":
      return "alt";
    case "CONTROL":
    case "CTRL":
      return "ctrl";
    case "COMMAND":
    case "CMD":
    case "SUPER":
      return "super";
    case "SHIFT":
      return "shift";
    case "COMMANDORCONTROL":
    case "COMMANDORCTRL":
    case "CMDORCTRL":
    case "CMDORCONTROL":
      return mac ? "super" : "ctrl";
    default:
      return undefined;
  }
}

function key(token: string): { code: string; electron: string | null } {
  const found = KEYS.get(token.toUpperCase());
  if (!found) throw new Error(`"${token}" is not a key name`);
  return found;
}

/**
 * Parse a hotkey such as "Ctrl+Alt+S": modifiers first, then exactly one key.
 * Throws an Error whose message is the reason; Win+Shift+S (owned by Windows) is rejected.
 * `mac` only changes what "CmdOrCtrl" means.
 */
export function parseHotkey(text: string, mac = false): Hotkey {
  const whole = String(text).trim();
  const invalid = (reason: string) => new Error(`"${text}" is not a valid hotkey (${reason})`);
  const mods: Record<Modifier, boolean> = { ctrl: false, alt: false, shift: false, super: false };
  let main: { code: string; electron: string | null } | undefined;
  try {
    const tokens = whole.split("+");
    if (tokens.length === 1) {
      main = key(tokens[0]);
    } else {
      for (const raw of tokens) {
        const token = raw.trim();
        if (token === "") throw new Error("a key or modifier is missing around a +");
        if (main) throw new Error("modifiers come first, then one key, for example Shift+Alt+K");
        const mod = modifier(token.toUpperCase(), mac);
        if (mod) mods[mod] = true;
        else main = key(token);
      }
    }
    if (!main) throw new Error("modifiers come first, then one key, for example Shift+Alt+K");
  } catch (e) {
    throw invalid(e instanceof Error ? e.message : String(e));
  }
  if (mods.super && mods.shift && !mods.ctrl && !mods.alt && main.code === "KeyS") {
    throw new Error("Win+Shift+S is reserved by Windows");
  }
  const names = [mods.ctrl && "Control", mods.alt && "Alt", mods.shift && "Shift", mods.super && "Super"].filter((n): n is string => !!n);
  return { ...mods, code: main.code, accelerator: main.electron === null ? null : [...names, main.electron].join("+") };
}

/** The parts of `node:fs` and `node:path` the settings use. */
export interface SettingsIo {
  fs: {
    existsSync(path: string): boolean;
    mkdirSync(path: string, options: { recursive: true }): unknown;
    readFileSync(path: string, encoding: "utf8"): string;
    writeFileSync(path: string, text: string): void;
  };
  path: { join(...parts: string[]): string };
  /** True on macOS (only changes "CmdOrCtrl"). */
  mac?: boolean;
}

const detailOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

function warningFor(reason: string, path: string): string {
  return `Hotkey setting ignored: ${reason}. Using ${DEFAULT_HOTKEY}. Fix "hotkey" in ${path} (example: "Ctrl+Alt+S") and restart Collide.`;
}

/** The settings in a file's text. Throws if it is not JSON with a string "hotkey" (other keys are ignored). */
export function parseSettings(raw: string): Settings {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("expected an object with a \"hotkey\"");
  const hotkey = (value as Record<string, unknown>).hotkey;
  if (hotkey === undefined) throw new Error("\"hotkey\" is missing");
  if (typeof hotkey !== "string") throw new Error("\"hotkey\" is not text");
  return { hotkey };
}

/**
 * Load `dir/settings.json`, creating it with defaults if missing. Never throws:
 * problems fall back to defaults and are reported in `warning`.
 */
export function loadOrInit(dir: string, io: SettingsIo): SettingsStatus {
  const path = io.path.join(dir, FILE_NAME);
  const fallback = (warning: string | null = null): SettingsStatus => ({ hotkey: DEFAULT_HOTKEY, warning });
  let exists: boolean;
  try {
    exists = io.fs.existsSync(path);
  } catch {
    exists = false;
  }
  if (!exists) {
    try {
      io.fs.mkdirSync(dir, { recursive: true });
      io.fs.writeFileSync(path, JSON.stringify(DEFAULT_SETTINGS, null, 2) + "\n");
    } catch (e) {
      return fallback(`Could not create ${path} (${detailOf(e)}). Using ${DEFAULT_HOTKEY}; check the folder is writable.`);
    }
    return fallback();
  }
  let raw: string;
  try {
    raw = io.fs.readFileSync(path, "utf8");
  } catch (e) {
    return fallback(warningFor(`the file could not be read (${detailOf(e)})`, path));
  }
  let settings: Settings;
  try {
    settings = parseSettings(raw);
  } catch (e) {
    return fallback(warningFor(`the file is not valid settings JSON (${detailOf(e)})`, path));
  }
  try {
    parseHotkey(settings.hotkey, io.mac);
  } catch (e) {
    return fallback(warningFor(detailOf(e), path));
  }
  return { hotkey: settings.hotkey.trim(), warning: null };
}

/** The part of Electron's `globalShortcut` the hotkey uses. `register` answers false when the key is taken. */
export interface GlobalShortcutLike {
  register(accelerator: string, callback: () => void): boolean;
}

/**
 * Load the settings and register the hotkey; `onPressed` runs on every press.
 * If the configured key cannot be registered (e.g. another app owns it), the
 * default is tried; failing that, Collide runs without a hotkey. Never throws.
 */
export function setupHotkey(dir: string, io: SettingsIo, globalShortcut: GlobalShortcutLike, onPressed: () => void): SettingsStatus {
  const status = loadOrInit(dir, io);
  const register = (hotkey: string) => {
    const { accelerator } = parseHotkey(hotkey, io.mac);
    if (accelerator === null) throw new Error("this key cannot be a global hotkey");
    if (!globalShortcut.register(accelerator, onPressed)) throw new Error("another app or Windows is already using it");
  };
  try {
    register(status.hotkey);
  } catch (e) {
    const warning = `Hotkey ${status.hotkey} could not be registered (${detailOf(e)}). Pick another in ${FILE_NAME} in ${dir} and restart Collide.`;
    if (status.hotkey !== DEFAULT_HOTKEY) {
      try {
        register(DEFAULT_HOTKEY);
        status.hotkey = DEFAULT_HOTKEY;
      } catch {
        // No hotkey this run; the warning below says why.
      }
    }
    status.warning ??= warning;
  }
  return status;
}
