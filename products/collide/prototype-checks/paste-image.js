const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack||'').split('\n')[1]));
  await p.goto('file://' + process.argv[2]); await p.evaluate(() => { try{localStorage.clear()}catch(e){} }); await p.reload(); await p.waitForTimeout(400);
  const paste = () => p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#1E88E5'; x.fillRect(0, 0, 320, 200); x.fillStyle = '#fff'; x.font = '40px sans-serif'; x.fillText('PASTE', 90, 115);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'p.png', { type: 'image/png' }));
    (document.activeElement || document.body).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await paste(); await p.waitForTimeout(400);
  const a = await p.evaluate(() => [S.ws && S.ws.kind, snipOf().name, snipOf().w, snipOf().h]);
  await p.click('#side [data-snip="s-line3"]'); await p.waitForTimeout(300);
  await paste(); await p.waitForTimeout(500);
  const b2 = await p.evaluate(() => [snipOf().shapes.filter(s => s.type === 'image').length, !!snipOf().shapes.find(s => s.type === 'image').img, document.querySelectorAll('#zoomer image').length]);
  await p.screenshot({ path: process.argv[3] + '/ma.png' });
  await p.evaluate(() => [...document.querySelectorAll('[data-file]')].find(x => x.dataset.file.includes('P06')).click()); await p.waitForTimeout(400);
  await p.click('.viewseg [data-view="code"]'); await p.waitForTimeout(150);
  await p.evaluate(() => { const ta = document.querySelector('#src'); const i = ta.value.indexOf('## 6 States'); ta.focus(); ta.setSelectionRange(i, i); });
  await paste(); await p.waitForTimeout(400);
  const c = await p.evaluate(() => [document.querySelector('#src').value.includes('![Pasted image](images/pasted-'), !!document.querySelector('#preview figure img'), [...document.querySelectorAll('#side .node')].some(n => n.textContent.startsWith('pasted-'))]);
  await p.click('.viewseg [data-view="preview"]'); await p.waitForTimeout(200);
  await paste(); await p.waitForTimeout(400);
  const d = await p.evaluate(() => (S.ws.text.match(/Pasted image/g) || []).length);
  await p.screenshot({ path: process.argv[3] + '/mb.png' });
  // text paste is untouched
  await p.click('.viewseg [data-view="code"]'); await p.waitForTimeout(150);
  const e2 = await p.evaluate(() => { const ta = document.querySelector('#src'); ta.focus(); const dt = new DataTransfer(); dt.setData('text/plain', 'hello'); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); ta.dispatchEvent(ev); return ev.defaultPrevented; });
  console.log(JSON.stringify({ errs, a, b2, c, d, textPastePrevented: e2 }));
  await b.close();
})();
