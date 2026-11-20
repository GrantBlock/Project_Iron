const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const out = process.argv[3];
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try{localStorage.clear()}catch(e){} }); await p.reload(); await p.waitForTimeout(400);
  await p.click('#side [data-snip="s-line3"]'); await p.waitForTimeout(300);
  await p.hover('#side [data-snip="s-line3"]'); await p.click('#side [data-del="snip:s-line3"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/ha.png' });
  await p.keyboard.press('Escape'); const kept = await p.evaluate(() => SNIPS.some(s => s.id === 's-line3'));
  await p.hover('#side [data-snip="s-line3"]'); await p.click('#side [data-del="snip:s-line3"]'); await p.click('#delYes'); await p.waitForTimeout(200);
  const gone = await p.evaluate(() => [SNIPS.some(s => s.id === 's-line3'), S.tabs.length, !!document.querySelector('.blank')]);
  await p.hover('#side [data-zip="z-notes"]'); await p.click('#side [data-del="zip:z-notes"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const zipGone = await p.evaluate(() => ZIPS.some(z => z.id === 'z-notes'));
  await p.screenshot({ path: out + '/hb.png' });
  console.log(JSON.stringify({ errs, kept, gone, zipGone }));
  await b.close();
})();
