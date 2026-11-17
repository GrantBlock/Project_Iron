// The main-process bundle (dist-electron/native.cjs), loaded by electron/main.cjs.
// Electron's modules are passed in from main.cjs, never imported here, so all of this is unit-tested in Node.
export { APP_NAME, APP_URL, CANVAS_COLOR, SCHEME, WINDOW_SIZE, devServerUrl, distFile, sameOrigin, windowOptions } from "./shell";
export { CSP } from "./csp";
export { blockedLine, createRequestGuard, isLocalRequest } from "./network";
