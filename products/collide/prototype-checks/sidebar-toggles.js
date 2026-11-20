const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  for (const th of ['light','aura']) {
    await p.goto('file://' + process.argv[2]); await p.evaluate((t) => { try{localStorage.clear(); localStorage.setItem('collide-proto-theme', t)}catch(e){} }, th); await p.reload(); await p.waitForTimeout(300);
    await p.click('[data-delay="5 s"]'); await p.click('[data-addmode="Behind"]');
    await p.screenshot({ path: process.argv[3] + '/k-' + th + '.png', clip: { x: 0, y: 0, width: 280, height: 160 } });
  }
  const st = await p.evaluate(() => [S.delay, S.addMode]);
  await p.reload(); await p.waitForTimeout(300); const kept = await p.evaluate(() => [S.delay, S.addMode]);
  await p.click('#newSnip'); await p.waitForTimeout(100); const t = await p.textContent('#toast');
  console.log(JSON.stringify({ errs, st, kept, t }));
  await b.close();
})();
