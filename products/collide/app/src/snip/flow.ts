// T11: the snip orchestrator. All side effects come in through `SnipDeps`, so the
// order of calls is unit-testable with mocks. Window moves are Rust commands (src-tauri/src/snip.rs).

export interface CaptureInfo {
  width: number;
  height: number;
  x: number;
  y: number;
  scaleFactor: number;
  png: string;
}
export interface CropInfo {
  width: number;
  height: number;
  png: string;
}
export type OverlayResult =
  | { kind: "crop"; box: { x: number; y: number; w: number; h: number }; scale: number }
  | { kind: "cancel" };

export interface SnipNotice {
  tone: "error" | "success";
  title: string;
  description: string;
}

export interface SnipDeps {
  /** Tauri `invoke`; undefined outside the desktop app. */
  invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  /** Resolve once the overlay window is listening (it answers a ping). */
  waitForOverlayReady: () => Promise<void>;
  /** Hand the frozen frame (with its physical size) to the overlay; resolves when the overlay acks it as decoded and shown. */
  sendFrame: (png: string, scale: number, width: number, height: number, snipId: number) => Promise<void>;
  /** Resolve with the overlay's next result. */
  waitForOverlayResult: (snipId: number) => Promise<OverlayResult>;
  /** Open the crop in the editor as a new markup. */
  openImage: (url: string, name: string) => Promise<unknown>;
  notify: (n: SnipNotice) => void;
  now: () => Date;
  /** Pause so the hidden editor is gone from the screen before capture. */
  settle: () => Promise<void>;
  /** Timeouts for the handshake only. Never for the user's crop/cancel. */
  readyTimeoutMs?: number;
  ackTimeoutMs?: number;
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `snip-YYYY-MM-DD-HHMM` in local time. */
export function snipName(d: Date): string {
  return `snip-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

const cause = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const NOT_DESKTOP: SnipNotice = {
  tone: "error",
  title: "New snip needs the Collide desktop app",
  description: "Screen capture is not available in a browser. Open Collide from its installed app (or pnpm tauri dev) and try again.",
};

export function createSnipFlow(deps: SnipDeps) {
  let busy = false;
  let lastSnipId = 0;

  async function run(invoke: NonNullable<SnipDeps["invoke"]>, snipId: number) {
    await invoke("hide_editor");
    await deps.settle();
    const cap = (await invoke("capture_monitor")) as CaptureInfo;
    await withTimeout(
      deps.waitForOverlayReady(),
      deps.readyTimeoutMs ?? 2000,
      "The capture overlay did not respond — restart Collide if this repeats.",
    );
    await withTimeout(
      deps.sendFrame(cap.png, cap.scaleFactor, cap.width, cap.height, snipId),
      deps.ackTimeoutMs ?? 5000,
      "The capture overlay did not confirm the frozen frame — restart Collide if this repeats.",
    );
    const pending = deps.waitForOverlayResult(snipId); // listen before showing so no result is missed
    pending.catch(() => undefined); // if show_overlay throws, nobody awaits this
    await invoke("show_overlay", { x: cap.x, y: cap.y, width: cap.width, height: cap.height });
    const result = await pending;
    if (result.kind === "cancel") {
      await invoke("hide_overlay");
      await invoke("show_editor");
      return;
    }
    const { box, scale } = result;
    const crop = (await invoke("crop_capture", { x: box.x, y: box.y, w: box.w, h: box.h, scale })) as CropInfo;
    await invoke("hide_overlay");
    await invoke("show_editor");
    await deps.openImage(crop.png, snipName(deps.now()));
  }

  /** Start a snip. Ignored while one is already in progress. Never throws. */
  async function start(): Promise<void> {
    if (busy) return;
    const invoke = deps.invoke;
    if (!invoke) {
      deps.notify(NOT_DESKTOP);
      return;
    }
    busy = true;
    try {
      await run(invoke, ++lastSnipId);
    } catch (e) {
      deps.notify({
        tone: "error",
        title: "Snip failed",
        description: `${cause(e)} Nothing was changed; try New snip again.`,
      });
      // Best effort: leave the user with the editor and no stuck overlay.
      await invoke("hide_overlay").catch(() => undefined);
      await invoke("show_editor").catch(() => undefined);
    } finally {
      busy = false;
    }
  }

  return { start, isBusy: () => busy };
}
