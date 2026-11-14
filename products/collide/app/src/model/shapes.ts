import { z } from "zod";

export const SHAPE_TYPES = ["rect", "ellipse", "arrow", "text", "callout", "highlight"] as const;
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
};

const simple = (type: "rect" | "ellipse" | "highlight") =>
  z.object({ ...base, type: z.literal(type) });

export const ShapeSchema = z.discriminatedUnion("type", [
  simple("rect"),
  simple("ellipse"),
  simple("highlight"),
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
