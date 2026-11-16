import { z } from "zod";

export const SHAPE_TYPES = ["rect", "ellipse", "line", "point", "cross", "pen", "hl", "arrow", "text", "callout", "highlight"] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];

const num = z.number().finite();

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
});

export type Shape = z.infer<typeof ShapeSchema>;
export type AnnotationsDoc = z.infer<typeof AnnotationsSchema>;
