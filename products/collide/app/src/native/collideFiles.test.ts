// @vitest-environment node
// RUN3 T35: Collide files in the main process, with a real temp folder and a fake Open dialog:
// saved and read only inside Documents/Collide/Markups, a taken name is never overwritten by another file,
// and the Open dialog routes a .collide file, a markup folder or its annotations.json. Also the IPC channels.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { INVOKE_CHANNELS, type IpcReply } from "./bridge";
import { COLLIDE_EXT, createCollideFiles, OPEN_TITLE, type OpenFileDialogOptions } from "./collideFiles";
import { registerBridge, type IpcEventLike } from "./ipc";
import { createMarkups } from "./markups";

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function sandbox() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "collide-files-")));
  made.push(base);
  const documents = path.join(base, "Documents");
  fs.mkdirSync(documents);
  return { base, documents, root: path.join(documents, "Collide", "Markups") };
}

type DialogResult = { canceled: boolean; filePaths: string[] };

function store(documents: string) {
  const asked: OpenFileDialogOptions[] = [];
  let answer: DialogResult = { canceled: true, filePaths: [] };
  const files = createCollideFiles({
    fs,
    path,
    documents: () => documents,
    showOpenDialog: async (options) => {
      asked.push(options);
      return answer;
    },
  });
  return { files, asked, answer: (a: DialogResult) => void (answer = a) };
}

/** Enough of a zip to pass the main process's check (the page checks the package itself). */
const pkg = (tag: number) => new Uint8Array([0x50, 0x4b, 3, 4, ...new Array(30).fill(tag)]);

const message = async (run: () => unknown) => {
  try {
    await run();
  } catch (e) {
    return (e as Error).message;
  }
  return "resolved";
};

describe("Collide files (main process)", () => {
  it("save writes in Documents/Collide/Markups; open reads the same bytes; a taken name gets -2 unless replacing", async () => {
    const { documents, root } = sandbox();
    const { files } = store(documents);
    const first = files.save("line-3-conveyor-guard.collide", pkg(1), false);
    expect(first).toBe(path.join(root, "line-3-conveyor-guard.collide"));
    expect([...files.open(first)]).toEqual([...pkg(1)]);

    // Another file with the same name does not overwrite the first.
    const second = files.save("line-3-conveyor-guard.collide", pkg(2), false);
    expect(second).toBe(path.join(root, "line-3-conveyor-guard-2.collide"));
    expect([...files.open(first)]).toEqual([...pkg(1)]);

    // The tab that saved it saves to it again.
    expect(files.save("line-3-conveyor-guard.collide", pkg(3), true)).toBe(first);
    expect([...fs.readFileSync(first)]).toEqual([...pkg(3)]);
    expect(fs.readdirSync(root).sort()).toEqual(["line-3-conveyor-guard-2.collide", "line-3-conveyor-guard.collide"]);
    // Markups' own listing (folders) is unchanged by the files beside them.
    expect(createMarkups({ fs, path, documents: () => documents, showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }).list()).toEqual([]);
  });

  it("refuses names, bytes and paths that are not a Collide file inside Markups", async () => {
    const { base, documents, root } = sandbox();
    const { files } = store(documents);
    for (const name of ["../escape.collide", "a/b.collide", "/tmp/x.collide", "notes.txt", COLLIDE_EXT, "", 7, null]) {
      expect(await message(() => files.save(name, pkg(1), false)), String(name)).toMatch(/cannot be used as a Collide file name/);
    }
    expect(await message(() => files.save("ok.collide", new Uint8Array([1, 2, 3]), false))).toMatch(/is not a package/);
    expect(await message(() => files.save("ok.collide", "PK....", false))).toMatch(/is not a package/);

    const outside = path.join(base, "Desktop", "x.collide");
    fs.mkdirSync(path.dirname(outside));
    fs.writeFileSync(outside, pkg(5));
    expect(await message(() => files.open(outside))).toBe(`${outside} is outside Documents/Collide/Markups. Pick a folder inside Documents/Collide/Markups.`);
    expect(await message(() => files.open(path.join(root, "..", "..", "..", "Desktop", "x.collide")))).toMatch(/is outside Documents\/Collide\/Markups/);
    expect(await message(() => files.open("../../../Desktop/x.collide"))).toMatch(/is outside Documents\/Collide\/Markups/);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, "x.txt"), "x");
    expect(await message(() => files.open(path.join(root, "x.txt")))).toMatch(/is not a Collide file/);
    expect(await message(() => files.open(path.join(root, "missing.collide")))).toMatch(/Reading .*missing\.collide failed/);
    expect(await message(() => files.open(""))).toMatch(/No Collide file was given/);

    // A link inside Markups that leads out is refused too.
    fs.symlinkSync(outside, path.join(root, "link.collide"), "file");
    expect(await message(() => files.open(path.join(root, "link.collide")))).toMatch(/is outside Documents\/Collide\/Markups/);
    // Nothing was written outside.
    expect([...fs.readFileSync(outside)]).toEqual([...pkg(5)]);
  });

  it("the Open dialog: starts in Markups; a .collide file, a markup folder or its annotations.json; outside refused", async () => {
    const { base, documents, root } = sandbox();
    const { files, asked, answer } = store(documents);
    expect(await files.pick()).toBeNull();
    expect(asked).toEqual([
      { title: OPEN_TITLE, defaultPath: root, properties: ["openFile"], filters: [{ name: "Collide files and saved markups", extensions: ["collide", "json"] }] },
    ]);
    const saved = files.save("plan.collide", pkg(1), false);
    answer({ canceled: false, filePaths: [saved] });
    expect(await files.pick()).toEqual({ kind: "collide", file: saved });
    const folder = path.join(root, "2026-11-17_plan");
    fs.mkdirSync(folder);
    answer({ canceled: false, filePaths: [folder] });
    expect(await files.pick()).toEqual({ kind: "markup", folder });
    answer({ canceled: false, filePaths: [path.join(folder, "annotations.json")] });
    expect(await files.pick()).toEqual({ kind: "markup", folder });
    answer({ canceled: false, filePaths: [path.join(root, "notes.json")] });
    expect(await message(() => files.pick())).toMatch(/is not a Collide file or a saved markup/);
    answer({ canceled: false, filePaths: [path.join(base, "x.collide")] });
    expect(await message(() => files.pick())).toMatch(/is outside Documents\/Collide\/Markups/);
  });

  it("the IPC channels reach the files with the page's arguments, only from Collide's own pages", async () => {
    const { documents } = sandbox();
    const { files } = store(documents);
    const handlers = new Map<string, (event: IpcEventLike, ...args: unknown[]) => unknown>();
    const none = () => {
      throw new Error("not used");
    };
    registerBridge({
      ipcMain: { handle: (c, l) => void handlers.set(c, l), on: () => undefined },
      screen: {} as never,
      desktopCapturer: {} as never,
      decodePng: none as never,
      isTrusted: (url) => url.startsWith("collide://app/"),
      broadcast: () => undefined,
      windows: { hideEditor: none, showEditor: none, showOverlay: none, hideOverlay: none } as never,
      copyImage: none,
      settingsStatus: () => null,
      collapse: none as never,
      markups: {} as never,
      collideFiles: files,
      capturer: {} as never,
    });
    const app = { senderFrame: { url: "collide://app/" } };
    const invoke = (c: keyof typeof INVOKE_CHANNELS, event: IpcEventLike, ...args: unknown[]) => handlers.get(INVOKE_CHANNELS[c])!(event, ...args) as Promise<IpcReply>;
    const saved = await invoke("collideFiles.save", app, "a.collide", pkg(4), false);
    expect(saved).toMatchObject({ ok: true, value: expect.stringMatching(/a\.collide$/) });
    const read = await invoke("collideFiles.open", app, (saved as { value: string }).value);
    expect(read.ok && [...(read.value as Uint8Array)]).toEqual([...pkg(4)]);
    expect(await invoke("collideFiles.pick", app)).toEqual({ ok: true, value: null });
    expect(await invoke("collideFiles.save", app, "../a.collide", pkg(4), false)).toMatchObject({ ok: false, error: expect.stringContaining("cannot be used as a Collide file name") });
    for (const c of ["collideFiles.save", "collideFiles.open", "collideFiles.pick"] as const) {
      expect(await invoke(c, { senderFrame: { url: "https://example.com/" } }, "a.collide", pkg(4), true)).toMatchObject({ ok: false });
    }
  });
});
