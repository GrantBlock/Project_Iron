# Test hook: `window.__lite.state()`

Read-only. Reads the existing DOM and returns a plain object. Present in the prototype copy (one marked `<script>` block at the end of `<body>`) and, in L02 part 2, in the app. Specs use only this hook and visible UI.

```ts
{
  selected: {
    id: string | null,                       // "about", "d1".."d3", "m1".."m2", "n1".."n2"; null if the selected item is filtered out of the tree
    type: 'about' | 'document' | 'model' | 'note',
    title: string,                           // the view heading
    path: string                             // path bar text, e.g. "Palletizer retrofit / Process document, rev 3"; "About this package" for About
  },
  openFolders: string[],                     // names of the folders currently expanded (only folders shown in the tree)
  view: { type: 'about'|'document'|'model'|'note', page: number | null, pageCount: number | null }, // page is 1-based; null unless a document
  search: { query: string, matchCount: number, highlights: number }, // matchCount = items listed in the tree (7 when empty); highlights = <mark> count on the current page
  assistantShown: boolean,                   // right side visible and the Assistant button pressed
  tab: 'files' | 'view' | 'assistant' | null, // null above 900px
  messages: [{ role: 'user'|'assistant', text: string, citations: number }] // text excludes the "Assistant" label, citation chips and source rows; citations = numbered chips in the text (a repeated [1] counts each time)
}
```

Extra field in the prototype: `messages[].sources` (number of source rows). Optional for the app.
