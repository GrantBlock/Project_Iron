// The left panel (RUN3 T31, Grant 2026-11-15): New snip with its delay toggle, Add snip with Current / Behind,
// Open, Search, then Recents (Today / Earlier: snips, and zip files with their folder trees) and Tags.
// After ../../../layout-prototype.html.
import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { Icon } from "../ds";
import { CollapseButton, Logo } from "./parts";
import { ADD_MODES, AURA_GROUNDS, SNIP_DELAYS, THEMES, type AddMode, type AuraGround, type Prefs, type Theme } from "./prefs";
import { filterRecents, groupRecents, recentTags, snipMeta, type RecentItem, type RecentZip, type TreeNode } from "./recents";

const DELAY_TITLE: Record<number, string> = { 0: "No delay", 3: "Wait 3 seconds", 5: "Wait 5 seconds", 10: "Wait 10 seconds" };
const ADD_TITLE: Record<AddMode, string> = {
  Current: "A screenshot of the program that is open",
  Behind: "Collide hides and you snip the screen behind it, like New snip",
};
const THEME_HINT: Record<Theme, string> = {
  system: "Follows Windows: Light or Dark.",
  light: "Collide Light. Draft (not yet approved by Grant).",
  dark: "Collide Dark, from the design system.",
  aura: "Aura: flat grounds, one highlight. Sage is the default.",
};
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** A row of choices where one is on: a toggle, not a drop-down (Grant 2026-11-15). */
function SegToggle<T extends string | number>({ label, value, options, onChange, testId }: { label: string; value: T; options: { value: T; text: string; title: string }[]; onChange: (v: T) => void; testId?: string }) {
  const pick = (e: ReactKeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = options[(i + d + options.length) % options.length];
    onChange(next.value);
    (e.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined)?.focus();
  };
  return (
    <span className="segtog" role="radiogroup" aria-label={label} data-testid={testId} data-value={String(value)}>
      {options.map((o, i) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} tabIndex={o.value === value ? 0 : -1} title={o.title} onClick={() => onChange(o.value)} onKeyDown={(e) => pick(e, i)}>
          {o.text}
        </button>
      ))}
    </span>
  );
}

export interface SidebarProps {
  prefs: Prefs;
  onDelay: (seconds: number) => void;
  onAddMode: (m: AddMode) => void;
  onTheme: (t: Theme) => void;
  onAura: (a: AuraGround) => void;
  onCollapse: () => void;
  onNewSnip: () => void;
  onAddSnip: () => void;
  onOpen: () => void;
  onSettings: () => void;
  rows: readonly RecentItem[];
  query: string;
  onQuery: (q: string) => void;
  /** Open zips and folders, by id or path. */
  openFolders: ReadonlySet<string>;
  onToggleFolder: (id: string) => void;
  /** The Recents row and file of the tab in front. */
  activeOwner: string | null;
  activeFile: string | null;
  onOpenItem: (item: RecentItem) => void;
  onOpenFile: (zip: RecentZip, path: string) => void;
  onDelete: (item: RecentItem) => void;
  pop: boolean;
  onPop: (open: boolean) => void;
}

function Tree({ node, path, depth, zip, p }: { node: TreeNode; path: string; depth: number; zip: RecentZip; p: SidebarProps }): ReactNode {
  return (node.kids ?? []).map((k) => {
    const at = `${path}/${k.name}`;
    if (k.kids) {
      const open = p.openFolders.has(at);
      return (
        <div key={at}>
          <button type="button" className={`node${open ? " open" : ""}`} style={{ paddingLeft: 6 + depth * 12 }} aria-expanded={open} onClick={() => p.onToggleFolder(at)}>
            <Icon name="chevron-right" size={14} className="chev" />
            <Icon name="folder" size={14} />
            <span>{k.name}</span>
          </button>
          {open && <Tree node={k} path={at} depth={depth + 1} zip={zip} p={p} />}
        </div>
      );
    }
    return (
      <button key={at} type="button" className={`node${p.activeFile === at ? " active" : ""}`} style={{ paddingLeft: 24 + depth * 12 }} onClick={() => p.onOpenFile(zip, at)}>
        <Icon name={k.type === "image" ? "image" : k.type === "md" ? "file-text" : "file"} size={14} />
        <span>{k.name}</span>
      </button>
    );
  });
}

function Row({ item, p }: { item: RecentItem; p: SidebarProps }) {
  // Delete on a row asks first, like its bin button.
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "Delete") {
      e.preventDefault();
      p.onDelete(item);
    }
  };
  const bin = (
    <button type="button" className="del" title={`Delete ${item.name}`} aria-label={`Delete ${item.name}`} onClick={() => p.onDelete(item)}>
      <Icon name="trash-2" size={14} />
    </button>
  );
  if (item.kind === "snip") {
    return (
      <div className={`item${p.activeOwner === item.id ? " active" : ""}`}>
        <button type="button" className="open" onClick={() => p.onOpenItem(item)} onKeyDown={onKey}>
          <span className="thumb">{item.thumb ? <img src={item.thumb} alt="" /> : <Icon name="scissors" />}</span>
          <span style={{ minWidth: 0 }}>
            <span className="ttl">{item.name}</span>
            <span className="meta mono">{snipMeta(item)}</span>
          </span>
        </button>
        <span className="rowend">
          {bin}
          {item.saved === undefined ? null : item.saved ? (
            <span className="cloud" title="Saved on the server">
              <Icon name="cloud" size={14} />
            </span>
          ) : (
            <span className="cloud local" title="Only on this PC">
              <Icon name="cloud-upload" size={14} />
            </span>
          )}
        </span>
      </div>
    );
  }
  const open = p.openFolders.has(item.id);
  return (
    <>
      <div className="item">
        <button type="button" className="open" aria-expanded={open} onClick={() => p.onOpenItem(item)} onKeyDown={onKey}>
          <span className="thumb">
            <Icon name="package" />
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="ttl">{item.name}</span>
            <span className="meta mono">{item.meta}</span>
          </span>
        </button>
        <span className="rowend">
          {bin}
          <span className={`cloud${open ? " turned" : ""}`}>
            <Icon name="chevron-right" size={14} />
          </span>
        </span>
      </div>
      {open && (
        <div className="tree">
          <Tree node={item.tree} path={item.id} depth={0} zip={item} p={p} />
        </div>
      )}
    </>
  );
}

export function Sidebar(p: SidebarProps) {
  const { prefs } = p;
  const groups = groupRecents(filterRecents(p.rows, p.query));
  // Tags come from the snips in Recents (Grant 2026-11-17: no sample tags in the real app); none, no Tags section.
  const tags = recentTags(p.rows);
  const aura = prefs.theme === "aura";
  // Appearance closes on a click outside it (its own button toggles it).
  const foot = useRef<HTMLDivElement>(null);
  const { pop, onPop } = p;
  useEffect(() => {
    if (!pop) return;
    const down = (e: PointerEvent) => {
      if (e.target instanceof Node && !foot.current?.contains(e.target)) onPop(false);
    };
    window.addEventListener("pointerdown", down, true);
    return () => window.removeEventListener("pointerdown", down, true);
  }, [pop, onPop]);
  return (
    <aside className="side" aria-label="Recents" data-testid="sidebar">
      <div className="brand">
        <Logo />
        <span className="word">Collide</span>
        <button type="button" className="mode label" title={prefs.settings.mode === "server" ? "Server: this PC stores the snips, markups and zips" : "Connected to the server PC"} onClick={p.onSettings}>
          <span className="dot" />
          {prefs.settings.mode === "server" ? "Server" : "Connected"}
        </button>
        <CollapseButton small collapsed={prefs.collapsed} onCollapse={p.onCollapse} />
      </div>
      <div className="actions">
        <button type="button" className="btn primary" data-testid="new-snip" title="New snip (Ctrl+Alt+S)" onClick={p.onNewSnip}>
          <Icon name="scissors" />
          New snip
        </button>
        <SegToggle
          label="Delay before New snip captures"
          testId="snip-delay"
          value={prefs.snipDelay}
          onChange={p.onDelay}
          options={SNIP_DELAYS.map((d) => ({ value: d as number, text: `${d}s`, title: `${DELAY_TITLE[d]}, then capture` }))}
        />
        <button type="button" className="btn" title="Add a snip to the open canvas: Current = the program that is open; Behind = Collide hides and you snip the screen behind it" onClick={p.onAddSnip}>
          <Icon name="plus" />
          Add snip
        </button>
        <SegToggle label="Where Add snip captures" value={prefs.addMode} onChange={p.onAddMode} options={ADD_MODES.map((m) => ({ value: m, text: m, title: ADD_TITLE[m] }))} />
        <button type="button" className="btn wide" data-testid="open-markup" title="Open a saved markup" onClick={p.onOpen}>
          <Icon name="folder-open" />
          Open
        </button>
      </div>
      {!prefs.collapsed && (
        <>
        <label className="search">
          <Icon name="search" size={14} />
          <input placeholder="Search" aria-label="Search" value={p.query} onChange={(e) => p.onQuery(e.target.value)} />
        </label>
        <div className="scroll">
          {groups.map((g) => (
            <div key={g.day}>
              <div className="sec">
                <span className="label">{aura ? `${g.day} {${String(g.rows.length).padStart(2, "0")}}` : g.day}</span>
              </div>
              {g.rows.map((r) => (
                <Row key={r.id} item={r} p={p} />
              ))}
            </div>
          ))}
          {groups.length === 0 && (
            <p className="hint" style={{ padding: "12px 8px", margin: 0 }}>
              {p.query.trim() ? `Nothing matches "${p.query.trim()}".` : "No markups yet. New snip, or open an image, then Save."}
            </p>
          )}
          {tags.length > 0 && (
            <>
              <div className="sec">
                <span className="label">Tags</span>
              </div>
              <div className="tags">
                {tags.map((t) => (
                  <button key={t} type="button" className="tag" onClick={() => p.onQuery(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        </>
      )}
      <div className="foot" ref={foot}>
        {pop && (
          <div className="pop" role="dialog" aria-label="Appearance">
            <span className="label">Theme</span>
            <div className="seg">
              {THEMES.map((t) => (
                <button key={t} type="button" aria-pressed={prefs.theme === t} onClick={() => p.onTheme(t)}>
                  {cap(t)}
                </button>
              ))}
            </div>
            {aura && (
              <>
                <span className="label">Aura ground · {prefs.aura}</span>
                <div className="swatches">
                  {AURA_GROUNDS.map((a) => (
                    <button key={a} type="button" className="sw" data-aura-theme={a} title={a} aria-label={a} aria-pressed={prefs.aura === a} onClick={() => p.onAura(a)} />
                  ))}
                </div>
              </>
            )}
            <span className="hint">{THEME_HINT[prefs.theme]}</span>
          </div>
        )}
        <button type="button" className="btn ghost" aria-expanded={pop} onClick={() => onPop(!pop)}>
          <Icon name="palette" />
          Appearance
        </button>
        <span className="grow" />
        <button type="button" className="btn ghost icon" title="Settings and Connect" aria-label="Settings and Connect" onClick={p.onSettings}>
          <Icon name="settings" />
        </button>
      </div>
    </aside>
  );
}
