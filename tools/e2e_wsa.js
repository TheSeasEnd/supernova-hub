// Browser test (needs playwright-core and Chrome): node tools/e2e_wsa.js [url] [screenshot prefix] [chrome path|bundled] [noshots]
// Loads the synthetic WAV / MP4 / MOV / WebM through the file input (see gen_wsa_media.js), checks the result at 390x844 and 1440x900.
const { chromium } = require('playwright-core'); const fs = require('fs');
const U = process.argv[2] || 'http://localhost:8765/', PFX = process.argv[3] || 'v35-', EXE = process.argv[4] || '/usr/bin/google-chrome', SHOTS = process.argv[5] !== 'noshots';
const M = (process.env.WSA_MEDIA || '/tmp/pt/media') + '/', S = require('path').join(__dirname, '../screenshots/');
(async () => {
  const b = await chromium.launch({ executablePath: EXE === 'bundled' ? undefined : EXE, headless: true, args: ['--no-sandbox'] }); const errs = [];
  console.log('browser', b.version(), EXE);
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: w < 500 ? 2 : 1 });
    const p = await ctx.newPage(); const tag = w + 'x' + h;
    p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(tag + ' ' + m.text()); });
    await p.goto(U + '#calc', { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    const card = await p.evaluate(() => { const t = [...document.querySelectorAll('.calcitem')].find(c => /weapon speed analyzer/i.test(c.innerText)); return t ? { badge: !!t.querySelector('.tbuild'), btn: !!t.querySelector('[data-open="wsa"]') } : null; });
    console.log(tag, 'card', JSON.stringify(card));
    await p.click('[data-open="wsa"]'); await p.waitForTimeout(400);
    console.log(tag, 'hash', await p.evaluate(() => location.hash), 'docW', await p.evaluate(() => document.documentElement.scrollWidth));
    await p.fill('[data-c="d"]', '8'); await p.fill('[data-c="imp"][data-w="w"]', '2'); await p.fill('[data-m="val"]', '140');
    console.log(tag, 'plain F=140 D=8:', (await p.textContent('#wsaManRes')).replace(/\s+/g, ' ').slice(0, 140));
    if (SHOTS) { await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: S + PFX + tag + '-wsa-empty.png' }); }
    for (const f of ['spinup.wav', 'spinup.mp4', 'spinup.mov', 'spinup.webm', 'noaudio.mp4', 'garbage.mp4']) {
      await p.setInputFiles('#wsaFile', M + f);
      await p.waitForFunction(() => ['ready', 'empty'].includes(window.FreqView._state.phase) && !document.querySelector('.wsa-prog'), null, { timeout: 30000 }).catch(() => {});
      const r = await p.evaluate(() => { const s = window.FreqView._state; return { phase: s.phase, sr: s.sr, dur: s.dur && +s.dur.toFixed(2), msg: s.msg && s.msg.html.replace(/<[^>]+>/g, '').slice(0, 110), top: s.tr && s.tr.top && +s.tr.top.f.toFixed(1), has: !!s.x }; });
      console.log(tag, f, JSON.stringify(r));
    }
    // final analysis on the wav: steady window 3.7-5.3 s via sliders, suggest, check
    await p.setInputFiles('#wsaFile', M + 'spinup.wav'); await p.waitForFunction(() => window.FreqView._state.phase === 'ready' && !document.querySelector('.wsa-prog'));
    await p.evaluate(() => { for (const [id, v] of [['wsaT1', 5.3], ['wsaT0', 3.7]]) { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } });
    await p.click('[data-a="suggest"]'); await p.waitForTimeout(200);
    const out = await p.evaluate(() => { const s = window.FreqView._state; return { win: [s.t0, s.t1], peaks: s.peaks.map(q => +q.f.toFixed(1)), sel: s.selF && +s.selF.toFixed(2), src: s.selSrc, res: document.getElementById('wsaRes').innerText.replace(/\s+/g, ' ').slice(0, 200), top: document.getElementById('wsaTop').innerText.replace(/\s+/g, ' ').slice(0, 160) }; });
    console.log(tag, 'analysis', JSON.stringify(out));
    // drag selection on canvas (touch on phone)
    await p.evaluate(() => document.querySelector('#wsaSg').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); const bb = await (await p.$('#wsaSg')).boundingBox(); const x0 = bb.x + 44 + (bb.width - 52) * 0.42, x1 = bb.x + 44 + (bb.width - 52) * 0.58, y = bb.y + bb.height / 2;
    if (w < 500) {
      const cdp = await ctx.newCDPSession(p); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
      for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 8, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else { await p.mouse.move(x0, y); await p.mouse.down(); await p.mouse.move(x1, y, { steps: 8 }); await p.mouse.up(); }
    await p.waitForTimeout(300);
    console.log(tag, 'after drag window', JSON.stringify(await p.evaluate(() => [+window.FreqView._state.t0.toFixed(2), +window.FreqView._state.t1.toFixed(2), window.FreqView._state.selF && +window.FreqView._state.selF.toFixed(1)])));
    // pick peak via radio (keyboard-accessible) to confirm manual pick
    const rad = await p.$$('input[name=wsaPk]'); if (rad.length > 1) { await rad[1].click(); }
    console.log(tag, 'picked', JSON.stringify(await p.evaluate(() => [window.FreqView._state.selSrc, window.FreqView._state.selF && +window.FreqView._state.selF.toFixed(1)])));
    // re-suggest for the screenshot state, persist check
    await p.click('[data-a="suggest"]'); await p.waitForTimeout(200);
    console.log(tag, 'saved', await p.evaluate(() => Object.keys(localStorage).filter(k => /^wsa_v1_/.test(k)).map(k => k + '=' + localStorage.getItem(k)).join(' ')), 'docW', await p.evaluate(() => document.documentElement.scrollWidth));
    if (SHOTS) {
      await p.evaluate(() => document.querySelector('#wsaSg').scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -70)); await p.waitForTimeout(200);
      await p.screenshot({ path: S + PFX + tag + '-wsa-analysis.png' });
      await p.evaluate(() => document.querySelector('#wsaRes').closest('.card').scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -70)); await p.waitForTimeout(200);
      await p.screenshot({ path: S + PFX + tag + '-wsa-result.png' });
    }
    // reduced motion + back button
    await p.emulateMedia({ reducedMotion: 'reduce' }); console.log(tag, 'rm anim', await p.evaluate(() => { const i = document.createElement('i'); i.className = 'ind'; const d = document.createElement('div'); d.className = 'wsa-prog'; d.appendChild(i); document.body.appendChild(d); const a = getComputedStyle(i).animationName; d.remove(); return a; }));
    console.log(tag, 'pre-back', await p.evaluate(() => location.href + ' state=' + JSON.stringify(history.state) + ' len=' + history.length)); await p.click('[data-back]'); await p.waitForTimeout(500); console.log(tag, 'back ->', await p.evaluate(() => location.href + ' landing=' + document.documentElement.classList.contains('landing-on') + ' calcList=' + !!document.querySelector('[data-open=wsa]')));
    await ctx.close();
  }
  console.log('ERRORS', JSON.stringify(errs)); await b.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
