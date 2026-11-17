// The content security policy: only the app's own files. No remote scripts, styles,
// fonts, images or connections. index.html carries the same policy in a <meta> tag
// (csp.test.ts checks they match) and the main process sends it as a header with
// every file it serves from lite://app/.
//
// 'self' is lite://app in the Electron app, and the Vite server in dev and in the
// browser specs. data: and blob: are local (pictures, fonts, workers made in the page).
// Inline styles are allowed: Vite's dev server injects CSS that way and the prototype
// sets style attributes. Inline scripts are not.
export const CSP_DIRECTIVES: ReadonlyArray<readonly [string, string]> = [
  ["default-src", "'self'"],
  ["script-src", "'self'"],
  ["style-src", "'self' 'unsafe-inline'"],
  ["img-src", "'self' data: blob:"],
  ["font-src", "'self' data:"],
  ["connect-src", "'self' data: blob:"],
  ["media-src", "'self' data: blob:"],
  ["worker-src", "'self' blob:"],
  ["object-src", "'none'"],
  ["frame-src", "'none'"],
  ["base-uri", "'none'"],
  ["form-action", "'none'"],
];

export const CSP = CSP_DIRECTIVES.map(([name, value]) => `${name} ${value}`).join("; ");
