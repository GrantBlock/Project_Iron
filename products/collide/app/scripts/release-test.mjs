/* global fetch */
// T51 (Grant 2026-11-20): upload a TEST build of Collide to Cloudflare R2 for Grant to try, without touching the live
// update feed. Modelled on release.mjs, but it uploads ONLY two files, only under `windows/test/`, and refuses any other
// key. It never uploads, overwrites or deletes latest.yml, Collide-Setup.exe, Collide-portable.exe or anything else in
// `windows/`. The live feed is Grant's call (`pnpm release`), not this script's.
//
//   node scripts/release-test.mjs --list   lists the bucket's windows/ folder (to prove the live files are unchanged)
//   node scripts/release-test.mjs          uploads the offline installer and the portable exe of package.json's version
//
// Needs CLOUDFLARE_API_TOKEN (in the cloud environment the proxy adds it: CLOUDFLARE_API_TOKEN=proxy-injected and
// NODE_USE_ENV_PROXY=1). CLOUDFLARE_ACCOUNT_ID is optional. Nothing secret is printed or written.
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BUCKET = "collide-releases";
const TEST_PREFIX = "windows/test/";
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

async function account() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID;
  const r = await (await fetch(`${API}/accounts`, { headers: auth })).json();
  if (!r.success || r.result.length !== 1) throw new Error("Set CLOUDFLARE_ACCOUNT_ID: the token sees no account or more than one.");
  return r.result[0].id;
}

async function list(id, prefix) {
  const out = [];
  let cursor = "";
  for (;;) {
    const q = new URLSearchParams({ prefix, per_page: "1000", ...(cursor ? { cursor } : {}) });
    const r = await (await fetch(`${API}/accounts/${id}/r2/buckets/${BUCKET}/objects?${q}`, { headers: auth })).json();
    if (!r.success) throw new Error(`Listing failed: ${JSON.stringify(r.errors)}`);
    out.push(...r.result);
    cursor = r.result_info?.cursor;
    if (!r.result_info?.is_truncated || !cursor) break;
  }
  return out;
}

const id = await account();

if (process.argv.includes("--list")) {
  for (const o of (await list(id, "windows/")).sort((a, b) => a.key.localeCompare(b.key))) {
    console.log(`${o.key}\t${o.size}\t${o.etag ?? ""}\t${o.last_modified ?? ""}`);
  }
  process.exit(0);
}

const files = [
  { from: join("release", `Collide-Setup-${version}-offline.exe`), as: `Collide-Setup-${version}-offline.exe` },
  { from: join("release", `Collide-${version}-portable.exe`), as: `Collide-portable-${version}.exe` },
];
for (const f of files) {
  try {
    statSync(f.from);
  } catch {
    console.error(`Missing ${f.from}: run pnpm dist and pnpm dist:offline first (version ${version}).`);
    process.exit(1);
  }
}
for (const f of files) {
  const key = TEST_PREFIX + f.as;
  // Guard: only plain file names directly under windows/test/.
  if (!key.startsWith(TEST_PREFIX) || f.as.includes("/") || /latest\.yml$/i.test(key)) throw new Error(`Refusing key ${key}`);
  const body = readFileSync(f.from);
  const headers = { ...auth, "Content-Type": "application/vnd.microsoft.portable-executable", "Cache-Control": "no-cache" };
  const res = await fetch(`${API}/accounts/${id}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`, { method: "PUT", headers, body });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.success === false) throw new Error(`Upload of ${key} failed (${res.status}): ${JSON.stringify(out.errors ?? out)}`);
  console.log(`uploaded ${key} (${(body.length / 1048576).toFixed(1)} MB)`);
  console.log(`  ${feed}/test/${f.as}`);
}
