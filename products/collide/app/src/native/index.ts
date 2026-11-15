// Entry of the main-process bundle (`pnpm build:electron` -> dist-electron/native.cjs),
// loaded by electron/main.cjs. Nothing here imports Electron or Node modules:
// main.cjs passes them in.
export { registerBridge } from "./ipc";
export { SNIP_REQUEST_CHANNEL } from "./bridge";
export { APP_NAME, devServerUrl, distFile, sameOrigin } from "./shell";
export { createChoreography } from "./windows";
export { setupHotkey } from "./settings";
export { copyImage } from "./clipboard";
export { createMarkups } from "./markups";
export { fakeCapturer } from "./fakeCapturer";
