import React from "react";
import ReactDOM from "react-dom/client";
import "../../design-system/styles.css";
import "./shell/aura.css";
import "./shell/shell.css";
import { App } from "./App";
import { applyTheme, loadPrefs } from "./shell/prefs";

// The theme goes on <html> before the first paint, so the window does not flash another theme.
const prefs = loadPrefs();
applyTheme(prefs.theme, prefs.aura);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
