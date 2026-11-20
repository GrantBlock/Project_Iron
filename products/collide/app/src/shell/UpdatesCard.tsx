// Settings → Updates (Grant 2026-11-17): the running version, the update state, Check now, Restart to update and
// "check automatically". The installed app gets updates from Collide's release folder on Cloudflare (src/native/updates.ts).
import { useEffect, useState } from "react";
import { Icon } from "../ds/Icon";
import type { CollideBridge, UpdateStatus } from "../native/bridge";

/** What the card says for each state; pure, so it is unit-tested. */
export function updateLine(s: UpdateStatus): string {
  switch (s.state) {
    case "checking":
      return "Checking for updates…";
    case "none":
      return `Collide ${s.current} is the newest version.`;
    case "available":
    case "downloading":
      return `Downloading Collide ${s.version ?? "update"}${s.percent !== null ? ` · ${s.percent}%` : ""}…`;
    case "ready":
      return `Collide ${s.version ?? "update"} is ready. Restart to update, or it installs the next time you close Collide.`;
    case "error":
    case "unsupported":
      return s.message ?? "Updates are not available.";
    default:
      return s.auto ? "Collide checks for updates when it starts and every few hours." : "Automatic checks are off. Use Check now.";
  }
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null);

export function UpdatesCard({ bridge = typeof window !== "undefined" ? window.collide : undefined }: { bridge?: Pick<CollideBridge, "updates"> }) {
  const updates = bridge?.updates;
  const [s, setS] = useState<UpdateStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!updates) return;
    let alive = true;
    updates.status().then(
      (v) => alive && setS(v),
      (e: unknown) => alive && setErr(e instanceof Error ? e.message : String(e)),
    );
    const off = updates.onStatus((v) => setS(v));
    return () => {
      alive = false;
      off();
    };
  }, [updates]);
  const run = (p: Promise<unknown>) => p.then(() => setErr(null), (e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  const busy = s?.state === "checking" || s?.state === "downloading";
  const canCheck = !!s && s.state !== "unsupported";
  return (
    <section className="card" data-section="updates" aria-labelledby="set-updates">
      <h3 id="set-updates">
        <Icon name="refresh-cw" size={14} />
        Updates
      </h3>
      {!updates ? (
        <span>Updates work in the installed Collide app.</span>
      ) : !s ? (
        <span className="hint">{err ?? "Loading…"}</span>
      ) : (
        <>
          <span data-testid="update-version">
            Version <b>{s.current}</b>
          </span>
          <span role="status" data-testid="update-line">
            {updateLine(s)}
          </span>
          {s.state === "downloading" && s.percent !== null && <progress max={100} value={s.percent} aria-label="Update download" style={{ width: "100%" }} />}
          {err && <span className="hint">{err}</span>}
          {canCheck && (
            <div className="btnrow">
              {s.state === "ready" ? (
                <button type="button" className="btn primary" onClick={() => void run(updates.install())}>
                  <Icon name="rotate-cw" size={14} />
                  Restart to update
                </button>
              ) : (
                <button type="button" className="btn" disabled={busy} onClick={() => void run(updates.check())}>
                  <Icon name="refresh-cw" size={14} />
                  Check now
                </button>
              )}
            </div>
          )}
          {canCheck && (
            <label className="radio">
              <input type="checkbox" checked={s.auto} onChange={(e) => void run(updates.setAuto(e.target.checked))} /> Check for updates automatically
            </label>
          )}
          {s.lastChecked && <span className="hint">Last checked {when(s.lastChecked)}</span>}
        </>
      )}
    </section>
  );
}
