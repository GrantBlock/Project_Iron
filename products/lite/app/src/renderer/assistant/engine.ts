// The Assistant's answer engine (L07): question in, answer with citations out. This run's
// engine is the prototype's canned one (no model, no network, RUN.md); a real on-device model
// can replace it later behind the same AnswerEngine interface (D12 open).
import { ASSISTANT_TEXT, cannedAnswer, type Source } from "../data/sample";

/** An answer. `[n]` in the text is a citation chip for `sources[n - 1]`; sources become the source rows. */
export interface Answer {
  readonly text: string;
  readonly sources: readonly Source[];
}

export interface AnswerEngine {
  answer(question: string): Promise<Answer>;
}

/**
 * The prototype's matching, exactly: the first canned answer whose keywords match the question,
 * otherwise the fallback with no sources. Quirks kept (ISSUES.md 1: "servicing" finds nothing;
 * ISSUES.md 2: the oil answer cites [1] twice, so it shows three chips).
 */
export function cannedAnswerFor(question: string): Answer {
  const hit = cannedAnswer(question);
  return hit ? { text: hit.text, sources: hit.sources } : { text: ASSISTANT_TEXT.fallback, sources: [] };
}

/** The canned engine: answers after the prototype's delay (350 ms). */
export function createCannedEngine(delayMs: number = ASSISTANT_TEXT.delayMs): AnswerEngine {
  return {
    answer(question) {
      const reply = cannedAnswerFor(question);
      return new Promise((resolve) => setTimeout(() => resolve(reply), delayMs));
    },
  };
}

/** A piece of answer text: plain text, or a citation chip (1-based source number). */
export type TextPiece = { readonly text: string } | { readonly cite: number };

/**
 * Splits answer text into text and chips, as the prototype's cites(): a single digit in square
 * brackets that names an existing source becomes a chip; anything else stays text.
 */
export function citationPieces(text: string, sourceCount: number): TextPiece[] {
  const pieces: TextPiece[] = [];
  let at = 0;
  for (const m of text.matchAll(/\[(\d)\]/g)) {
    const n = Number(m[1]);
    if (n < 1 || n > sourceCount) continue;
    const start = m.index ?? 0;
    if (start > at) pieces.push({ text: text.slice(at, start) });
    pieces.push({ cite: n });
    at = start + m[0].length;
  }
  if (at < text.length) pieces.push({ text: text.slice(at) });
  return pieces;
}
