import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CSP, CSP_DIRECTIVES } from "./csp";

const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

describe("content security policy", () => {
  it("allows only local sources: no http(s), ws(s) or wildcard anywhere", () => {
    expect(CSP).not.toMatch(/https?:|wss?:|\*/);
    const sources = CSP_DIRECTIVES.flatMap(([, value]) => value.split(" "));
    for (const source of sources) {
      expect(["'self'", "'none'", "'unsafe-inline'", "data:", "blob:"], source).toContain(source);
    }
    expect(Object.fromEntries(CSP_DIRECTIVES)).toMatchObject({
      "default-src": "'self'",
      "script-src": "'self'",
      "object-src": "'none'",
    });
  });

  it("index.html carries the same policy as the main process", () => {
    const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(indexHtml);
    expect(meta?.[1]).toBe(CSP);
  });

  it("index.html loads no remote resources", () => {
    expect(indexHtml).not.toMatch(/(src|href)="(https?:)?\/\//);
  });
});
