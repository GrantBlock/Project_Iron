// T15: the snip's window moves (snip.rs), with fake windows that record every call.
import { describe, expect, it } from "vitest";
import type { Frame } from "./capture";
import { createChoreography, OFF_SCREEN, overlayBoundsFor, type OverlayHandle, type Rect, type WindowLike } from "./windows";

interface FakeOptions {
  bounds?: Rect;
  normalBounds?: Rect;
  maximized?: boolean;
  minimized?: boolean;
  opacity?: number;
  /** Moving the window drops the maximized state (one of the two things a platform may do). */
  moveUnmaximizes?: boolean;
  /** The first setBounds lands at this size (a move between displays with different scaling). */
  firstSetBounds?: Rect;
  fail?: Partial<Record<"hide" | "show" | "focus" | "setBounds" | "setPosition", string>>;
}

class FakeWindow implements WindowLike {
  log: string[] = [];
  bounds: Rect;
  normalBounds: Rect;
  maximized: boolean;
  minimized: boolean;
  opacity: number;
  visible = true;
  focused = false;
  destroyed = false;

  constructor(private readonly o: FakeOptions = {}) {
    this.bounds = o.bounds ?? { x: 100, y: 80, width: 1280, height: 800 };
    this.normalBounds = o.normalBounds ?? this.bounds;
    this.maximized = o.maximized ?? false;
    this.minimized = o.minimized ?? false;
    this.opacity = o.opacity ?? 1;
  }

  private step(name: string, detail = "") {
    this.log.push(detail ? `${name} ${detail}` : name);
    const message = this.o.fail?.[name as keyof NonNullable<FakeOptions["fail"]>];
    if (message) throw new Error(message);
  }

  isDestroyed = () => this.destroyed;
  getBounds = () => ({ ...this.bounds });
  getNormalBounds = () => ({ ...this.normalBounds });
  isMaximized = () => this.maximized;
  isMinimized = () => this.minimized;
  getOpacity = () => this.opacity;

  setBounds(b: Rect) {
    this.step("setBounds", `${b.x},${b.y} ${b.width}x${b.height}`);
    const first = this.o.firstSetBounds;
    this.o.firstSetBounds = undefined;
    this.bounds = { ...(first ?? b) };
    if (!this.maximized) this.normalBounds = { ...this.bounds };
  }
  setPosition(x: number, y: number) {
    this.step("setPosition", `${x},${y}`);
    this.bounds = { ...this.bounds, x, y };
    if (this.o.moveUnmaximizes) this.maximized = false;
    if (!this.maximized) this.normalBounds = { ...this.bounds };
  }
  maximize() {
    this.step("maximize");
    this.maximized = true;
    this.bounds = { x: 0, y: 0, width: 1920, height: 1040 };
  }
  unmaximize() {
    this.step("unmaximize");
    this.maximized = false;
  }
  restore() {
    this.step("restore");
    this.minimized = false;
  }
  setOpacity(v: number) {
    this.step("setOpacity", String(v));
    this.opacity = v;
  }
  show() {
    this.step("show");
    this.visible = true;
  }
  hide() {
    this.step("hide");
    this.visible = false;
    this.focused = false;
  }
  focus() {
    this.step("focus");
    this.focused = true;
  }
}

function setup(editorOptions?: FakeOptions, overlayOptions?: FakeOptions) {
  const editor = new FakeWindow(editorOptions);
  let overlay: FakeWindow | null = null;
  let created = 0;
  let load!: () => void;
  let handle: OverlayHandle | null = null;
  const state = { editorGone: false };
  const choreography = createChoreography({
    editor: () => (state.editorGone ? null : editor),
    overlay: () => {
      if (!handle || handle.window.isDestroyed()) {
        created++;
        overlay = new FakeWindow({ bounds: { x: 0, y: 0, width: 800, height: 600 }, ...overlayOptions });
        overlay.visible = false;
        handle = { window: overlay, loaded: new Promise<void>((r) => (load = r)) };
      }
      return handle;
    },
  });
  return { editor, choreography, state, overlay: () => overlay!, created: () => created, load: () => load() };
}

/** Hide the editor with the overlay page already loaded. */
async function hide(s: ReturnType<typeof setup>) {
  const p = s.choreography.hideEditor();
  s.load();
  await p;
}

describe("hideEditor", () => {
  it("makes the editor transparent, moves it off-screen, then hides it: no ghost in the capture", async () => {
    const s = setup();
    await hide(s);
    expect(s.editor.log).toEqual(["setOpacity 0", `setPosition ${OFF_SCREEN.x},${OFF_SCREEN.y}`, "hide"]);
    expect(OFF_SCREEN).toEqual({ x: -32000, y: -32000 });
    expect(s.editor.visible).toBe(false);
  });

  it("opens the overlay window hidden and resolves only once its page has loaded", async () => {
    const s = setup();
    let done = false;
    const p = s.choreography.hideEditor().then(() => (done = true));
    await Promise.resolve();
    await Promise.resolve();
    expect(s.editor.visible).toBe(false); // the editor does not wait for the overlay
    expect(s.created()).toBe(1);
    expect(s.overlay().visible).toBe(false);
    expect(s.overlay().log).toEqual([]);
    expect(done).toBe(false);
    s.load();
    await p;
    expect(done).toBe(true);
  });

  it("still hides when the window cannot be moved or made transparent", async () => {
    const s = setup({ fail: { setPosition: "not allowed" } });
    await hide(s);
    expect(s.editor.visible).toBe(false);
  });

  it("a failed hide is reported with the fix; a missing editor too", async () => {
    const s = setup({ fail: { hide: "window gone" } });
    await expect(s.choreography.hideEditor()).rejects.toThrow("Could not hide the editor (window gone) — restart Collide and try again.");
    const gone = setup();
    gone.state.editorGone = true;
    await expect(gone.choreography.hideEditor()).rejects.toThrow("The main window is missing — restart Collide.");
    gone.state.editorGone = false;
    gone.editor.destroyed = true;
    await expect(gone.choreography.hideEditor()).rejects.toThrow("The main window is missing — restart Collide.");
  });
});

describe("showEditor", () => {
  it("restores position, size and opacity exactly, then shows and focuses", async () => {
    const start = { x: -1500, y: 120, width: 1111, height: 777 };
    const s = setup({ bounds: start, opacity: 1 });
    await hide(s);
    s.editor.log.length = 0;
    s.choreography.showEditor();
    expect(s.editor.log).toEqual(["setBounds -1500,120 1111x777", "show", "setOpacity 1", "focus"]);
    expect(s.editor.getBounds()).toEqual(start);
    expect(s.editor.getNormalBounds()).toEqual(start);
    expect(s.editor.opacity).toBe(1);
    expect(s.editor.maximized).toBe(false);
    expect([s.editor.visible, s.editor.focused]).toEqual([true, true]);
  });

  it("a maximized editor that stayed maximized through the move goes back to its maximized bounds", async () => {
    const maximizedBounds = { x: -8, y: -8, width: 1936, height: 1056 };
    const normal = { x: 200, y: 150, width: 1000, height: 700 };
    const s = setup({ bounds: maximizedBounds, normalBounds: normal, maximized: true });
    await hide(s);
    expect(s.editor.maximized).toBe(true);
    s.choreography.showEditor();
    expect(s.editor.getBounds()).toEqual(maximizedBounds);
    expect(s.editor.maximized).toBe(true);
    expect(s.editor.getNormalBounds()).toEqual(normal);
    expect(s.editor.log).not.toContain("maximize");
  });

  it("a maximized editor that the move un-maximized gets its normal bounds back and is maximized again", async () => {
    const normal = { x: 200, y: 150, width: 1000, height: 700 };
    const s = setup({ bounds: { x: -8, y: -8, width: 1936, height: 1056 }, normalBounds: normal, maximized: true, moveUnmaximizes: true });
    await hide(s);
    expect(s.editor.maximized).toBe(false);
    s.editor.log.length = 0;
    s.choreography.showEditor();
    expect(s.editor.log).toEqual(["setBounds 200,150 1000x700", "maximize", "show", "setOpacity 1", "focus"]);
    expect(s.editor.maximized).toBe(true);
    expect(s.editor.getNormalBounds()).toEqual(normal);
  });

  it("an editor that became maximized while hidden is un-maximized back to where it was", async () => {
    const start = { x: 40, y: 40, width: 900, height: 600 };
    const s = setup({ bounds: start });
    await hide(s);
    s.editor.maximize();
    s.choreography.showEditor();
    expect(s.editor.maximized).toBe(false);
    expect(s.editor.getBounds()).toEqual(start);
  });

  it("keeps a custom opacity", async () => {
    const s = setup({ opacity: 0.9 });
    await hide(s);
    expect(s.editor.opacity).toBe(0);
    s.choreography.showEditor();
    expect(s.editor.opacity).toBe(0.9);
  });

  it("a second hide before a show keeps the first, real, position", async () => {
    const start = { x: 100, y: 80, width: 1280, height: 800 };
    const s = setup({ bounds: start });
    await hide(s);
    await hide(s); // already off-screen and transparent
    s.choreography.showEditor();
    expect(s.editor.getBounds()).toEqual(start);
    expect(s.editor.opacity).toBe(1);
  });

  it("without a hide before it, only shows and focuses (the flow's recovery path); a minimized editor is restored", () => {
    const s = setup({ minimized: true });
    s.choreography.showEditor();
    expect(s.editor.log).toEqual(["restore", "show", "focus"]);
    expect(s.editor.minimized).toBe(false);
  });

  it("the saved place is used once: a later show does not move the editor again", async () => {
    const s = setup();
    await hide(s);
    s.choreography.showEditor();
    s.editor.setBounds({ x: 5, y: 5, width: 640, height: 480 }); // the user moved it
    s.editor.log.length = 0;
    s.choreography.showEditor();
    expect(s.editor.log).toEqual(["show", "focus"]);
    expect(s.editor.getBounds()).toEqual({ x: 5, y: 5, width: 640, height: 480 });
  });

  it("a window that cannot be moved back is still shown; a failed show or focus is reported with the fix", async () => {
    const stuck = setup({ fail: { setBounds: "busy" } });
    await hide(stuck);
    stuck.choreography.showEditor();
    expect([stuck.editor.visible, stuck.editor.opacity]).toEqual([true, 1]);

    expect(() => setup({ fail: { show: "no display" } }).choreography.showEditor()).toThrow("Could not show the editor (no display) — restart Collide and try again.");
    expect(() => setup({ fail: { focus: "denied" } }).choreography.showEditor()).toThrow("Could not focus the editor (denied) — restart Collide and try again.");
    const gone = setup();
    gone.state.editorGone = true;
    expect(() => gone.choreography.showEditor()).toThrow("The main window is missing — restart Collide.");
  });
});

describe("overlay window", () => {
  const display = { x: -1920, y: 0, width: 1920, height: 1080 };

  it("is placed on the given display bounds, then shown and focused", () => {
    const s = setup();
    s.choreography.showOverlay(display);
    expect(s.overlay().log).toEqual(["setBounds -1920,0 1920x1080", "show", "focus"]);
    expect(s.overlay().getBounds()).toEqual(display);
    expect([s.overlay().visible, s.overlay().focused]).toEqual([true, true]);
  });

  it("sets the bounds again if the first try did not take (a move to a display with other scaling)", () => {
    const s = setup(undefined, { firstSetBounds: { x: -1920, y: 0, width: 1536, height: 864 } });
    s.choreography.showOverlay(display);
    expect(s.overlay().log).toEqual(["setBounds -1920,0 1920x1080", "setBounds -1920,0 1920x1080", "show", "focus"]);
    expect(s.overlay().getBounds()).toEqual(display);
  });

  it("hideOverlay hides it; the same window is reused by the next snip", async () => {
    const s = setup();
    await hide(s);
    s.choreography.showOverlay(display);
    s.choreography.hideOverlay();
    expect(s.overlay().visible).toBe(false);
    s.choreography.showEditor();
    await hide(s);
    s.choreography.showOverlay({ x: 0, y: 0, width: 1280, height: 720 });
    expect(s.created()).toBe(1);
    expect(s.overlay().getBounds()).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
  });

  it("a destroyed overlay is opened again by the next snip", async () => {
    const s = setup();
    await hide(s);
    s.overlay().destroyed = true;
    s.choreography.showEditor();
    await hide(s);
    expect(s.created()).toBe(2);
    expect(s.overlay().destroyed).toBe(false);
  });

  it("failures name what failed and the fix", () => {
    expect(() => setup(undefined, { fail: { setBounds: "bad bounds" } }).choreography.showOverlay(display)).toThrow(
      "Could not position the overlay (bad bounds) — restart Collide and try again.",
    );
    expect(() => setup(undefined, { fail: { show: "no display" } }).choreography.showOverlay(display)).toThrow("Could not show the overlay (no display)");
    expect(() => setup(undefined, { fail: { focus: "denied" } }).choreography.showOverlay(display)).toThrow("Could not focus the overlay (denied)");
    expect(() => setup(undefined, { fail: { hide: "gone" } }).choreography.hideOverlay()).toThrow("Could not hide the overlay (gone) — restart Collide and try again.");
  });
});

describe("overlayBoundsFor", () => {
  const frame = (monitor: Frame["monitor"], bounds?: Rect): Frame => ({ png: new Uint8Array(1), monitor, display: bounds && { id: 1, bounds } });

  it("the captured monitor (physical px) maps to the captured display's own bounds, at 100 / 125 / 150 / 200%", () => {
    for (const scale of [1, 1.25, 1.5, 2]) {
      const monitor = { x: 0, y: 0, width: Math.round(1920 * scale), height: Math.round(1080 * scale), scaleFactor: scale };
      const display = { x: 0, y: 0, width: 1920, height: 1080 };
      expect(overlayBoundsFor(frame(monitor, display), { x: 0, y: 0, width: monitor.width, height: monitor.height }), `${scale}`).toEqual(display);
    }
  });

  it("a monitor left of the primary keeps its negative origin, taken from the display and not from dividing", () => {
    // A 150% monitor left of a 100% primary: physical origin -2880, DIP origin -1920.
    const monitor = { x: -2880, y: 0, width: 2880, height: 1620, scaleFactor: 1.5 };
    const display = { x: -1920, y: 0, width: 1920, height: 1080 };
    expect(overlayBoundsFor(frame(monitor, display), { x: -2880, y: 0, width: 2880, height: 1620 })).toEqual(display);
    // The same monitor placed by the platform at a DIP origin that is not physical / scale.
    const odd = { x: -1920, y: 240, width: 1920, height: 1080 };
    expect(overlayBoundsFor(frame(monitor, odd), { x: -2880, y: 0, width: 2880, height: 1620 })).toEqual(odd);
  });

  it("without a held display, or for another rectangle, the request is scaled to DIP", () => {
    const monitor = { x: -2880, y: 0, width: 2880, height: 1620, scaleFactor: 1.5 };
    expect(overlayBoundsFor(frame(monitor), { x: -2880, y: 0, width: 2880, height: 1620 })).toEqual({ x: -1920, y: 0, width: 1920, height: 1080 });
    expect(overlayBoundsFor(frame(monitor, { x: 9, y: 9, width: 9, height: 9 }), { x: 0, y: 0, width: 300, height: 150 })).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(overlayBoundsFor(null, { x: 10, y: 20, width: 300, height: 150 })).toEqual({ x: 10, y: 20, width: 300, height: 150 });
  });

  it("refuses anything that is not a rectangle with a size", () => {
    for (const bad of [undefined, null, {}, "0,0,10,10", { x: 0, y: 0, width: 10 }, { x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 10, height: -1 }, { x: NaN, y: 0, width: 10, height: 10 }]) {
      expect(() => overlayBoundsFor(null, bad), JSON.stringify(bad)).toThrow("The overlay position is not valid — start a new snip.");
    }
  });
});
