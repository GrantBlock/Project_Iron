const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload(); await p.waitForTimeout(400);
  await p.click('#side [data-snip="s-line3"]'); await p.waitForTimeout(400);
  const nums = () => p.evaluate(() => snipOf().shapes.filter(isCallout).map((s) => s.note.slice(0, 12) + '=' + calloutNo(snipOf(), s.n)).join(' | '));
  const n0 = await nums();
  const st = await (await p.$('#zoomer [data-image] rect')).boundingBox();
  await p.click('[data-tool="rect"]'); await p.mouse.move(st.x + 40, st.y + 160); await p.mouse.down(); await p.mouse.move(st.x + 90, st.y + 200, { steps: 3 }); await p.mouse.up();
  await p.keyboard.type('new one');
  const n1 = await nums();
  console.log(JSON.stringify({ errs, n0, n1 }));
  await b.close();
})();
