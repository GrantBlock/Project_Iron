// The Lite window. L01: an empty dark canvas.
// Later tasks build the prototype's layout inside this root (RUN.md): the title bar,
// then three panes (left: package and tree; center: path bar and viewer; right: the
// Assistant) and, under 900px, the Files / View / Assistant tabs. Each part lives in
// its own module under src/renderer/ and is mounted from here.

/** Builds the app inside `root`, replacing whatever was there. Returns the app's element. */
export function mountApp(root: HTMLElement): HTMLElement {
  const app = document.createElement("div");
  app.className = "lite";
  app.dataset.testid = "app-root";
  root.replaceChildren(app);
  return app;
}
