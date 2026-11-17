// The Markdown editor's text tools (RUN3 T34), after ../../../layout-prototype.html (mdLinePrefix, the Table,
// Bold and Link buttons, paste and Insert image). Pure: each takes the text and the selection and returns the new
// text with the selection to put back.

export interface TextEdit {
  text: string;
  start: number;
  end: number;
}

/** What the line tools take off a line before they put their own prefix on: a heading, a list mark or a label. */
const LINE_MARK = /^(#{1,6}\s+|[-*]\s+|\d+\.\s+|\*\*[^*]+:\*\*\s*)/;
const strip = (l: string) => l.replace(LINE_MARK, "");

/** The start of the line `at` is in, and the end of the line `to` is in. */
function lineSpan(text: string, at: number, to: number): [number, number] {
  const a = at <= 0 ? 0 : text.lastIndexOf("\n", at - 1) + 1;
  const e = text.indexOf("\n", to);
  return [a, e < 0 ? text.length : e];
}

/**
 * Put `prefix` at the start of each selected line ("1. " numbers them). It replaces any heading, list mark or label
 * the line had. Toggles it off when every line already has it; a heading (`heading`) always replaces, and an empty
 * heading prefix ("Normal text") just takes the mark off. The cursor ends after the last changed line.
 */
export function linePrefix(text: string, start: number, end: number, prefix: string, heading = false): TextEdit {
  const [a, b] = lineSpan(text, start, end);
  const lines = text.slice(a, b).split("\n");
  const numbered = prefix === "1. ";
  const all = !heading && prefix !== "" && lines.every((l) => l.startsWith(prefix) || (numbered && /^\d+\.\s/.test(l)));
  const out = lines.map((l, i) => (all ? strip(l) : (numbered ? `${i + 1}. ` : prefix) + strip(l))).join("\n");
  const at = a + out.length;
  return { text: text.slice(0, a) + out + text.slice(b), start: at, end: at };
}

export const TABLE = "| Item | Owner | Status |\n| --- | --- | --- |\n| [item] | [owner] | [status] |\n";

/** A blank line before a block that goes in at `pos`, unless the text before already ends with one (or is empty). */
const blockLead = (before: string) => (before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "");

/** A three-column table at the cursor (replacing the selection), on its own lines. */
export function insertTable(text: string, start: number, end: number): TextEdit {
  const ins = blockLead(text.slice(0, start)) + TABLE;
  const at = start + ins.length;
  return { text: text.slice(0, start) + ins + text.slice(end), start: at, end: at };
}

/** Bold the selection (`**…**`); with nothing selected the cursor goes between the marks. */
export function bold(text: string, start: number, end: number): TextEdit {
  const sel = text.slice(start, end);
  const ins = `**${sel}**`;
  const at = sel ? start + ins.length : start + 2;
  return { text: text.slice(0, start) + ins + text.slice(end), start: at, end: at };
}

/** A link with the selection as its text ("link" when nothing is selected); the "url" part is selected to type over. */
export function link(text: string, start: number, end: number): TextEdit {
  const label = text.slice(start, end) || "link";
  const ins = `[${label}](url)`;
  const u = start + label.length + 3;
  return { text: text.slice(0, start) + ins + text.slice(end), start: u, end: u + 3 };
}

/** The Markdown for an image link. */
export const imageLink = (alt: string, rel: string) => `![${alt.replace(/[[\]]/g, "")}](${rel})`;

/**
 * An image link on its own line: at the cursor (Edit), or at the end of the file when `start` is null (Preview).
 * After a part line it starts a new paragraph; the cursor ends after the link's line.
 */
export function insertImageLink(text: string, start: number | null, end: number | null, line: string): TextEdit {
  if (start === null) {
    const out = `${text.replace(/\s*$/, "")}\n\n${line}\n`;
    return { text: out, start: out.length, end: out.length };
  }
  const before = text.slice(0, start);
  const ins = `${before && !before.endsWith("\n") ? "\n\n" : ""}${line}\n`;
  const at = start + ins.length;
  return { text: before + ins + text.slice(end ?? start), start: at, end: at };
}

/** A pasted image's file name in images/: `pasted-HHMMSS.png`, counted on when that name is taken. */
export function pastedName(taken: ReadonlySet<string>, now: Date = new Date()): string {
  let n = now.getHours() * 10000 + now.getMinutes() * 100 + now.getSeconds();
  const name = (k: number) => `pasted-${String(k).padStart(6, "0")}.png`;
  while (taken.has(name(n))) n++;
  return name(n);
}
