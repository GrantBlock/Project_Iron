// T16: the Electron shell's markup store. The files are read and written by the main
// process (src/native/markups.ts), which keeps every path inside Documents/Collide/Markups;
// this side only talks to `window.collide.markups` and turns failures into `MarkupError`s.
import type { CollideBridge } from "../native/bridge";
import { annotationsText, MarkupError, parseAnnotations, type MarkupStore, type OpenedMarkup, type SaveInput } from "./markupStore";

const base = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? p;
/** The main process's message already names the cause and the fix. */
const cause = (e: unknown) => (e instanceof Error ? e.message : String(e));

const SAVE_FAILED = "Could not save markup";
const OPEN_FAILED = "Could not open markup";
const DELETE_FAILED = "Could not delete markup";

/** Real folders under Documents/Collide/Markups, through the preload bridge. */
export class ElectronMarkupStore implements MarkupStore {
  constructor(private readonly markups: CollideBridge["markups"]) {}

  async save(folderName: string, input: SaveInput): Promise<string> {
    try {
      return await this.markups.save(folderName, {
        sourcePng: input.sourcePng,
        annotations: annotationsText(input.annotations),
        exportPng: input.exportPng,
      });
    } catch (e) {
      throw new MarkupError(SAVE_FAILED, cause(e));
    }
  }

  async open(folder: string): Promise<OpenedMarkup> {
    let files: Awaited<ReturnType<CollideBridge["markups"]["open"]>>;
    try {
      files = await this.markups.open(folder);
    } catch (e) {
      throw new MarkupError(OPEN_FAILED, cause(e));
    }
    return { folderName: base(folder), sourcePng: new Uint8Array(files.sourcePng), annotations: parseAnnotations(files.annotations) };
  }

  async pick(): Promise<string | null> {
    try {
      return await this.markups.pick();
    } catch (e) {
      throw new MarkupError(OPEN_FAILED, cause(e));
    }
  }

  list(): Promise<string[]> {
    return this.markups.list();
  }

  async remove(folder: string): Promise<void> {
    try {
      await this.markups.remove(folder);
    } catch (e) {
      throw new MarkupError(DELETE_FAILED, cause(e));
    }
  }
}
