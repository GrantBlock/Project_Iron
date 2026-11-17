// Search this package (L05): plain text search over item titles, document pages and note
// text, as the prototype (`matches()` in P16-lite/index.html). Works on any list of
// { id, title, pages?, text? }, so L08 can feed files opened from disk into it.

/** Anything the search can look through: a title plus page texts (documents, PDFs) or a text (notes, Markdown). */
export interface Searchable {
  readonly id: string;
  readonly title: string;
  readonly pages?: readonly string[];
  readonly text?: string;
}

/** The query as the tree uses it: surrounding spaces dropped (the prototype trims). */
export function normalizeQuery(query: string): string {
  return query.trim();
}

/**
 * True when the item's title, pages or text contain the query, ignoring case. The query is
 * one phrase: several words match only in that order, as the prototype does. An empty query
 * matches everything. Pages are joined with a space, as in the prototype.
 */
export function matches(item: Searchable, query: string): boolean {
  const q = query.toLowerCase();
  if (!q) return true;
  if (item.title.toLowerCase().includes(q)) return true;
  if (item.pages && item.pages.join(" ").toLowerCase().includes(q)) return true;
  return item.text !== undefined && item.text.toLowerCase().includes(q);
}

/** The items that match the (normalized) query, in their order. */
export function filterItems<T extends Searchable>(items: readonly T[], query: string): T[] {
  const q = normalizeQuery(query);
  return items.filter((i) => matches(i, q));
}

/** Message the tree shows when a search finds nothing. */
export const NO_MATCHES = "Nothing in this package matches.";
