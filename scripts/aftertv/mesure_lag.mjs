import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require2 = createRequire(import.meta.url);
const { chromium } = require2('playwright');
const adresse = process.argv[2] || 'https://odcstudio.fr/after-tv/?mutant';
const duree = Number(process.argv[3] || 60);
const nav = await chromium.launch({
  args: [
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    '--use-angle=d3d11',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
  ],
});
const page = await nav.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript((sansImage) => {
  if (sansImage) localStorage.setItem('aftertv.debug.image', '0');
  window.__lag = { longues: [], images: [] };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries())
      window.__lag.longues.push([Math.round(e.startTime), Math.round(e.duration)]);
  }).observe({ type: 'longtask', buffered: true });
  let t0 = performance.now();
  const f = (t) => {
    window.__lag.images.push(Math.round(t - t0));
    t0 = t;
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
  window.__lag.attentes = [];
  document.addEventListener(
    'waiting',
    (e) =>
      window.__lag.attentes.push([
        Math.round(performance.now()),
        (e.target.currentSrc || '').split('/').pop().slice(0, 50),
      ]),
    true,
  );
}, !!process.env.SANS_IMAGE);
await page.goto(adresse, { waitUntil: 'load' });
await page.waitForTimeout(3e3);
await page.keyboard.press('Enter');
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 1e3 });
await page.waitForTimeout(15e3);
await page.evaluate(() => {
  window.__lag.longues = [];
  window.__lag.images = [];
});
await cdp.send('Profiler.start');
await page.waitForTimeout(duree * 1e3);
const { profile } = await cdp.send('Profiler.stop');
const lag = await page.evaluate(() => window.__lag);
const videos = await page.evaluate(() =>
  [...document.querySelectorAll('video')]
    .filter((v) => v.classList.contains('visible'))
    .map((v) => {
      const q = v.getVideoPlaybackQuality?.() || {};
      return {
        src: (v.currentSrc || '').split('/').pop().slice(0, 40),
        w: v.videoWidth,
        h: v.videoHeight,
        filtre: getComputedStyle(v.parentElement).filter.slice(0, 60),
        fusion: getComputedStyle(v.parentElement).mixBlendMode,
        perdues: q.droppedVideoFrames,
        total: q.totalVideoFrames,
        pause: v.paused,
      };
    }),
);
const gpu = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl');
  const d = c?.getExtension('WEBGL_debug_renderer_info');
  return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?';
});
await nav.close();
const parId = new Map(profile.nodes.map((n) => [n.id, n]));
const temps = new Map();
const dt = profile.timeDeltas;
profile.samples.forEach((id, i) => {
  const n = parId.get(id),
    c = n.callFrame;
  const cle = `${c.functionName || '(anonyme)'}  ${c.url.split('/').pop()}:${c.lineNumber + 1}`;
  temps.set(cle, (temps.get(cle) || 0) + (dt[i] || 0) / 1e3);
});
const top = [...temps].sort((a, b) => b[1] - a[1]).slice(0, 25);
const img = lag.images.filter((x) => x > 0);
const moy = img.reduce((a, b) => a + b, 0) / img.length;
const lentes = img.filter((x) => x > 50).length;
const totalLongues = lag.longues.reduce((a, b) => a + b[1], 0);
console.log(`images/s ${(1e3 / moy).toFixed(1)}  images > 50 ms : ${lentes}/${img.length}`);
console.log(
  `tâches longues : ${lag.longues.length}, ${Math.round(totalLongues)} ms sur ${duree} s (max ${Math.max(0, ...lag.longues.map((x) => x[1]))} ms)`,
);
console.log('gpu', gpu);
console.log('attentes vidéo (buffering) :', lag.attentes.length, JSON.stringify(lag.attentes.slice(0, 10)));
console.log('vidéos', JSON.stringify(videos));
for (const [k, ms] of top.slice(0, 8)) console.log(`${ms.toFixed(0).padStart(7)} ms  ${k}`);
writeFileSync(process.env.TEMP + '/aftertv-profil.cpuprofile', JSON.stringify(profile));
