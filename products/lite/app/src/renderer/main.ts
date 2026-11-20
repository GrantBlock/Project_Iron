// Renderer entry: styles, then the app into #app.
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import { mountApp } from "./app";

const root = document.getElementById("app");
if (!root) throw new Error("Lite: #app is missing from index.html.");
mountApp(root);
