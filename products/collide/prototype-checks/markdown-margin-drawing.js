const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload(); await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('[data-file]')].find((x) => x.dataset.file.includes('P06')).click()); await p.waitForTimeout(400);
  const pg = await (await p.$('#page')).boundingBox();
  const out = [];
  // rectangle starting left of the page, ending on it
  await p.keyboard.press('r'); await p.mouse.move(pg.x - 60, pg.y + 300); await p.mouse.down(); await p.mouse.move(pg.x + 80, pg.y + 360, { steps: 4 }); await p.mouse.up();
  out.push(await p.evaluate(() => { const m = S.ws.marks[S.ws.marks.length - 1]; return [m.type, Math.round(m.x), Math.round(m.w)]; }));
  // pen starting below-left in the margin
  await p.keyboard.press('Escape'); await p.keyboard.press('n'); await p.mouse.move(pg.x - 40, pg.y + 500); await p.mouse.down();
  for (let i = 1; i <= 6; i++) await p.mouse.move(pg.x - 40 + i * 12, pg.y + 500 + (i % 2) * 6);
  await p.mouse.up();
  out.push(await p.evaluate(() => { const m = S.ws.marks[S.ws.marks.length - 1]; return [m.type, Math.round(m.x)]; }));
  // select tool on the margin does nothing harmful
  await p.keyboard.press('Escape'); await p.keyboard.press('v'); await p.mouse.click(pg.x - 80, pg.y + 200);
  console.log(JSON.stringify({ errs, out, count: await p.evaluate(() => S.ws.marks.length) }));
  await b.close();
})();
