const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const out = process.argv[3];
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack||'').split('\n')[1]));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try{localStorage.clear()}catch(e){} }); await p.reload(); await p.waitForTimeout(400);
  // Snip: pen + highlighter
  await p.click('#side [data-snip="s-line3"]'); await p.waitForTimeout(400);
  const st = await (await p.$('#zoomer [data-image] rect')).boundingBox();
  await p.click('[data-tool="pen"]'); await p.mouse.move(st.x + 60, st.y + 200); await p.mouse.down();
  for (let i = 1; i <= 12; i++) await p.mouse.move(st.x + 60 + i * 8, st.y + 200 + Math.sin(i / 2) * 15);
  await p.mouse.up();
  await p.click('[data-tool="hl"]'); await p.mouse.move(st.x + 20, st.y + 30); await p.mouse.down(); await p.mouse.move(st.x + 200, st.y + 32, { steps: 8 }); await p.mouse.up();
  const snipShapes = await p.evaluate(() => snipOf().shapes.map(s => s.type + (s.pts ? ':' + s.pts.length : '')));
  // move the pen stroke
  await p.click('[data-tool="select"]'); await p.click('#calloutList [data-sel="5"] .typesel');
  const pb = await p.evaluate(() => { const s = snipOf().shapes.find(x => x.n === 5); return [s.x, s.pts[0][0]]; });
  const h = await (await p.$('#zoomer [data-hs="5"][data-h="se"]')).boundingBox();
  await p.mouse.move(h.x + 5, h.y + 5); await p.mouse.down(); await p.mouse.move(h.x + 60, h.y + 40, { steps: 4 }); await p.mouse.up();
  const pa = await p.evaluate(() => { const s = snipOf().shapes.find(x => x.n === 5); return [s.w, s.pts[s.pts.length - 1][0]]; });
  await p.screenshot({ path: out + '/la.png' });
  // Markdown: leaders + cards
  await p.evaluate(() => [...document.querySelectorAll('[data-file]')].find(x => x.dataset.file.includes('P06')).click()); await p.waitForTimeout(500);
  const doc0 = await p.evaluate(() => [document.querySelectorAll('#docOverlay [data-box]').length, document.querySelectorAll('#calloutList .ccard').length, !!document.querySelector('#calloutList [data-tog^="hideText"]')]);
  await p.keyboard.press('n'); const pg = await (await p.$('#page')).boundingBox();
  await p.mouse.move(pg.x + 100, pg.y + 400); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(pg.x + 100 + i * 12, pg.y + 400 + (i % 2) * 8); await p.mouse.up();
  await p.keyboard.type('Pen note on the page');
  await p.keyboard.press('Escape');
  // drag a bubble on the page
  const bb = await (await p.$('#docOverlay [data-box="1"] rect')).boundingBox();
  await p.mouse.move(bb.x + 8, bb.y + 6); await p.mouse.down(); await p.mouse.move(bb.x + 8, bb.y + 60, { steps: 4 }); await p.mouse.up();
  const moved = await p.evaluate(() => !!S.ws.marks.find(m => m.n === 1).box);
  await p.click('[data-tog="hideText:2"]'); const hid = await p.evaluate(() => !!S.ws.marks.find(m => m.n === 2).hideText);
  await p.screenshot({ path: out + '/lb.png' });
  await p.click('#docExport'); const t = await p.textContent('#toast');
  console.log(JSON.stringify({ errs, snipShapes, pb, pa, doc0, moved, hid, t, marks: await p.evaluate(() => S.ws.marks.map(m => m.type)) }));
  await b.close();
})();
