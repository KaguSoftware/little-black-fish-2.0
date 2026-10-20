import { chromium } from 'playwright-core';
import fs from 'fs';

const names = process.argv[2].split(',');
const views = process.argv[3] ? process.argv[3].split(',') : ['0', '35', '90', '180'];
// a view is 'deg' or 'deg:ty:dist:fov' for close-ups
const doGlb = process.argv[4] !== 'noglb';
fs.mkdirSync('out/png', { recursive: true });
fs.mkdirSync('out/glb', { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 1300 } });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://localhost:8765/viewer.html');
await page.waitForFunction('window.ready === true', null, { timeout: 30000 });

for (const n of names) {
  const info = await page.evaluate(async (n) => await window.loadChar(n), n);
  console.log(n, JSON.stringify(info));
  const size = info.frame.size || [900, 1300];
  await page.evaluate(([w, h]) => window.setSize(w, h), size);
  for (const v of views) {
    const [deg, ty, dist, fov] = v.split(':').map(Number);
    const f = ty !== undefined && !Number.isNaN(ty) ? { ty, dist, fov: fov || 24 } : null;
    const url = await page.evaluate(([d, f]) => window.shot(d, f), [deg, f]);
    const tag = f ? `${deg}_c${ty}` : `${deg}`;
    fs.writeFileSync(`out/png/${n}_${tag}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  if (doGlb) {
    const b64 = await page.evaluate(() => window.exportGlb());
    fs.writeFileSync(`out/glb/${n}.glb`, Buffer.from(b64, 'base64'));
    console.log(n, 'glb', fs.statSync(`out/glb/${n}.glb`).size);
  }
}
await browser.close();
