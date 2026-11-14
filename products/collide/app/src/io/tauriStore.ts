import { documentDir, join } from "@tauri-apps/api/path";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { mkdir, readDir, readFile, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  annotationsText,
  FILE_ANNOTATIONS,
  FILE_EXPORT,
  FILE_SOURCE,
  MarkupError,
  MARKUPS_SUBPATH,
  parseAnnotations,
  type MarkupStore,
  type OpenedMarkup,
  type SaveInput,
} from "./markupStore";

const base = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? p;
const cause = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Real folders under Documents/Collide/Markups (fs capability is scoped to that path only). */
export class TauriMarkupStore implements MarkupStore {
  private async root() {
    return join(await documentDir(), MARKUPS_SUBPATH);
  }

  async save(folderName: string, input: SaveInput): Promise<string> {
    let dir = folderName;
    try {
      const root = await this.root();
      dir = await join(root, folderName);
      await mkdir(dir, { recursive: true });
      await writeFile(await join(dir, FILE_SOURCE), input.sourcePng);
      await writeTextFile(await join(dir, FILE_ANNOTATIONS), annotationsText(input.annotations));
      await writeFile(await join(dir, FILE_EXPORT), input.exportPng);
      return dir;
    } catch (e) {
      throw new MarkupError("Could not save markup", `Writing ${dir} failed (${cause(e)}). Check that Documents/Collide/Markups is writable and has free space, then save again.`);
    }
  }

  async open(folder: string): Promise<OpenedMarkup> {
    let sourcePng: Uint8Array;
    let text: string;
    try {
      sourcePng = await readFile(await join(folder, FILE_SOURCE));
      text = await readTextFile(await join(folder, FILE_ANNOTATIONS));
    } catch (e) {
      throw new MarkupError("Could not open markup", `${folder} is missing source.png or annotations.json (${cause(e)}). Pick a folder created by Save.`);
    }
    return { folderName: base(folder), sourcePng, annotations: parseAnnotations(text) };
  }

  async pick(): Promise<string | null> {
    const root = await this.root();
    try {
      await mkdir(root, { recursive: true });
    } catch {
      /* the dialog still works without the default folder */
    }
    const r = await openDialog({ directory: true, multiple: false, defaultPath: root, title: "Open markup folder" });
    return typeof r === "string" ? r : null;
  }

  async list(): Promise<string[]> {
    const root = await this.root();
    const entries = await readDir(root);
    return Promise.all(entries.filter((e) => e.isDirectory).map((e) => join(root, e.name)));
  }
}
