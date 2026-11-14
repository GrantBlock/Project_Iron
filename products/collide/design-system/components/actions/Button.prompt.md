Text button for actions; use `primary` once per view for the main commit (Save, Send, Snip), `secondary` glass for everything else.
```jsx
<Button variant="primary" icon="scissors">Snip</Button>
<Button>Export</Button>
<Button variant="outline" size="sm">14-day trial</Button>
```
- variants: primary · secondary · ghost · outline (pill) · danger
- sizes: sm 28 · md 34 · lg 42
- `icon` / `iconRight` take Lucide names.
