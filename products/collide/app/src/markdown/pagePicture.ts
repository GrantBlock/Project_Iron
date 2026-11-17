// A picture of the rendered Markdown page for Copy PNG and Export (RUN3 T34): the page's DOM with its computed
// styles written inline, drawn through an SVG foreignObject. No new dependency. Pictures in the page are data URLs,
// so nothing outside the page is loaded. Web fonts are not carried over: the picture uses the system's fonts.

/** The styles that make the page look as it does on screen. */
const PROPS = [
  "display", "box-sizing", "width", "min-width", "max-width", "height",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-top", "border-right", "border-bottom", "border-left", "border-radius", "border-collapse",
  "background-color", "color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
  "text-align", "text-decoration", "white-space", "word-break", "overflow-wrap", "list-style-type", "list-style-position",
  "vertical-align", "object-fit",
];

function inline(from: Element, to: Element) {
  const cs = getComputedStyle(from);
  const style = (to as HTMLElement).style;
  if (style) for (const p of PROPS) style.setProperty(p, cs.getPropertyValue(p));
  for (let i = 0; i < from.children.length; i++) inline(from.children[i], to.children[i]);
}

/** The page as a picture of its own size (CSS pixels, not transformed). */
export async function pagePicture(el: HTMLElement): Promise<HTMLImageElement> {
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const copy = el.cloneNode(true) as HTMLElement;
  inline(el, copy);
  copy.style.margin = "0";
  copy.style.transform = "none";
  const xml = new XMLSerializer().serializeToString(copy);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="${width}" height="${height}">${xml}</foreignObject></svg>`;
  const img = new Image(width, height);
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return img;
}
