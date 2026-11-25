// PW_CORE=<playwright-core> node tools/e2e_logo.js [url] [chrome|webkit] [prefix]
const pw = require(process.env.PW_CORE || 'playwright-core');
const path = require('path');
const U = process.argv[2] || 'http://localhost:8765/';
const BR = process.argv[3] || 'chrome';
const PFX = process.argv[4] || 'v38-';
const S = path.join(__dirname, '../screenshots/');
(async () => {
  const wkEnv = { ...process.env };
  if (process.env.WSA_GST) wkEnv.GST_PLUGIN_PATH = process.env.WSA_GST;
  if (process.env.WSA_GIO) wkEnv.GIO_EXTRA_MODULES = process.env.WSA_GIO;
  const b = await (BR === 'webkit' ? pw.webkit : pw.chromium).launch(
    BR === 'chrome' ? { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }
    : BR === 'chromium' ? { args: ['--no-sandbox'] } : { env: wkEnv }
  );
  const errs = [];
  const sizes = [[390, 844], [1440, 900]];
  for (const [w, h] of sizes) {
    const tag = w + 'x' + h, phone = w < 500;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone && BR !== 'webkit' ? true : undefined, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1 });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tag + ' ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(tag + ' ' + m.text()); });
    await p.goto(U, { waitUntil: 'networkidle' });
    await p.waitForSelector('.ld-mark img');
    await p.waitForFunction(() => { const i = document.querySelector('.ld-mark img'); return i && i.naturalWidth > 0; });
    await p.waitForTimeout(400);
    const info = await p.evaluate(() => {
      const img = document.querySelector('.ld-mark img');
      const r = document.querySelector('.ld-mark').getBoundingClientRect();
      const ov = document.documentElement.scrollWidth > innerWidth + 1;
      const landing = document.documentElement.classList.contains('landing-on');
      return { landing, src: img.currentSrc || img.src, nw: img.naturalWidth, w: Math.round(r.width), h: Math.round(r.height), ov, alt: img.alt };
    });
    console.log(tag, 'landing', JSON.stringify(info));
    await p.screenshot({ path: S + PFX + BR + '-' + tag + '-landing.png' });
    // after Enter: header flame
    await p.click('#landingGo');
    await p.waitForTimeout(400);
    const hdr = await p.evaluate(() => {
      const img = document.querySelector('.logo');
      return { src: img && (img.currentSrc || img.src), w: img && Math.round(img.getBoundingClientRect().width), shown: !!(img && img.naturalWidth) };
    });
    console.log(tag, 'header', JSON.stringify(hdr));
    await p.evaluate(() => scrollTo(0, 0));
    await p.waitForTimeout(150);
    await p.screenshot({ path: S + PFX + BR + '-' + tag + '-header.png' });
    await ctx.close();
  }
  console.log('ERRORS', JSON.stringify(errs));
  await b.close();
  if (errs.length) process.exit(1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
