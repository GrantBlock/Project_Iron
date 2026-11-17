// T15: settings.json and the global hotkey, with a real temp folder and a fake shortcut registry.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HOTKEY, DEFAULT_SETTINGS, FILE_NAME, loadOrInit, parseHotkey, parseSettings, setupHotkey, type SettingsIo } from "./settings";

const io: SettingsIo = { fs, path };
const made: string[] = [];

/** A folder name that does not exist yet (as the Rust tests' `tmp`). */
function tmp(name: string): string {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "collide-settings-")), name);
  made.push(path.dirname(dir));
  return dir;
}

function withFile(name: string, text: string): string {
  const dir = tmp(name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, FILE_NAME), text);
  return dir;
}

const read = (dir: string) => fs.readFileSync(path.join(dir, FILE_NAME), "utf8");
const reason = (text: string) => {
  try {
    parseHotkey(text);
  } catch (e) {
    return (e as Error).message;
  }
  return "parsed";
};

afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("settings.rs tests, ported", () => {
  it("missing_file_is_created_with_defaults", () => {
    const dir = tmp("missing");
    expect(loadOrInit(dir, io)).toEqual({ hotkey: "Ctrl+Alt+S", warning: null });
    expect(JSON.parse(read(dir))).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ hotkey: "Ctrl+Alt+S" });
  });

  it("valid_custom_hotkey_is_used", () => {
    const dir = withFile("valid", '{"hotkey":"Ctrl+Shift+F9"}');
    const s = loadOrInit(dir, io);
    expect(s.hotkey).toBe("Ctrl+Shift+F9");
    expect(s.warning).toBeNull();
  });

  it("invalid_hotkey_falls_back_with_fix_message", () => {
    const dir = withFile("invalid", '{"hotkey":"Ctrl+Banana"}');
    const s = loadOrInit(dir, io);
    expect(s.hotkey).toBe(DEFAULT_HOTKEY);
    expect(s.warning).toContain('Fix "hotkey"');
    expect(s.warning).toContain("Ctrl+Banana");
    // The bad file is left for the user to fix, not overwritten.
    expect(read(dir)).toContain("Banana");
  });

  it("corrupt_json_falls_back", () => {
    const dir = withFile("corrupt", "{not json");
    const s = loadOrInit(dir, io);
    expect(s.hotkey).toBe(DEFAULT_HOTKEY);
    expect(s.warning).toContain("not valid settings JSON");
  });

  it("win_shift_s_is_rejected", () => {
    expect(() => parseHotkey("Win+Shift+S")).toThrow(); // "Win" is not a key name at all
    for (const t of ["Super+Shift+S", "Shift+Super+KeyS", "Cmd+Shift+S"]) {
      expect(reason(t), t).toContain("reserved by Windows");
    }
    expect(() => parseHotkey("Ctrl+Alt+S")).not.toThrow();
  });
});

describe("settings, Node port", () => {
  it("the default file is the text the Rust shell wrote", () => {
    const dir = tmp("text");
    loadOrInit(dir, io);
    expect(read(dir)).toBe('{\n  "hotkey": "Ctrl+Alt+S"\n}\n');
  });

  it("the whole warning names the cause, the default in use, the file and the fix", () => {
    const dir = withFile("message", '{"hotkey":"Ctrl+Banana"}');
    expect(loadOrInit(dir, io).warning).toBe(
      `Hotkey setting ignored: "Ctrl+Banana" is not a valid hotkey ("Banana" is not a key name). Using Ctrl+Alt+S. Fix "hotkey" in ${path.join(dir, FILE_NAME)} (example: "Ctrl+Alt+S") and restart Collide.`,
    );
    const reserved = withFile("reserved", '{"hotkey":"Super+Shift+S"}');
    expect(loadOrInit(reserved, io)).toEqual({
      hotkey: "Ctrl+Alt+S",
      warning: `Hotkey setting ignored: Win+Shift+S is reserved by Windows. Using Ctrl+Alt+S. Fix "hotkey" in ${path.join(reserved, FILE_NAME)} (example: "Ctrl+Alt+S") and restart Collide.`,
    });
  });

  it("a hotkey with spaces around it is used trimmed; other keys in the file are ignored", () => {
    const dir = withFile("trim", '{"hotkey":"  Ctrl+Alt+S \\n","theme":"dark"}');
    expect(loadOrInit(dir, io)).toEqual({ hotkey: "Ctrl+Alt+S", warning: null });
  });

  it("JSON without a text hotkey is not valid settings JSON, and the file is left alone", () => {
    for (const text of ["{}", '{"hotkey":7}', '{"hotkey":null}', "[]", '"Ctrl+Alt+S"', "null", ""]) {
      const dir = withFile("shape", text);
      const s = loadOrInit(dir, io);
      expect(s.hotkey, text).toBe(DEFAULT_HOTKEY);
      expect(s.warning, text).toContain("not valid settings JSON");
      expect(read(dir)).toBe(text);
    }
    expect(() => parseSettings('{"hotkey":"F9"}')).not.toThrow();
  });

  it("a file that cannot be read or a folder that cannot be written falls back with the cause", () => {
    const unreadable = loadOrInit("/cfg", {
      path: path.posix,
      fs: {
        existsSync: () => true,
        mkdirSync: () => undefined,
        readFileSync: () => {
          throw new Error("access denied");
        },
        writeFileSync: () => undefined,
      },
    });
    expect(unreadable.hotkey).toBe(DEFAULT_HOTKEY);
    expect(unreadable.warning).toContain("the file could not be read (access denied)");
    expect(unreadable.warning).toContain('Fix "hotkey" in /cfg/settings.json');

    const readOnly = loadOrInit("/cfg", {
      path: path.posix,
      fs: {
        existsSync: () => false,
        mkdirSync: () => {
          throw new Error("read-only folder");
        },
        readFileSync: () => "",
        writeFileSync: () => undefined,
      },
    });
    expect(readOnly).toEqual({
      hotkey: "Ctrl+Alt+S",
      warning: "Could not create /cfg/settings.json (read-only folder). Using Ctrl+Alt+S; check the folder is writable.",
    });
  });
});

describe("parseHotkey", () => {
  it("modifiers in any order and case, with their aliases, then one key", () => {
    expect(parseHotkey("Ctrl+Alt+S")).toEqual({ ctrl: true, alt: true, shift: false, super: false, code: "KeyS", accelerator: "Control+Alt+S" });
    expect(parseHotkey(" alt + control + keys ")).toEqual(parseHotkey("Ctrl+Alt+S"));
    expect(parseHotkey("Option+Shift+F9").accelerator).toBe("Alt+Shift+F9");
    expect(parseHotkey("Ctrl+Shift+F9").accelerator).toBe("Control+Shift+F9");
    expect(parseHotkey("Super+Alt+S").accelerator).toBe("Alt+Super+S");
    expect(parseHotkey("F8")).toEqual({ ctrl: false, alt: false, shift: false, super: false, code: "F8", accelerator: "F8" });
  });

  it("CmdOrCtrl is Ctrl on Windows and Linux, Command on a Mac", () => {
    expect(parseHotkey("CmdOrCtrl+Shift+5").accelerator).toBe("Control+Shift+5");
    expect(parseHotkey("CommandOrControl+Shift+5", true).accelerator).toBe("Shift+Super+5");
  });

  it("names the keys the way Electron registers them", () => {
    const keys: [string, string, string][] = [
      ["Ctrl+0", "Digit0", "Control+0"],
      ["Ctrl+Digit7", "Digit7", "Control+7"],
      ["Ctrl+Num3", "Numpad3", "Control+num3"],
      ["Ctrl+NumpadAdd", "NumpadAdd", "Control+numadd"],
      ["Ctrl+PrintScreen", "PrintScreen", "Control+PrintScreen"],
      ["Ctrl+Up", "ArrowUp", "Control+Up"],
      ["Ctrl+ArrowLeft", "ArrowLeft", "Control+Left"],
      ["Ctrl+Esc", "Escape", "Control+Escape"],
      ["Ctrl+,", "Comma", "Control+,"],
      ["Ctrl+Slash", "Slash", "Control+/"],
      ["Alt+F24", "F24", "Alt+F24"],
      ["Alt+Space", "Space", "Alt+Space"],
      ["Alt+MediaTrackPrevious", "MediaTrackPrevious", "Alt+MediaPreviousTrack"],
    ];
    for (const [text, code, accelerator] of keys) expect(parseHotkey(text), text).toMatchObject({ code, accelerator });
  });

  it("a key Electron has no global shortcut for still parses, with no accelerator", () => {
    for (const text of ["Ctrl+Pause", "Ctrl+NumpadEnter", "Ctrl+MediaPlay"]) expect(parseHotkey(text).accelerator, text).toBeNull();
  });

  it("says what is wrong with a hotkey it cannot read", () => {
    expect(reason("Ctrl+Banana")).toBe('"Ctrl+Banana" is not a valid hotkey ("Banana" is not a key name)');
    expect(reason("Win+Shift+S")).toBe('"Win+Shift+S" is not a valid hotkey ("Win" is not a key name)');
    expect(reason("Ctrl+S+Alt")).toContain("modifiers come first, then one key");
    expect(reason("Ctrl+S+D")).toContain("modifiers come first, then one key");
    expect(reason("Ctrl+Alt")).toContain("modifiers come first, then one key");
    expect(reason("Ctrl++S")).toContain("missing around a +");
    expect(reason("")).toContain("is not a valid hotkey");
    expect(reason("F25")).toContain("is not a key name");
  });

  it("only Win+Shift+S itself is reserved, not other Win or Shift combinations", () => {
    for (const text of ["Super+Shift+D", "Super+S", "Shift+S", "Ctrl+Super+Shift+S", "Alt+Super+Shift+S"]) expect(reason(text), text).toBe("parsed");
  });
});

describe("setupHotkey (lib.rs setup_hotkey)", () => {
  function registry(taken: string[] = []) {
    const registered = new Map<string, () => void>();
    return {
      registered,
      globalShortcut: {
        register: vi.fn((accelerator: string, callback: () => void) => {
          if (taken.includes(accelerator)) return false;
          registered.set(accelerator, callback);
          return true;
        }),
      },
    };
  }

  it("registers the default hotkey from a fresh folder; a press asks for a snip", () => {
    const dir = tmp("fresh");
    const { registered, globalShortcut } = registry();
    const onPressed = vi.fn();
    expect(setupHotkey(dir, io, globalShortcut, onPressed)).toEqual({ hotkey: "Ctrl+Alt+S", warning: null });
    expect([...registered.keys()]).toEqual(["Control+Alt+S"]);
    expect(onPressed).not.toHaveBeenCalled();
    registered.get("Control+Alt+S")!();
    expect(onPressed).toHaveBeenCalledTimes(1);
  });

  it("registers the custom hotkey from settings.json, and only that", () => {
    const dir = withFile("custom", '{"hotkey":"Ctrl+Shift+F9"}');
    const { registered, globalShortcut } = registry();
    expect(setupHotkey(dir, io, globalShortcut, () => undefined)).toEqual({ hotkey: "Ctrl+Shift+F9", warning: null });
    expect([...registered.keys()]).toEqual(["Control+Shift+F9"]);
  });

  it("an invalid setting registers the default and keeps the settings warning", () => {
    const dir = withFile("invalid", '{"hotkey":"Super+Shift+S"}');
    const { registered, globalShortcut } = registry();
    const s = setupHotkey(dir, io, globalShortcut, () => undefined);
    expect(s.hotkey).toBe("Ctrl+Alt+S");
    expect(s.warning).toContain("reserved by Windows");
    expect([...registered.keys()]).toEqual(["Control+Alt+S"]);
  });

  it("a custom hotkey another app owns falls back to the default, with the fix", () => {
    const dir = withFile("taken", '{"hotkey":"Ctrl+Shift+F9"}');
    const { registered, globalShortcut } = registry(["Control+Shift+F9"]);
    expect(setupHotkey(dir, io, globalShortcut, () => undefined)).toEqual({
      hotkey: "Ctrl+Alt+S",
      warning: `Hotkey Ctrl+Shift+F9 could not be registered (another app or Windows is already using it). Pick another in settings.json in ${dir} and restart Collide.`,
    });
    expect([...registered.keys()]).toEqual(["Control+Alt+S"]);
  });

  it("when the default itself is taken, Collide runs without a hotkey and says so", () => {
    const dir = tmp("none");
    const { registered, globalShortcut } = registry(["Control+Alt+S"]);
    const s = setupHotkey(dir, io, globalShortcut, () => undefined);
    expect(s.hotkey).toBe("Ctrl+Alt+S");
    expect(s.warning).toContain("Hotkey Ctrl+Alt+S could not be registered");
    expect(globalShortcut.register).toHaveBeenCalledTimes(1); // the default is not tried twice
    expect(registered.size).toBe(0);

    const custom = withFile("both", '{"hotkey":"Ctrl+Shift+F9"}');
    const both = registry(["Control+Shift+F9", "Control+Alt+S"]);
    const t = setupHotkey(custom, io, both.globalShortcut, () => undefined);
    expect(t.hotkey).toBe("Ctrl+Shift+F9");
    expect(t.warning).toContain("Hotkey Ctrl+Shift+F9 could not be registered");
    expect(both.registered.size).toBe(0);
  });

  it("a key with no global shortcut, or a registry that throws, is reported the same way", () => {
    const dir = withFile("pause", '{"hotkey":"Ctrl+Pause"}');
    const { registered, globalShortcut } = registry();
    const s = setupHotkey(dir, io, globalShortcut, () => undefined);
    expect(s).toEqual({
      hotkey: "Ctrl+Alt+S",
      warning: `Hotkey Ctrl+Pause could not be registered (this key cannot be a global hotkey). Pick another in settings.json in ${dir} and restart Collide.`,
    });
    expect([...registered.keys()]).toEqual(["Control+Alt+S"]);

    const throwing = setupHotkey(tmp("throws"), io, { register: () => { throw new Error("no display"); } }, () => undefined);
    expect(throwing.warning).toContain("could not be registered (no display)");
  });
});
