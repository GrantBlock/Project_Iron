// Add snip shows the drag box like New snip; image cards have Crop (Grant 2026-11-17).
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[3];
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload(); await p.waitForTimeout(400);
  await p.click('#side [data-snip="s-line3"]'); await p.waitForTimeout(400);
  const imgs = () => p.evaluate(() => snipOf().shapes.filter((x) => x.type === 'image').map((x) => ({ n: x.n, x: x.x, y: x.y, w: x.w, h: x.h, crop: x.crop })));
  const r = { errs };
  r.before = await imgs();
  // Add snip (Current): the drag box appears.
  await p.click('#addSnip'); await p.waitForTimeout(400);
  r.capShown = await p.isVisible('#cap');
  await p.screenshot({ path: out + '/cap-0.png' });
  // A click alone is not a snip.
  await p.mouse.click(300, 300); await p.waitForTimeout(100);
  r.capAfterClick = await p.isVisible('#cap');
  await p.mouse.move(200, 150); await p.mouse.down(); await p.mouse.move(700, 450, { steps: 5 });
  await p.screenshot({ path: out + '/cap-1.png' });
  r.readout = await p.textContent('#cap .capbox span');
  await p.mouse.up(); await p.waitForTimeout(500);
  r.capGone = !(await p.isVisible('#cap'));
  r.after = await imgs();
  // Esc cancels a second one.
  await p.click('#addSnip'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  r.escCancels = !(await p.isVisible('#cap')) && (await imgs()).length === r.after.length;
  await p.screenshot({ path: out + '/cap-2.png' });
  // Crop button on the image card.
  const n = r.after[r.after.length - 1].n;
  r.cropBtn = await p.isVisible(`[data-crop="${n}"]`);
  await p.click(`[data-crop="${n}"]`); await p.waitForTimeout(300);
  r.cropperShown = await p.isVisible('#cropper');
  await p.screenshot({ path: out + '/crop-0.png' });
  r.sizeLabel0 = await p.textContent('#cropSize');
  // Drag the se corner inward.
  const h = await (await p.$('#cropper .crophandle[data-ch="se"]')).boundingBox();
  await p.mouse.move(h.x + 7, h.y + 7); await p.mouse.down(); await p.mouse.move(h.x - 80, h.y - 40, { steps: 5 }); await p.mouse.up();
  r.sizeLabel1 = await p.textContent('#cropSize');
  await p.screenshot({ path: out + '/crop-1.png' });
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  r.cropperGone = !(await p.isVisible('#cropper'));
  r.afterCrop = (await imgs()).find((x) => x.n === n);
  // Reset widens back to the whole source; Esc in the cropper keeps the item.
  await p.click(`[data-crop="${n}"]`); await p.waitForTimeout(200); await p.click('#cropReset'); r.resetLabel = await p.textContent('#cropSize'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  r.escKept = JSON.stringify((await imgs()).find((x) => x.n === n)) === JSON.stringify(r.afterCrop);
  // Undo restores the uncropped image.
  await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
  r.undo = (await imgs()).find((x) => x.n === n);
  await p.screenshot({ path: out + '/crop-2.png' });
  // Paste-free check: existing base image unaffected, tool is Select.
  r.tool = await p.evaluate(() => S.tool);
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
