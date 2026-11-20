const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const out = process.argv[3];
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try{localStorage.clear(); localStorage.setItem('collide-proto-theme','dark')}catch(e){} }); await p.reload(); await p.waitForTimeout(400);
  await p.click('#side [data-snip="s-line3"]'); await p.waitForTimeout(500);
  // add 3 rectangles near the top-right so their bubbles collide
  const st = await (await p.$('#stage')).boundingBox();
  const img = await (await p.$('#zoomer [data-image] rect')).boundingBox();
  for (const [fx, fy] of [[0.86, 0.3], [0.9, 0.42], [0.88, 0.5]]) {
    await p.keyboard.press('r');
    await p.mouse.move(img.x + img.width * fx, img.y + img.height * fy); await p.mouse.down(); await p.mouse.move(img.x + img.width * fx + 20, img.y + img.height * fy + 14, { steps: 3 }); await p.mouse.up();
    await p.keyboard.type('Stack test note for the bubble'); await p.keyboard.press('Escape');
  }
  await p.keyboard.press('Control+0'); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/fa.png' });
  // drag bubble 2 near bubble 1 to test snapping
  const b1 = await (await p.$('#zoomer [data-box="1"] rect')).boundingBox();
  const b2 = await (await p.$('#zoomer [data-box="2"] rect')).boundingBox();
  await p.mouse.move(b2.x + 5, b2.y + 5); await p.mouse.down(); await p.mouse.move(b1.x + b1.width + 6 + 5, b1.y + 5 + 4, { steps: 6 }); await p.mouse.up();
  const r = await p.evaluate(() => { const nb = noteBoxes(snipOf()); return [nb[1].box, nb[2].box]; });
  await p.click('#copyImg'); const t = await p.textContent('#toast');
  await p.screenshot({ path: out + '/fb.png' });
  console.log(JSON.stringify({ errs, snapped: { b1: r[0], b2: r[1] }, toast: t }));
  await b.close();
})();
