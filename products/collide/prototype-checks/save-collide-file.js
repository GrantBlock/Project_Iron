const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload(); await p.waitForTimeout(400);
  await p.click('#side [data-snip="s-line3"]'); await p.waitForTimeout(300);
  await p.click('#addSnip'); await p.waitForTimeout(600); // Add snip shows the drag box (2026-11-17): drag one.
  await p.mouse.move(300, 200); await p.mouse.down(); await p.mouse.move(900, 560, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(400);
  await p.click('#saveCollide'); const t1 = await p.textContent('#toast');
  const tb = await (await p.$('#ws .toolbar')).boundingBox(); await p.screenshot({ path: process.argv[3] + '/qa.png', clip: { x: tb.x + tb.width - 260, y: tb.y, width: 260, height: tb.height } });
  await p.evaluate(() => [...document.querySelectorAll('[data-file]')].find((x) => x.dataset.file.includes('P06')).click()); await p.waitForTimeout(300);
  await p.click('#saveCollide'); const t2 = await p.textContent('#toast');
  console.log(JSON.stringify({ errs, t1, t2 }));
  await b.close();
})();
