// The pieces of the layout shell (RUN3 T31), after ../../../layout-prototype.html:
// tab bar, tab header, blank canvas, the two ask-first splash screens, toasts, the Settings tab and a zip file's tab.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../ds";
// The logo is the design system's file, never redrawn or recoloured.
import logoUrl from "../../../design-system/assets/logo/favicon.svg?url";
import type { Settings } from "./prefs";
import type { Tab, TabKind } from "./tabs";

export const Logo = () => <img className="logo" src={logoUrl} alt="Collide" draggable={false} />;

const TAB_ICON: Record<TabKind, string> = { snip: "scissors", markdown: "file-text", image: "image", file: "file", settings: "settings" };
export const tabIcon = (kind: TabKind) => TAB_ICON[kind];

/** Tabs on the canvas: a dot for changed (amber) or saved (green), × or a middle click closes. */
export function TabBar({ tabs, active, onActivate, onClose }: { tabs: readonly Tab[]; active: string | null; onActivate: (id: string) => void; onClose: (id: string) => void }) {
  if (tabs.length === 0) return null;
  return (
    <div className="tabbar" role="tablist" aria-label="Open items">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab${t.id === active ? " on" : ""}`}
          role="tab"
          aria-selected={t.id === active}
          tabIndex={t.id === active ? 0 : -1}
          title={`${t.title}${t.dirty ? " · unsaved changes" : " · saved"}`}
          onClick={() => onActivate(t.id)}
          onKeyDown={(e) => {
            if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) onActivate(t.id);
          }}
          onMouseDown={(e) => {
            // A middle click closes; stop the browser's scroll cursor.
            if (e.button === 1) e.preventDefault();
          }}
          onAuxClick={(e) => {
            if (e.button === 1) onClose(t.id);
          }}
        >
          <Icon name={tabIcon(t.kind)} size={14} />
          <span className="tn">{t.title}</span>
          <span className={`sdot ${t.dirty ? "changed" : "saved"}`} role="img" aria-label={t.dirty ? "Unsaved changes" : "Saved"} />
          <button
            type="button"
            className="tx"
            aria-label={`Close ${t.title}`}
            title="Close (Ctrl+W)"
            onClick={(e) => {
              e.stopPropagation();
              onClose(t.id);
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export interface HeadProps {
  kind: TabKind;
  name: string;
  path: string;
  dirty: boolean;
  /** What the right-hand state says when nothing is unsaved. */
  savedLabel?: string;
  onSave?: () => void;
  canSave?: boolean;
  collapsed: boolean;
  onCollapse: () => void;
  onClose: () => void;
  /** Phone: opens Recents. */
  onMenu: () => void;
}

/** The header of the tab in front: what it is, saved or not, Save, collapse, Close. */
export function WsHead({ kind, name, path, dirty, savedLabel = "Saved", onSave, canSave, collapsed, onCollapse, onClose, onMenu }: HeadProps) {
  return (
    <div className="wshead">
      <button type="button" className="btn ghost icon mobile-only" aria-label="Recents" onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <span className="kind">
        <Icon name={tabIcon(kind)} />
      </span>
      <div className="names">
        <span className="name">
          {name}
          {dirty && (
            <span className="unsaved-mark">
              <span className="sdot changed" />
              unsaved
            </span>
          )}
        </span>
        <span className="path mono">{path}</span>
      </div>
      <span className="grow" />
      <span className={`savedstate${dirty ? " dirty" : ""}`}>
        <span className="d" />
        <span className="lbl">{dirty ? "Unsaved changes" : savedLabel}</span>
      </span>
      {onSave && (
        <button type="button" className="btn" data-testid="save-markup" title="Save (Ctrl+S)" disabled={!canSave} onClick={onSave}>
          <Icon name="save" />
          <span>Save</span>
        </button>
      )}
      <CollapseButton collapsed={collapsed} onCollapse={onCollapse} />
      <button type="button" className="btn" title="Close this tab (Ctrl+W)" onClick={onClose}>
        <Icon name="x" />
        <span>Close</span>
      </button>
    </div>
  );
}

export function CollapseButton({ collapsed, onCollapse, small }: { collapsed: boolean; onCollapse: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      className={small ? "btn ghost icon small" : "btn icon"}
      title={collapsed ? "Expand the window" : "Collapse: Recents moves to the right"}
      aria-label={collapsed ? "Expand window" : "Collapse window"}
      aria-pressed={collapsed}
      onClick={onCollapse}
    >
      <Icon name={collapsed ? "maximize-2" : "minimize-2"} size={small ? 14 : 16} />
    </button>
  );
}

/** Home: a blank canvas. */
export function Blank({ onNewSnip, onOpenFile, onMenu }: { onNewSnip: () => void; onOpenFile: () => void; onMenu: () => void }) {
  return (
    <div className="blank" data-testid="canvas">
      <button type="button" className="btn icon mobile-only menu" aria-label="Recents" onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <div className="in">
        <Logo />
        <b>Blank canvas</b>
        <span>New snip (Ctrl+Alt+S), open an image, or open a snip or a zip file from Recents. It fits to this canvas.</span>
        <div className="btnrow centre">
          <button type="button" className="btn primary" onClick={onNewSnip}>
            <Icon name="scissors" />
            New snip
          </button>
          <button type="button" className="btn" data-testid="open-file" onClick={onOpenFile}>
            <Icon name="file-up" />
            Open file
          </button>
        </div>
      </div>
    </div>
  );
}

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The splash banner: the prototype's block pattern (dots in Aura), drawn in the theme's ink with a few sparks. */
function Banner({ seed, themeKey }: { seed: number; themeKey: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const r = cv?.getBoundingClientRect();
    if (!cv || !r || !r.width) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    const ink = cssVar("--banner-ink");
    const spark = cssVar("--banner-spark");
    const ghost = cssVar("--canvas-dot");
    const aura = document.documentElement.dataset.appTheme === "aura";
    ctx.clearRect(0, 0, cv.width, cv.height);
    let x = seed * 9301 + 49297;
    const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
    const cell = Math.round((aura ? 7 : 5) * dpr);
    const cols = Math.ceil(cv.width / cell);
    const rows = Math.ceil(cv.height / cell);
    const solid = Math.floor(rows * 0.5);
    const top = Math.round(solid * 0.92);
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, cv.width, top * cell);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (j < top) {
          rnd();
          continue;
        }
        const wave = Math.sin((i / cols) * 6.28 * 1.5 + seed) * rows * 0.05;
        const depth = (j - solid - wave) / (rows - solid);
        const p = j < solid + wave ? 1 : Math.max(0, 1 - depth * 1.25) ** 2.2;
        const v = rnd();
        if (v < p) {
          ctx.fillStyle = j > solid + wave && v < p * 0.03 ? spark : ink;
          if (aura) {
            ctx.beginPath();
            ctx.arc(i * cell + cell / 2, j * cell + cell / 2, cell * 0.42, 0, 6.283);
            ctx.fill();
          } else ctx.fillRect(i * cell, j * cell, cell, cell);
        } else if (aura && ghost && v < p + 0.18) {
          ctx.fillStyle = ghost;
          ctx.beginPath();
          ctx.arc(i * cell + cell / 2, j * cell + cell / 2, cell * 0.16, 0, 6.283);
          ctx.fill();
        }
      }
    }
  }, [seed, themeKey]);
  return <canvas ref={ref} className="banner" />;
}

export interface SplashButton {
  label: string;
  variant?: "primary" | "danger" | "ghost";
  icon?: string;
  /** Has the cursor when the splash opens. */
  autoFocus?: boolean;
  onClick: () => void;
}

interface SplashProps {
  title: string;
  body: string;
  hint: string;
  buttons: SplashButton[];
  /** The amber "changed" dot beside the logo (the close splash). */
  changed?: boolean;
  seed: number;
  themeKey: string;
  /** Enter, when the cursor is not on a button. */
  onEnter: () => void;
  /** Esc. */
  onCancel: () => void;
}

/** Ask first, on a splash over the whole window. Esc cancels, Enter takes the named action, Tab stays inside. */
export function Splash({ title, body, hint, buttons, changed, seed, themeKey, onEnter, onCancel }: SplashProps) {
  const card = useRef<HTMLDivElement>(null);
  const live = useRef({ onEnter, onCancel });
  live.current = { onEnter, onCancel };
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    (el.querySelector<HTMLElement>("[data-autofocus]") ?? el).focus();
  }, []);
  useEffect(() => {
    // Capture phase, and nothing gets past: the editor underneath must not hear Delete, tool keys or Ctrl+Z.
    const key = (e: KeyboardEvent) => {
      e.stopPropagation();
      const onButton = e.target instanceof HTMLElement && !!e.target.closest("button");
      if (e.key === "Escape") {
        e.preventDefault();
        live.current.onCancel();
      } else if (e.key === "Enter" && !onButton) {
        e.preventDefault();
        live.current.onEnter();
      } else if (e.key === "Tab") {
        e.preventDefault();
        const b = [...(card.current?.querySelectorAll<HTMLElement>("button") ?? [])];
        const i = b.indexOf(document.activeElement as HTMLElement);
        b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length]?.focus();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  return (
    <div className="splash">
      <div ref={card} className="splashcard" role="alertdialog" aria-modal="true" aria-labelledby="splash-title" aria-describedby="splash-body" tabIndex={-1}>
        <Banner seed={seed} themeKey={themeKey} />
        <div className="sin">
          <Logo />
          {changed && <span className="sdot changed big" />}
          <h2 id="splash-title">{title}</h2>
          <p id="splash-body">{body}</p>
          <div className="btnrow">
            {buttons.map((b) => (
              <button key={b.label} type="button" className={`btn${b.variant ? ` ${b.variant}` : ""}`} data-autofocus={b.autoFocus ? "" : undefined} onClick={b.onClick}>
                {b.icon && <Icon name={b.icon} />}
                {b.label}
              </button>
            ))}
          </div>
          <span className="hint">{hint}</span>
        </div>
      </div>
    </div>
  );
}

export interface Notice {
  tone: "error" | "success";
  title: string;
  description: string;
}

/** Bottom centre: a short hint (what New snip is about to do) and the outcome of the last action. */
export function Toasts({ hint, notice, onDismiss }: { hint: string | null; notice: Notice | null; onDismiss: () => void }) {
  if (!hint && !notice) return null;
  return (
    <div className="toasts">
      {hint && (
        <div className="toast" role="status" data-testid="toast">
          {hint}
        </div>
      )}
      {notice && (
        <div className={`toast${notice.tone === "error" ? " error" : ""}`} role={notice.tone === "error" ? "alert" : "status"} data-testid="notice">
          <span className="txt">
            <b>{notice.title}</b>
            {notice.description ? ` · ${notice.description}` : ""}
          </span>
          <button type="button" className="tx" aria-label="Dismiss" onClick={onDismiss}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

const SECTIONS = [
  ["storage", "Storage"],
  ["mode", "This computer"],
  ["links", "Open from other computers"],
  ["access", "Access password"],
] as const;

interface SettingsProps {
  saved: Settings;
  onSave: (s: Settings) => void;
  onDirty: (dirty: boolean) => void;
  notify: (text: string) => void;
  head: (save: { onSave: () => void; canSave: boolean }) => ReactNode;
  /** The password typed this session. Never stored: there is no server to ask for it yet. */
  password: string;
  onPassword: (p: string) => void;
}

/** Settings: storage, this computer, links, access password. The layout only: the server comes later (T36). */
export function SettingsTab({ saved, onSave, onDirty, notify, head, password, onPassword }: SettingsProps) {
  const [draft, setDraft] = useState(saved);
  const dirty = draft.keep !== saved.keep || draft.mode !== saved.mode || draft.server !== saved.server;
  const live = useRef({ onDirty, onSave, draft, dirty });
  live.current = { onDirty, onSave, draft, dirty };
  useEffect(() => {
    live.current.onDirty(dirty);
  }, [dirty]);
  const save = () => {
    if (live.current.dirty) live.current.onSave(live.current.draft);
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const set = (patch: Partial<Settings>) => setDraft((d) => ({ ...d, ...patch }));
  const body = useRef<HTMLDivElement>(null);
  const goto = (id: string) => body.current?.querySelector(`[data-section="${id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  return (
    <div className="wsfill">
      {head({ onSave: save, canSave: dirty })}
      <div className="wsbody">
        <div className="settings" ref={body}>
          <section className="card" data-section="storage" aria-labelledby="set-storage">
            <h3 id="set-storage">
              <Icon name="folder" size={14} />
              Storage
            </h3>
            <span>
              Snips, markups, zip files and Markdown callouts are stored on the server PC: <code>%APPDATA%\Collide\</code> (A).
            </span>
            <label className="field">
              <span className="hint">Delete the oldest automatically after this many files</span>
              <input type="number" min={1} value={draft.keep} placeholder="[number of files]" onChange={(e) => set({ keep: e.target.value.replace(/\D/g, "") })} />
            </label>
            <span className="hint">On a Connected PC, new work is held only until it reaches the server, then the local copy is removed.</span>
          </section>
          <section className="card" data-section="mode" aria-labelledby="set-mode">
            <h3 id="set-mode">
              <Icon name="server" size={14} />
              This computer
            </h3>
            <label className="radio">
              <input type="radio" name="collide-mode" checked={draft.mode === "server"} onChange={() => set({ mode: "server" })} /> <b>Server</b>
              <span className="hint">stores the snips, markups and zips</span>
            </label>
            <label className="radio">
              <input type="radio" name="collide-mode" checked={draft.mode === "client"} onChange={() => set({ mode: "client" })} /> <b>Connected</b>
              <span className="hint">opens the server PC's Collide; capture and Copy stay on this PC</span>
            </label>
            {draft.mode === "client" && (
              <label className="field">
                <span className="hint">Server address</span>
                <input type="text" value={draft.server} placeholder="[server address]:3500" onChange={(e) => set({ server: e.target.value })} />
              </label>
            )}
            <div className="btnrow">
              <button type="button" className="btn" onClick={() => notify("Test connection needs the Collide server, which is not built yet")}>
                Test connection
              </button>
              <button type="button" className="btn primary" onClick={() => notify("Save and restart needs the Collide server, which is not built yet")}>
                Save and restart
              </button>
            </div>
            <span className="hint">
              {draft.mode === "client"
                ? `Connected to ${draft.server || "[server address]"}.`
                : "Running as the server. On the other computer, choose Connected and enter an address from Open from other computers."}{" "}
              Closing the window hides Collide to the tray so other computers stay connected.
            </span>
          </section>
          <section className="card" data-section="links" aria-labelledby="set-links">
            <h3 id="set-links">
              <Icon name="globe" size={14} />
              Open from other computers
            </h3>
            <div>
              <code>http://[this PC's network address]:3500</code>
            </div>
            <div>
              <code>http://[Tailscale address]:3500</code>
            </div>
            <div className="btnrow">
              <button type="button" className="btn" onClick={() => notify("The network link needs the Collide server, which is not built yet")}>
                <Icon name="copy" size={14} />
                Copy network link
              </button>
            </div>
            <span className="hint">Phones and browsers can open the link too (no screen capture).</span>
          </section>
          <section className="card" data-section="access" aria-labelledby="set-access">
            <h3 id="set-access">
              <Icon name="key" size={14} />
              Access password
            </h3>
            <label className="field">
              <span className="hint">Optional. Other computers, phones and browsers ask for it once.</span>
              <input type="password" value={password} placeholder="No password" autoComplete="off" onChange={(e) => onPassword(e.target.value)} />
            </label>
          </section>
        </div>
        <aside className="numbered" aria-label="Sections">
          <div className="head">
            <span className="label">Sections · {SECTIONS.length}</span>
          </div>
          <div className="list">
            {SECTIONS.map(([id, title], i) => (
              <button key={id} type="button" className="el" onClick={() => goto(id)}>
                <span className="num">{i + 1}</span>
                <span className="txt">{title}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export interface FileDoc {
  name: string;
  /** `<zip name>/folder/file` */
  path: string;
  type: "md" | "image" | "code";
  text: string;
}

/** A file from a zip. Read only for now: the Markdown editor and the image tab come with the Zip editor. */
export function FileTab({ doc, kind, head }: { doc: FileDoc; kind: TabKind; head: ReactNode }) {
  const markdown = kind === "markdown";
  return (
    <div className="wsfill">
      {head}
      <div className="filenote" role="toolbar" aria-label={markdown ? "Markdown tools" : "File tools"}>
        <span className="hint mono">Read only: {markdown ? "the Markdown editor is not built yet." : "this kind of file cannot be edited yet."}</span>
      </div>
      {doc.type === "image" ? (
        <div className="blank">
          <div className="in">
            <Icon name="image" size={24} />
            <b>{doc.name}</b>
            <span>The picture is inside the zip file. Opening zip files from disk is not built yet.</span>
          </div>
        </div>
      ) : (
        <pre className="filetext" tabIndex={0}>
          {doc.text}
        </pre>
      )}
      <div className="statusbar">
        <span>{markdown ? "Markdown" : doc.type === "image" ? "Image" : "Text"}</span>
        <span>{doc.type === "image" ? "" : `${doc.text.split("\n").length} lines`}</span>
      </div>
    </div>
  );
}
