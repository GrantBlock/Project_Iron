Modal for confirmations and short forms. Primary action sits rightmost in the footer.
```jsx
<Dialog title="Export markup" description="Flattened PNG with callouts." onClose={close}
  footer={<><Button variant="ghost">Cancel</Button><Button variant="primary">Export</Button></>} />
```
