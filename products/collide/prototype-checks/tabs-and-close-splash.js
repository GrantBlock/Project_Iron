const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const out = process.argv[3];
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try{localStorage.clear()}catch(e){} }); await p.reload(); await p.waitForTimeout(400);
  await p.click('#side [data-snip="s-line3"]'); await p.waitForTimeout(300);
  await p.fill('[data-note="1"]', 'Changed note'); 
  await p.click('#side [data-snip="s-hmi"]'); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('[data-file]')].find(x => x.dataset.file.includes('P06')).click()); await p.waitForTimeout(300);
  await p.click('#settingsBtn'); await p.waitForTimeout(200);
  await p.click('[data-tabi="0"]'); await p.waitForTimeout(300);
  const note = await p.inputValue('[data-note="1"]');
  await p.screenshot({ path: out + '/ba-tabs.png' });
  await p.click('[data-tabclose="0"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/bb-splash.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  const still = await p.$$eval('.tab', t => t.length);
  await p.click('[data-tabclose="0"]'); await p.click('#discardClose'); await p.waitForTimeout(200);
  const after = await p.$$eval('.tab', t => t.length);
  for (let i = 0; i < 3; i++) { await p.click('[data-tabclose="0"]'); await p.waitForTimeout(100); }
  const blank = await p.$('.blank');
  console.log('errors', errs, 'note kept:', note, 'tabs after esc:', still, 'after discard:', after, 'blank:', !!blank);
  await b.close();
})();
