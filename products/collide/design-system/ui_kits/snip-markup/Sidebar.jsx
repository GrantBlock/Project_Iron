function Sidebar({ files, current, setCurrent, query, setQuery }) {
  const { Input, NavItem, NavSection, Badge } = window.DS;
  const shown = files.filter(f => f.name.toLowerCase().includes(query.toLowerCase()));
  return <div style={{ width: 'var(--layout-sidebar)', flex: 'none', display: 'flex', flexDirection: 'column', gap: 20, padding: 12, borderRight: '1px solid var(--line-1)', boxSizing: 'border-box' }}>
    <Input icon="search" size="sm" placeholder="Search notes…" value={query} onChange={e => setQuery(e.target.value)} />
    <NavSection title="Recent">
      {shown.map(f => <NavItem key={f.id} thumb label={f.name} meta={f.meta()} active={f.id === current} onClick={() => setCurrent(f.id)} />)}
      {!shown.length && <div style={{ padding: '6px 10px', font: 'var(--type-sm)', color: 'var(--text-4)' }}>No matches</div>}
    </NavSection>
    <NavSection title="Tags"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 10px' }}><Badge>Line 3</Badge><Badge>Conveyor</Badge><Badge>P&ID</Badge></div></NavSection>
  </div>;
}
window.Sidebar = Sidebar;
