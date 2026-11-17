// Small DOM helpers for the render modules (plain TypeScript and DOM, no framework).

export type Attrs = Record<string, string | number | boolean | undefined>;
export type Child = Node | string | null | undefined | false;

/**
 * Creates an element. `class` sets the class name; `true` sets an empty attribute; `false` and
 * `undefined` leave it out. Strings become text nodes (never parsed as HTML).
 */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (name === "class") node.className = String(value);
    else node.setAttribute(name, value === true ? "" : String(value));
  }
  append(node, children);
  return node;
}

export function append(parent: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    parent.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
}

/** A rendered area of the window: its element and how it follows the state. */
export interface Area<S> {
  readonly element: HTMLElement;
  render(state: S, previous: S | undefined): void;
}
