const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const out = process.argv[3];
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack||'').split('\n')[1]));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try{localStorage.clear()}catch(e){} }); await p.reload(); await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('[data-file]')].find(x => x.dataset.file.includes('P06')).click()); await p.waitForTimeout(400);
  await p.click('.viewseg [data-view="code"]'); await p.waitForTimeout(200);
  // put cursor on line "The project workspace holds..." (line index 6) and apply tools
  await p.evaluate(() => { const ta = document.querySelector('#src'); const i = ta.value.indexOf('The project workspace'); ta.focus(); ta.setSelectionRange(i, i); });
  await p.selectOption('#mdHeading', '3');
  await p.evaluate(() => { const ta = document.querySelector('#src'); const i = ta.value.indexOf('[placeholder]\n', ta.value.indexOf("Grant's notes")); ta.focus(); ta.setSelectionRange(i + 14, i + 14); });
  await p.click('#mdTable');
  await p.evaluate(() => { const ta = document.querySelector('#src'); const i = ta.value.indexOf('Left: project'); ta.focus(); ta.setSelectionRange(i, i + 60); });
  await p.click('[data-mdline="1. "]');
  await p.click('[data-mdline="**Label:** "]');
  const src = await p.inputValue('#src');
  const um = await p.evaluate(() => !document.querySelector('.unsaved-mark').hidden);
  await p.click('#docTools'); const hidden = await p.evaluate(() => document.querySelector('#ws .toolbar').hidden); await p.click('#docTools');
  await p.click('#docFocus'); await p.waitForTimeout(200);
  const table = await p.evaluate(() => !!document.querySelector('#preview .mdtable table'));
  await p.screenshot({ path: out + '/ja.png' });
  await p.click('#docFocus');
  await p.click('.viewseg [data-view="preview"]'); await p.waitForTimeout(200);
  await p.keyboard.press('p'); const pg = await (await p.$('#page')).boundingBox(); await p.mouse.click(pg.x + 200, pg.y + 260);
  await p.screenshot({ path: out + '/jb.png' });
  console.log(JSON.stringify({ errs, um, hidden, table, snippet: src.split('\n').slice(4, 14) }));
  await b.close();
})();
