const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const out = process.argv[3];
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try{localStorage.clear(); localStorage.setItem('collide-proto-theme','aura')}catch(e){} }); await p.reload(); await p.waitForTimeout(400);
  await p.click('#side [data-snip="s-line3"]'); await p.waitForTimeout(400);
  await p.click('[data-tool="rect"]'); await p.click('[data-role="blue"]'); const a = await p.evaluate(() => S.tool);
  await p.click('#calloutList [data-sel="2"] .num'); const b2 = await p.evaluate(() => [S.tool, document.querySelector('[data-tool="select"]').getAttribute('aria-pressed'), S.sel]);
  await p.click('[data-tool="ellipse"]'); await p.click('#side [data-snip="s-hmi"]'); await p.waitForTimeout(200); const c = await p.evaluate(() => [S.ws.id, S.tool]);
  await p.evaluate(() => [...document.querySelectorAll('[data-file]')].find(x => x.dataset.file.includes('P06')).click()); await p.waitForTimeout(300);
  await p.click('[data-dtool="line"]'); await p.click('[data-dcolor="yellow"]'); const d1 = await p.evaluate(() => S.dtool);
  await p.click('#calloutList [data-sel="1"] textarea'); const d2 = await p.evaluate(() => [S.dtool, document.activeElement.dataset.note]);
  await p.screenshot({ path: out + '/ga.png' });
  console.log(JSON.stringify({ errs, a, b2, c, d1, d2 }));
  await b.close();
})();
