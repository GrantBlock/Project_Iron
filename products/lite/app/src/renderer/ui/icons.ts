// Line icons, copied from the prototype (P16-lite/index.html `IC` and inline SVGs; the
// design system's 24-unit grid, 1.6 stroke). Built with DOM calls, never innerHTML.

export const ICONS = {
  document: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  model: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5",
  note: "M5 4h14v16H5zM9 9h6M9 13h6",
  about: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01",
  chevron: "M9 6l6 6-6 6",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
  chat: "M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  send: "M12 19V5M6 11l6-6 6 6",
  minimize: "M5 12h14",
  maximize: "M6 6h12v12H6z",
  close: "M6 6l12 12M18 6L6 18",
  // L08 (shared shell.js icon set): Open folder, and files Lite lists but does not open.
  folder: "M3 6h6l2 2h10v11H3z",
  file: "M7 3h7l5 5v13H7zM14 3v5h5",
} as const;

export type IconName = keyof typeof ICONS;

const SVG = "http://www.w3.org/2000/svg";

/** An icon as the prototype draws it: `class="de-icon"`, round caps and joins, hidden from screen readers. */
export function icon(name: IconName, size = 16, options: { stroke?: number; plain?: boolean } = {}): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  if (!options.plain) svg.setAttribute("class", "de-icon");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", String(options.stroke ?? 1.6));
  if (!options.plain) {
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
  }
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", ICONS[name]);
  svg.appendChild(path);
  return svg;
}
