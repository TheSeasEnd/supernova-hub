// v37 browser test for "Number of impactors": PW_CORE=<path to playwright-core> node tools/e2e_wsa37.js [url] [chrome|chromium|webkit] [prefix]
// Plain (no audio) tone calculator, quick picks, typing, validation, sync between the two copies, migration of an old saved "n",
// and the audio path (spinup.wav from tools/gen_wsa_media.js: 280 Hz tone = 2 impactors at 140 rev/s). Screenshots to screenshots/<prefix>*.
const pw = require(process.env.PW_CORE || 'playwright-core'), path = require('path');
const U = process.argv[2] || 'http://localhost:8765/', BR = process.argv[3] || 'chrome', PFX = process.argv[4] || 'v37-';
const M = (process.env.WSA_MEDIA || '/tmp/pt/media') + '/', S = path.join(__dirname, '../screenshots/');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
(async () => {
  const wkEnv = { ...process.env }; if (process.env.WSA_GST) wkEnv.GST_PLUGIN_PATH = process.env.WSA_GST; if (process.env.WSA_GIO) wkEnv.GIO_EXTRA_MODULES = process.env.WSA_GIO;
  const b = await (BR === 'webkit' ? pw.webkit : pw.chromium).launch(BR === 'chrome' ? { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] } : BR === 'chromium' ? { args: ['--no-sandbox'] } : { env: wkEnv });
  console.log('browser', BR, b.version()); const errs = [];
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const tag = w + 'x' + h, phone = w < 500;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone && BR !== 'webkit' ? true : undefined, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1 });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(tag + ' ' + m.text()); });
    // migration: an old v36 save with n = 3
    await p.goto(U + '#overview', { waitUntil: 'networkidle' });
    const bid = await p.evaluate(() => window.App.currentBot().id);
    await p.evaluate(id => localStorage.setItem('wsa_v1_' + id, JSON.stringify({ n: '3', d: '8', unit: 'in', kv: '', volts: '', ratio: '' })), bid);
    await p.goto(U + '#calc/wsa', { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
    const mig = await p.evaluate(id => ({ saved: JSON.parse(localStorage.getItem('wsa_v1_' + id)), val: document.querySelector('[data-c="imp"][data-w="w"]').value, pressed: document.querySelector('[data-a="imp"][aria-pressed="true"]')?.dataset.v }), bid);
    ok(mig.saved.imp === '3' && !('n' in mig.saved) && mig.val === '3' && mig.pressed === '3', tag + ' migrates old n=3 -> imp=3 ' + JSON.stringify(mig));
    ok(await p.evaluate(() => /Number of impactors/.test(document.querySelector('.wsa-imp').innerText) && /our addition/i.test(document.querySelector('.wsa-imp').innerText)), tag + ' label + our addition tag');
    // plain calculator, tone mode
    await p.selectOption('[data-m="mode"]', 'hz');
    ok(await p.locator('[data-c="imp"][data-w="m"]').count() === 1, tag + ' impactor picker shown in plain tone mode');
    await p.click('[data-a="imp"][data-v="2"][data-w="m"]'); await p.fill('[data-m="val"]', '280');
    const man = await p.evaluate(() => ({ t: document.querySelector('#wsaManRes').innerText, w: document.querySelector('[data-c="imp"][data-w="w"]').value, wp: document.querySelector('[data-a="imp"][data-w="w"][aria-pressed="true"]')?.dataset.v }));
    ok(/Tone 280 Hz ÷ 2 impactors = F 140\.00 Hz/.test(man.t) && /199\.9\s*mph/.test(man.t) && /8,400 RPM/.test(man.t) && /π × 140\.00 × 8\.00 ÷ 17\.6/.test(man.t), tag + ' tone 280 ÷ 2 -> 140 Hz -> 199.9 mph ' + JSON.stringify(man.t.slice(0, 160)));
    ok(man.w === '2' && man.wp === '2', tag + ' both copies in sync');
    if (true) { await p.evaluate(() => document.querySelector('#wsaMan').closest('.card').scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -80)); await p.waitForTimeout(150); await p.screenshot({ path: S + PFX + BR + '-' + tag + '-plain-tone.png' }); }
    await p.click('[data-a="imp"][data-v="1"][data-w="m"]'); await p.fill('[data-m="val"]', '140');
    let t = await p.innerText('#wsaManRes'); ok(/Tone 140 Hz ÷ 1 impactor = F 140\.00 Hz/.test(t) && /199\.9\s*mph/.test(t), tag + ' tone 140 with 1 impactor same as before');
    // typed + validation
    const inp = '[data-c="imp"][data-w="w"]';
    await p.fill(inp, '1.5'); t = await p.innerText('#wsaManRes');
    const inv = await p.evaluate(s => ({ aria: document.querySelector(s).getAttribute('aria-invalid'), shown: [...document.querySelectorAll('.wsa-imperr')].filter(e => !e.hidden).length, pressed: document.querySelectorAll('[data-a="imp"][aria-pressed="true"]').length }), inp);
    ok(/whole number, 1 or more/.test(t) && inv.aria === 'true' && inv.shown === 2 && inv.pressed === 0, tag + ' 1.5 rejected ' + JSON.stringify(inv));
    if (true) { await p.evaluate(() => document.querySelector('.wsa-imp').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); await p.screenshot({ path: S + PFX + BR + '-' + tag + '-invalid.png' }); }
    await p.fill(inp, '0'); ok(/whole number/.test(await p.innerText('#wsaManRes')), tag + ' 0 rejected');
    await p.fill(inp, '');  ok(/whole number/.test(await p.innerText('#wsaManRes')), tag + ' empty rejected');
    await p.fill(inp, '6'); t = await p.innerText('#wsaManRes');
    ok(/Tone 140 Hz ÷ 6 impactors = F 23\.33 Hz/.test(t) && await p.evaluate(() => document.querySelectorAll('[data-a="imp"][aria-pressed="true"]').length) === 0 && await p.evaluate(() => document.activeElement.matches('[data-c="imp"][data-w="w"]')), tag + ' typed 6 works, focus kept');
    ok(JSON.parse(await p.evaluate(id => localStorage.getItem('wsa_v1_' + id), bid)).imp === '6', tag + ' saved per robot');
    // F mode ignores impactors
    await p.selectOption('[data-m="mode"]', 'f'); await p.fill('[data-m="val"]', '140'); t = await p.innerText('#wsaManRes');
    ok(!/Tone/.test(t) && /199\.9\s*mph/.test(t) && await p.locator('[data-c="imp"][data-w="m"]').count() === 0, tag + ' F mode: no tone line, impactors not applied');
    // audio path: 280 Hz spin-up, 2 impactors
    await p.click('[data-a="imp"][data-v="2"][data-w="w"]');
    const tok = await p.evaluate(() => window.FreqView._state.token);
    await p.setInputFiles('#wsaFile', M + 'spinup.wav');
    await p.waitForFunction(t => window.FreqView._state.token > t && window.FreqView._state.phase === 'ready' && window.FreqView._state.tr, tok, { timeout: 120000 }).catch(() => {});
    const top = await p.innerText('#wsaTop').catch(() => '');
    ok(/Tone 279\.9 Hz ÷ 2 impactors = F 139\.9\d Hz/.test(top) && /199\.[89]\s*mph/.test(top), tag + ' audio track: tone ÷ 2 ' + JSON.stringify(top.slice(0, 200)));
    // average the steady top-speed stretch, then pick the peak nearest 280 Hz in the list
    await p.evaluate(() => { const s = window.FreqView._state, a = document.getElementById('wsaT0'), z = document.getElementById('wsaT1'); a.value = s.dur * 0.6; a.dispatchEvent(new Event('change', { bubbles: true })); z.value = s.dur; z.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForTimeout(200);
    const ix = await p.evaluate(() => { const pk = window.FreqView._state.peaks; let bi = -1, bd = 1e9; pk.forEach((q, i) => { if (Math.abs(q.f - 280) < bd) { bd = Math.abs(q.f - 280); bi = i; } }); return bi; });
    await p.click('#wsaPk' + ix); await p.waitForTimeout(150);
    const res = await p.innerText('#wsaRes'); const mm = res.match(/Tone ([\d.]+) Hz ÷ 2 impactors = F ([\d.]+) Hz/), mph = +(res.match(/([\d.]+)\s*mph/) || [])[1];
    ok(mm && Math.abs(+mm[1] - 280) < 8 && Math.abs(+mm[2] - mm[1] / 2) < 0.01 && Math.abs(mph - Math.PI * mm[2] * 8 / 17.6) < 0.06, tag + ' chosen ~280 Hz peak ÷ 2 = F, S = π F D / 17.6 ' + JSON.stringify(res.slice(0, 220)));
    await p.evaluate(() => document.querySelector('#wsaRes').closest('.card').scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -80)); await p.waitForTimeout(150);
    await p.screenshot({ path: S + PFX + BR + '-' + tag + '-audio-result.png' });
    await p.evaluate(() => scrollTo(0, 0)); await p.evaluate(() => document.querySelector('.wsa-imp').closest('.card').scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -80)); await p.waitForTimeout(150);
    await p.screenshot({ path: S + PFX + BR + '-' + tag + '-weapon.png' });
    const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); ok(!ov, tag + ' no horizontal overflow');
    await ctx.close();
  }
  ok(errs.length === 0, 'console errors ' + JSON.stringify(errs));
  console.log(pass + ' passed, ' + fail + ' failed'); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
