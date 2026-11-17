import { z } from "zod";

export const SHAPE_TYPES = ["rect", "ellipse", "line", "point", "cross", "pen", "hl", "image", "arrow", "text", "callout", "highlight"] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];

const num = z.number().finite();

/** Added images are saved as `image-<n>.png` beside source.png (RUN3 T33). Nothing else is ever read or written. */
export const IMAGE_FILE = /^image-[1-9][0-9]{0,5}\.png$/;

/** T39: part of an image file as fractions of its width and height. */
export const CropSchema = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().gt(0).max(1), h: z.number().gt(0).max(1) })
  .refine((c) => c.x + c.w <= 1 + 1e-6 && c.y + c.h <= 1 + 1e-6, "The crop must stay inside the image.");
export type Crop = z.infer<typeof CropSchema>;

const base = {
  id: z.string().min(1),
  page: z.number().int().min(1).optional(),
  x: num,
  y: num,
  w: num.min(0),
  h: num.min(0),
  stroke: z.string().min(1),
  strokeWidth: num.min(0),
  callout: z.number().int().min(1).optional(),
  note: z.string().optional(),
  /** Where the user put the note box (image px, top-left + width). Absent = auto-placed. */
  label: z.object({ x: num, y: num, w: num.positive() }).optional(),
  /** Rect/ellipse only: solid fill in the stroke colour. */
  fill: z.boolean().optional(),
  /** "Hide #": the note box and arrow show dimmed in the editor and are left out of Copy/Export. */
  hideNumber: z.boolean().optional(),
  // T32 markup engine. All optional, so older annotations.json files still open.
  /** Line, pen and highlighter: points as x, y pairs, 0 to 1 inside the shape's box (so a resize scales them). */
  pts: z.array(num).optional(),
  /** Callout card toggles: hide the note text (keeps the number), the bubble and its leader, the outline. */
  hideText: z.boolean().optional(),
  hideBubble: z.boolean().optional(),
  hideOutline: z.boolean().optional(),
  /** Fill, percent 0 to 100 (0 = none). Replaces `fill`; an old filled shape reads as 30 %. */
  fillPct: num.min(0).max(100).optional(),
};

const simple = (type: "rect" | "ellipse" | "line" | "point" | "cross" | "pen" | "hl" | "highlight") =>
  z.object({ ...base, type: z.literal(type) });

export const ShapeSchema = z.discriminatedUnion("type", [
  simple("rect"),
  simple("ellipse"),
  simple("highlight"),
  // A straight line between its two `pts`.
  simple("line"),
  // Freehand pen and highlighter strokes (`pts`): in the list without a number or bubble.
  simple("pen"),
  simple("hl"),
  // A point marker at (x, y); w and h are 0.
  simple("point"),
  // An X across its bounds, marking something to remove.
  simple("cross"),
  // Arrow end points [x1, y1, x2, y2], relative to x,y (A).
  z.object({
    ...base,
    type: z.literal("arrow"),
    points: z.tuple([num, num, num, num]),
  }),
  z.object({
    ...base,
    type: z.literal("text"),
    text: z.string(),
    fontSize: num.positive(),
  }),
  // RUN3 T33: an image added with Add snip or paste. `src` names its file next to source.png in the markup folder
  // (listed in the document's `images`); x, y, w, h place it in image pixels. In the list without a number or bubble.
  // T39 (Grant 2026-11-17): `crop` keeps part of the file, as fractions of it (0..1); absent = the whole file.
  // The file stays whole, so Crop can widen the crop again later.
  z.object({ ...base, type: z.literal("image"), src: z.string().regex(IMAGE_FILE), crop: CropSchema.optional() }),
  // A callout marker always carries its number.
  z.object({ ...base, type: z.literal("callout"), callout: z.number().int().min(1) }),
]);

export const AnnotationsSchema = z.object({
  version: z.literal(1),
  source: z.object({
    kind: z.literal("image"),
    width: num.positive(),
    height: num.positive(),
  }),
  shapes: z.array(ShapeSchema),
  /** RUN3 T33: the added images' files and their size as captured. Optional, so older markups still open. */
  images: z.array(z.object({ file: z.string().regex(IMAGE_FILE), width: num.positive(), height: num.positive() })).optional(),
});

export type Shape = z.infer<typeof ShapeSchema>;
export type AnnotationsDoc = z.infer<typeof AnnotationsSchema>;
