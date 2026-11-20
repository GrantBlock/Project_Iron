/* global fetch */
// Publish a Collide build to Cloudflare R2 (Grant 2026-11-17): the web installer, the app package it downloads, the
// portable exe, and latest.yml, which the installed app reads to find updates. Run `pnpm dist` first, then `pnpm release`.
//
// Needs a Cloudflare API token with Workers R2 Storage: Edit, as CLOUDFLARE_API_TOKEN (in the cloud environment the
// network proxy adds it: run with CLOUDFLARE_API_TOKEN=proxy-injected). CLOUDFLARE_ACCOUNT_ID is optional: without it
// the token's only account is used. Nothing secret is printed or written.
//
// Order matters: the package and installers go up first, latest.yml last, so no copy of Collide is told about a version
// whose files are not there yet. A stable Collide-Setup.exe and Collide-portable.exe always point at the newest build.
import { readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const BUCKET = "collide-releases";
const PREFIX = "windows";
const API = "https://api.cloudflare.com/client/v4";
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.error("Set CLOUDFLARE_API_TOKEN (in the cloud environment: CLOUDFLARE_API_TOKEN=proxy-injected).");
  process.exit(1);
}
const auth = { Authorization: `Bearer ${token}` };

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;
const feed = pkg.build.publish[0].url;
const web = join("release", "nsis-web");
const files = [
  { from: join(web, `collide-${version}-x64.nsis.7z`), type: "application/x-7z-compressed" },
  { from: join(web, `Collide-Setup-${version}.exe`), type: "application/vnd.microsoft.portable-executable" },
  { from: join(web, `Collide-Setup-${version}.exe`), as: "Collide-Setup.exe", type: "application/vnd.microsoft.portable-executable", fresh: true },
  { from: join("release", `Collide-${version}-portable.exe`), type: "application/vnd.microsoft.portable-executable" },
  { from: join("release", `Collide-${version}-portable.exe`), as: "Collide-portable.exe", type: "application/vnd.microsoft.portable-executable", fresh: true },
  { from: join(web, "latest.yml"), type: "text/yaml", fresh: true },
];
for (const f of files) {
  try {
    statSync(f.from);
  } catch {
    console.error(`Missing ${f.from}: run pnpm dist first (version ${version}).`);
    process.exit(1);
  }
}

async function account() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID;
  const r = await (await fetch(`${API}/accounts`, { headers: auth })).json();
  if (!r.success || r.result.length !== 1) throw new Error("Set CLOUDFLARE_ACCOUNT_ID: the token sees no account or more than one.");
  return r.result[0].id;
}

const id = await account();
for (const f of files) {
  const key = `${PREFIX}/${f.as ?? basename(f.from)}`;
  const body = readFileSync(f.from);
  const headers = { ...auth, "Content-Type": f.type, ...(f.fresh ? { "Cache-Control": "no-cache" } : {}) };
  const res = await fetch(`${API}/accounts/${id}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`, { method: "PUT", headers, body });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.success === false) throw new Error(`Upload of ${key} failed (${res.status}): ${JSON.stringify(out.errors ?? out)}`);
  console.log(`uploaded ${key} (${(body.length / 1048576).toFixed(1)} MB)`);
}
console.log(`\nCollide ${version} is published.`);
console.log(`Installer:  ${feed}/Collide-Setup.exe`);
console.log(`Portable:   ${feed}/Collide-portable.exe`);
console.log(`Update feed: ${feed}/latest.yml`);
