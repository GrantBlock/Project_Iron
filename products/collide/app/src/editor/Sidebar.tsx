import { Badge, Input, NavItem, NavSection } from "../ds";

// Library pane. Placeholder content until the library task (Recent / Tags / Search),
// following design-system/ui_kits/snip-markup/Sidebar.jsx.
export function Sidebar({ current }: { current: { name: string; meta: string } | null }) {
  return (
    <div
      data-testid="sidebar"
      style={{
        width: "var(--layout-sidebar)",
        flex: "none",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 12,
        borderRight: "1px solid var(--line-1)",
        boxSizing: "border-box",
      }}
    >
      <Input icon="search" size="sm" placeholder="Search notes…" />
      <NavSection title="Recent">
        {current ? (
          <NavItem thumb active label={current.name} meta={current.meta} />
        ) : (
          <div style={{ padding: "6px 10px", font: "var(--type-sm)", color: "var(--text-4)" }}>No markups yet</div>
        )}
      </NavSection>
      <NavSection title="Tags">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 10px" }}>
          <Badge>Line 3</Badge>
          <Badge>Conveyor</Badge>
          <Badge>P&ID</Badge>
        </div>
      </NavSection>
    </div>
  );
}
