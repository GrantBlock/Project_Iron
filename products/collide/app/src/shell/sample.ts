// The prototype's sample Recents (RUN3 T31): the same three snips and two zip files as ../../../layout-prototype.html,
// so the reference specs see the same items in the app. Dev and test only: the shell loads them when the page
// address has `?sample` (the reference fixture passes it); the desktop app never does.
// Example content only: the pictures are drawn here, nothing is read from or written to disk.
import type { AnnotationsDoc, Shape } from "../model";
import type { RecentItem, RecentSnip, RecentZip } from "./recents";

/** Shapes are in the prototype's 640-wide drawing space; `sampleDoc` scales them to the picture. */
interface SampleShape {
  type: "rect" | "ellipse" | "point" | "cross";
  x: number;
  y: number;
  w: number;
  h: number;
  color: "red" | "blue" | "gray";
  note: string;
  fill?: true;
  hideBubble?: true;
}

export interface SampleSnip {
  id: string;
  art: "line3" | "hmi" | "pid";
  name: string;
  w: number;
  h: number;
  day: "Today" | "Earlier";
  saved: boolean;
  tags: string[];
  shapes: SampleShape[];
}

export const SAMPLE_SNIPS: SampleSnip[] = [
  {
    id: "s-line3", art: "line3", name: "Line 3 conveyor guard", w: 1280, h: 720, day: "Today", saved: false, tags: ["LINE 3", "CONVEYOR"],
    shapes: [
      { type: "rect", x: 214, y: 118, w: 96, h: 74, color: "red", note: "Guard bracket cracked at the weld. Re-weld before next PM." },
      { type: "ellipse", x: 398, y: 142, w: 82, h: 66, color: "red", note: "Belt tracking drifts toward the motor side." },
      { type: "rect", fill: true, x: 514, y: 66, w: 92, h: 34, color: "blue", note: "HMI label reads M-310. Should read M-301." },
      { type: "point", x: 300, y: 262, w: 0, h: 0, color: "gray", note: "" },
    ],
  },
  {
    id: "s-hmi", art: "hmi", name: "HMI header grid", w: 1920, h: 1080, day: "Today", saved: true, tags: ["LINE 3"],
    shapes: [
      { type: "rect", x: 60, y: 40, w: 160, h: 46, color: "red", note: "Start button sits 6 px off the header grid." },
      { type: "cross", x: 444, y: 40, w: 30, h: 30, color: "red", note: "Alarm count wraps at 150% scaling.", hideBubble: true },
    ],
  },
  {
    id: "s-pid", art: "pid", name: "P&ID V-101 tag", w: 2400, h: 1350, day: "Earlier", saved: true, tags: ["P&ID"],
    shapes: [{ type: "ellipse", fill: true, x: 250, y: 140, w: 92, h: 76, color: "blue", note: "Valve tag missing on the drawing." }],
  },
];

const P06 = `# P06 Project Workspace Spec

Draft (not yet approved by Grant). Built from prototype page P06.

## 1 Purpose

The project workspace holds Import, Specifications, Layout, Schedule and Exports for one project.

## 4 Desktop layout

- Left: project sections
- Centre: the open section
- Right: [placeholder] session panel

![Line 3 conveyor guard](images/line-3-conveyor-guard.png)

## 6 States

1. Empty project: "Import a drawing or a zip to start."
2. Importing: progress per file
3. Ready

## 11 Grant's notes

[placeholder]
`;

/** The prototype's two callouts on the P06 page (page pixels, 680 wide), numbered from the back. */
const P06_MARKS: Shape[] = [
  { id: "a1", type: "rect", x: 26, y: 132, w: 628, h: 30, stroke: "red", strokeWidth: 3, callout: 1, note: "Add Uploads to this list." },
  { id: "a2", type: "ellipse", x: 210, y: 236, w: 150, h: 46, stroke: "blue", strokeWidth: 3, callout: 2, note: "Name the session panel." },
];

export const SAMPLE_ZIPS: RecentZip[] = [
  {
    kind: "zip", id: "z-builder", name: "builder-v0.1.zip", meta: "14 files · 2.1 MB", day: "Today",
    tree: {
      name: "Builder v0.1",
      kids: [
        { name: "CLAUDE.md", type: "md", text: "# Working rules\n\n- Direct, concise, structured.\n- Mark assumptions (A) and placeholders [brackets].\n" },
        {
          name: "design",
          kids: [
            {
              name: "specs",
              kids: [
                { name: "P06-Project-Workspace-Spec.md", type: "md", text: P06, marks: P06_MARKS },
                { name: "P08-3D-Designer-Spec.md", type: "md", text: "# P08 3D Designer Spec\n\n## 1 Purpose\n\n[placeholder]\n" },
              ],
            },
            { name: "exports", kids: [{ name: "P06.png", type: "image" }, { name: "P08.png", type: "image" }] },
          ],
        },
        { name: "images", kids: [{ name: "line-3-conveyor-guard.png", type: "image", sample: "s-line3" }] },
        { name: "README.md", type: "md", text: "# Builder v0.1\n\nPrototype, specs and design system.\n" },
        { name: "package.json", type: "code", text: '{\n  "name": "builder",\n  "version": "0.1.0"\n}\n' },
      ],
    },
  },
  {
    kind: "zip", id: "z-notes", name: "collide-run-2-notes.zip", meta: "3 files · 48 KB", day: "Earlier",
    tree: {
      name: "collide-run-2-notes",
      kids: [
        { name: "RUN2.md", type: "md", text: "# Collide run 2 brief\n\nElectron first, then Collide Chat.\n" },
        { name: "HANDOFF.md", type: "md", text: "# Handoff\n\n[placeholder]\n" },
        { name: "board.png", type: "image" },
      ],
    },
  },
];

/** Folders of the sample zips that start open, as in the prototype. */
export const SAMPLE_OPEN = ["z-builder", "z-builder/design", "z-builder/design/specs"];

/** The prototype's drawing space is 640 wide. */
const IW = 640;

/** A sample snip's shapes as an annotations doc, in picture pixels, numbered from the back. */
export function sampleDoc(s: SampleSnip): AnnotationsDoc {
  const k = s.w / IW;
  const shapes = s.shapes.map(
    (sh, i): Shape => ({
      id: `a${i + 1}`,
      type: sh.type,
      x: sh.x * k,
      y: sh.y * k,
      w: sh.w * k,
      h: sh.h * k,
      stroke: sh.color,
      strokeWidth: 3,
      callout: i + 1,
      note: sh.note,
      ...(sh.fill ? { fill: true } : {}),
      ...(sh.hideBubble ? { hideBubble: true } : {}),
    }),
  );
  return { version: 1, source: { kind: "image", width: s.w, height: s.h }, shapes };
}

const snipRow = (s: SampleSnip): RecentSnip => ({
  kind: "snip",
  id: s.id,
  name: s.name,
  day: s.day,
  callouts: s.shapes.length,
  width: s.w,
  height: s.h,
  tags: s.tags,
  notes: s.shapes.map((x) => x.note).filter(Boolean),
  thumb: null,
  saved: s.saved,
  source: { from: "sample", sample: s.id },
});

/** The rows, snips first, in the prototype's order. A fresh copy each call. */
export const sampleRecents = (): RecentItem[] => [...SAMPLE_SNIPS.map(snipRow), ...SAMPLE_ZIPS.map((z) => ({ ...z }))];

export const sampleSnip = (id: string) => SAMPLE_SNIPS.find((s) => s.id === id) ?? null;

/** True when the page was opened with `?sample` (the reference fixture, or a developer trying the layout). */
export const wantsSample = (search: string = typeof location === "undefined" ? "" : location.search) => new URLSearchParams(search).has("sample");

const MONO = "'Geist Mono', ui-monospace, Menlo, Consolas, monospace";
const SANS = "'Geist', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Draw a sample picture into a 640 × 360 space (the prototype's placeholder art, simplified). */
function draw(c: CanvasRenderingContext2D, art: SampleSnip["art"]) {
  const rect = (x: number, y: number, w: number, h: number, fill: string) => {
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
  };
  const text = (t: string, x: number, y: number, fill: string, size: number, font = MONO) => {
    c.fillStyle = fill;
    c.font = `${size}px ${font}`;
    c.fillText(t, x, y);
  };
  if (art === "line3") {
    rect(0, 0, 640, 360, "#2b2f33");
    rect(0, 0, 640, 34, "#1d2023");
    text("LINE 3 · CONVEYOR C-3 · AUTO", 14, 22, "#cfd4d8", 13);
    rect(520, 70, 80, 26, "#3a3f44");
    text("M-310", 530, 88, "#e8b04a", 12);
    rect(40, 200, 560, 38, "#4a5056");
    c.fillStyle = "#6c737a";
    for (const x of [60, 120, 180, 240, 300, 360, 420, 480, 540, 580]) {
      c.beginPath();
      c.arc(x, 219, 13, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = "#c9c24a";
    c.lineWidth = 5;
    c.strokeRect(220, 124, 84, 58);
    rect(410, 150, 58, 50, "#5d6a74");
    text("M-301", 420, 180, "#dfe5ea", 12);
    rect(40, 266, 560, 8, "#3b4146");
    text("RATE 42 FT/MIN · 0 ALARMS", 14, 340, "#8b949b", 11);
  } else if (art === "hmi") {
    rect(0, 0, 640, 360, "#e9ecef");
    rect(0, 0, 640, 110, "#22313f");
    rect(66, 46, 150, 34, "#2e8a5e");
    text("START", 110, 68, "#ffffff", 14, SANS);
    rect(240, 40, 150, 34, "#a82410");
    text("STOP", 290, 62, "#ffffff", 14, SANS);
    rect(436, 44, 140, 34, "#e3a73a");
    text("ALARMS 12 ACT…", 448, 66, "#22313f", 12);
    c.strokeStyle = "#c9ced3";
    c.lineWidth = 1;
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 4; col++) {
        rect(40 + col * 145, 135 + r * 72, 125, 56, "#ffffff");
        c.strokeRect(40 + col * 145, 135 + r * 72, 125, 56);
      }
    }
  } else {
    rect(0, 0, 640, 360, "#f6f5f0");
    c.strokeStyle = "#1b1b1b";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(40, 180);
    c.lineTo(260, 180);
    c.moveTo(330, 180);
    c.lineTo(600, 180);
    c.moveTo(260, 160);
    c.lineTo(330, 200);
    c.lineTo(330, 160);
    c.lineTo(260, 200);
    c.closePath();
    c.moveTo(494, 180);
    c.arc(460, 180, 34, 0, Math.PI * 2);
    c.moveTo(460, 146);
    c.lineTo(460, 86);
    c.lineTo(540, 86);
    c.stroke();
    text("T-1", 440, 186, "#1b1b1b", 12);
    text('2"-PW-104', 46, 170, "#1b1b1b", 11);
  }
}

const made = new Map<string, string>();

/**
 * A sample snip's picture as a PNG data URL, `width` pixels wide (its own width when left out).
 * Null where a canvas cannot be drawn (unit tests).
 */
export function sampleArt(s: SampleSnip, width: number = s.w): string | null {
  const key = `${s.id}@${width}`;
  const had = made.get(key);
  if (had) return had;
  // jsdom has no canvas to draw on (and says so loudly).
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return null;
  try {
    const el = document.createElement("canvas");
    el.width = width;
    el.height = Math.round((width * s.h) / s.w);
    const c = el.getContext("2d");
    if (!c) return null;
    c.scale(width / IW, width / IW);
    draw(c, s.art);
    const url = el.toDataURL("image/png");
    made.set(key, url);
    return url;
  } catch {
    return null;
  }
}

