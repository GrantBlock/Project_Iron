import type { ZodIssue } from "zod";
import { AnnotationsSchema, SHAPE_TYPES, type AnnotationsDoc, type Shape } from "./shapes";

export type ParseResult = { ok: true; doc: AnnotationsDoc } | { ok: false; error: string };

const FIX = "check annotations.json";

/** "shapes[2].w" style path. */
export function formatPath(path: ReadonlyArray<PropertyKey>): string {
  let out = "";
  for (const seg of path) {
    out += typeof seg === "number" ? `[${seg}]` : out ? `.${String(seg)}` : String(seg);
  }
  return out || "(root)";
}

function describe(issue: ZodIssue): string {
  const path = formatPath(issue.path);
  switch (issue.code) {
    case "invalid_type": {
      const e = issue.expected === "int" ? "whole number" : issue.expected;
      return `${path} must be ${/^[aeiou]/.test(e) ? "an" : "a"} ${e} — ${FIX}`;
    }
    case "too_small":
      if (issue.origin === "array") {
        return `${path} must have ${String(issue.minimum)} numbers [x1, y1, x2, y2] — ${FIX}`;
      }
      return `${path} must be a number ${issue.inclusive ? "≥" : ">"} ${String(issue.minimum)} — ${FIX}`;
    case "invalid_value":
      if (issue.values.length === 1) {
        return `${path} must be ${JSON.stringify(issue.values[0])} — ${FIX}`;
      }
      return `${path} must be one of ${issue.values.map((v) => JSON.stringify(v)).join(", ")} — ${FIX}`;
    case "invalid_union":
      if (issue.path[issue.path.length - 1] === "type") {
        return `${path} must be one of ${SHAPE_TYPES.join(", ")} — ${FIX}`;
      }
      return `${path} is not a valid shape — ${FIX}`;
    default:
      return `${path}: ${issue.message} — ${FIX}`;
  }
}

/** Serialize a document to pretty-printed JSON for annotations.json. */
export function serialize(doc: AnnotationsDoc): string {
  return JSON.stringify(doc, null, 2);
}

/** Parse annotations.json text. Never throws. */
export function parse(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    const cause = e instanceof Error ? e.message : "unreadable text";
    return { ok: false, error: `annotations.json is not valid JSON (${cause}) — re-save the markup or restore a backup` };
  }
  const result = AnnotationsSchema.safeParse(raw);
  if (result.success) return { ok: true, doc: result.data };
  const issue = result.error.issues[0];
  return { ok: false, error: describe(issue) };
}

/** Next free callout number: highest existing + 1, starting at 1. */
export function nextCalloutNumber(shapes: readonly Shape[]): number {
  let max = 0;
  for (const s of shapes) if (s.callout !== undefined && s.callout > max) max = s.callout;
  return max + 1;
}
