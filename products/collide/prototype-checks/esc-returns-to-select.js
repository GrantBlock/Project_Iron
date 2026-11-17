const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try{localStorage.clear()}catch(e){} }); await p.reload(); await p.waitForTimeout(400);
  await p.click('#side [data-snip="s-line3"]'); await p.waitForTimeout(300);
  await p.keyboard.press('r'); await p.keyboard.press('Escape'); const a = await p.evaluate(() => S.tool);
  await p.keyboard.press('l'); const st = await (await p.$('#stage')).boundingBox();
  await p.mouse.move(st.x + 300, st.y + 300); await p.mouse.down(); await p.mouse.move(st.x + 400, st.y + 350, {steps:3}); await p.mouse.up();
  await p.keyboard.type('note'); await p.keyboard.press('Escape'); const b2 = await p.evaluate(() => [S.tool, document.activeElement.tagName]);
  await p.evaluate(() => [...document.querySelectorAll('[data-file]')].find(x => x.dataset.file.includes('P06')).click()); await p.waitForTimeout(300);
  await p.keyboard.press('c'); await p.keyboard.press('Escape'); const c = await p.evaluate(() => S.dtool);
  console.log(JSON.stringify({ errs, a, b2, c }));
  await b.close();
})();
