function Inspector({ file, messages, onSend, thinking, model, setModel, onEditCallout }) {
  const { PanelHeader, Chip, IconButton, Select, Badge, Icon } = window.DS;
  const [text, setText] = React.useState('');
  const scroll = React.useRef(null);
  React.useEffect(() => { if (scroll.current) scroll.current.scrollTop = 1e6; }, [messages.length, thinking]);
  const send = t => { if (!t.trim()) return; onSend(t.trim()); setText(''); };
  return <div style={{ width: 'var(--layout-inspector)', flex: 'none', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--line-1)', minHeight: 0 }}>
    <PanelHeader title="Callouts"><Badge>{file.marks.length}</Badge></PanelHeader>
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflow: 'auto' }}>
      {file.marks.map((m, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ width: 18, height: 18, flex: 'none', marginTop: 1, borderRadius: 999, background: 'var(--steel-500)', color: '#fff', display: 'grid', placeItems: 'center', font: '600 10px/1 var(--font-mono)' }}>{m.n}</span>
        <input value={m.note} onChange={e => onEditCallout(i, e.target.value)} placeholder="Describe this callout…" style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', color: 'var(--text-1)', font: 'var(--type-sm)', padding: 0 }} />
      </div>)}
      {!file.marks.length && <div style={{ font: 'var(--type-sm)', color: 'var(--text-4)' }}>Draw on the image to add a callout.</div>}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 12px 12px', borderBottom: '1px solid var(--line-1)' }}>
      {['Punch list','Change request','Layout suggestions'].map(s => <Chip key={s} onClick={() => send('Turn these into a ' + s.toLowerCase() + '.')}>{s}</Chip>)}
    </div>
    <div ref={scroll} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ flex: 1 }} />
      {messages.map((m, i) => <div key={i} style={{ alignSelf: m.me ? 'flex-end' : 'flex-start', maxWidth: '88%', padding: '9px 11px', borderRadius: 'var(--radius-md)', font: 'var(--type-sm)', color: m.me ? 'var(--text-1)' : 'var(--text-2)', textWrap: 'pretty', whiteSpace: 'pre-line', border: '1px solid transparent', background: m.me ? 'linear-gradient(var(--surface-raised), var(--surface-raised)) padding-box, var(--glass-border) border-box' : 'linear-gradient(var(--ink-950), var(--ink-950)) padding-box, linear-gradient(var(--line-2), var(--line-1)) border-box' }}>{m.text}</div>)}
      {thinking && <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--type-sm)', color: 'var(--text-3)' }}><Icon name="loader" size={14} style={{ animation: 'spin 1s linear infinite' }} />Reading callouts…</div>}
    </div>
    <div style={{ padding: 10 }}>
      <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid transparent', background: 'linear-gradient(var(--surface-2), var(--surface-2)) padding-box, var(--glass-border) border-box', boxShadow: 'var(--shadow-2)', padding: '10px 8px 8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(text)} placeholder="Ask about this markup…" style={{ background: 'transparent', border: 0, outline: 'none', color: 'var(--text-1)', font: 'var(--type-sm)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconButton icon="paperclip" label="Attach" size="sm" />
          <Select size="sm" value={model} onChange={setModel} options={['Claude','Ollama (offline)']} />
          <span style={{ flex: 1 }} />
          <IconButton icon="arrow-up" label="Send" size="sm" variant="solid" onClick={() => send(text)} />
        </div>
      </div>
    </div>
  </div>;
}
window.Inspector = Inspector;
