const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload(); await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('[data-file]')].find((x) => x.dataset.file.includes('P06')).click()); await p.waitForTimeout(400);
  const k0 = await p.evaluate(() => [S.pageK, document.querySelector('#docZoomStat').textContent]);
  const pg = await (await p.$('#page')).boundingBox();
  const tx = pg.x + pg.width * 0.3, ty = pg.y + 150;
  const before = await p.evaluate(([x, y]) => pagePoint({ clientX: x, clientY: y }), [tx, ty]);
  await p.mouse.move(tx, ty);
  await p.keyboard.down('Control'); for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, -100); await p.waitForTimeout(60); } await p.keyboard.up('Control');
  const k1 = await p.evaluate(() => [S.pageK, document.querySelector('#docZoomStat').textContent]);
  const after = await p.evaluate(([x, y]) => pagePoint({ clientX: x, clientY: y }), [tx, ty]);
  // drawing still lines up after zoom
  await p.keyboard.press('r'); await p.mouse.move(tx, ty); await p.mouse.down(); await p.mouse.move(tx + 80, ty + 40, { steps: 3 }); await p.mouse.up();
  const m = await p.evaluate(() => { const x = S.ws.marks[S.ws.marks.length - 1]; return [Math.round(x.x), Math.round(x.y)]; });
  await p.screenshot({ path: process.argv[3] + '/oa.png' });
  await p.keyboard.press('Escape'); await p.keyboard.press('Control+0');
  const k2 = await p.evaluate(() => [S.pageK, document.querySelector('#docZoomStat').textContent]);
  console.log(JSON.stringify({ errs, k0, k1, k2, before, after, shapeAt: m }));
  await b.close();
})();
