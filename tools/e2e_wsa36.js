// v36 browser test for the iPhone .mov path + converter: PW_CORE=<path to playwright-core> node tools/e2e_wsa36.js [url] [chrome|chromium|webkit] [prefix] [noshots]
// Media from tools/gen_wsa_media.js + the ffmpeg lines in README (v36). Each file is loaded through the file input normally, then with the
// browser's own decode forced to fail (window.WSA_FORCE_DECODE_FAIL = 'original' -> converter + .m4a rewrap) and with every decodeAudioData
// failing ('all' -> PCM path or WebCodecs). Expect a 279.9 Hz peak (spin-up file) wherever audio decodes.
const pw = require(process.env.PW_CORE || 'playwright-core'), path = require('path'), { execSync } = require('child_process');
const U = process.argv[2] || 'http://localhost:8765/', BR = process.argv[3] || 'chrome', PFX = process.argv[4] || 'v36-', SHOTS = process.argv[5] !== 'noshots';
const M = (process.env.WSA_MEDIA || '/tmp/pt/media') + '/', S = path.join(__dirname, '../screenshots/');
const FILES = (process.env.WSA_FILES || 'iphone_h264_aac.mov,iphone_hevc_aac.mov,iphone_tmcd.mov,faststart.mov,twoaudio.mov,alac.mov,pcm_s16le.mov,pcm_s16be.mov,pcm_s24le.mov,pcm_f32le.mov,spinup.mp4,spinup.wav,noaudio.mp4,garbage.mp4').split(',');
(async () => {
  const type = BR === 'webkit' ? pw.webkit : pw.chromium;
  // WebKit on Linux decodes audio through GStreamer: WSA_GST=<plugin dir> gives it codecs, unset = no codecs (decodeAudioData never answers).
  const wkEnv = { ...process.env }; if (process.env.WSA_GST) { wkEnv.GST_PLUGIN_PATH = process.env.WSA_GST; } if (process.env.WSA_GIO) wkEnv.GIO_EXTRA_MODULES = process.env.WSA_GIO;
  const b = await type.launch(BR === 'chrome' ? { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] } : BR === 'chromium' ? { args: ['--no-sandbox'] } : { env: wkEnv });
  console.log('browser', BR, b.version(), BR === 'webkit' ? (process.env.WSA_GST ? 'with GStreamer codecs' : 'WITHOUT GStreamer codecs') : ''); const errs = []; const sizes = BR === 'webkit' ? [[390, 844]] : [[390, 844], [1440, 900]];
  for (const [w, h] of sizes) {
    const tag = w + 'x' + h, phone = w < 500;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone && BR !== 'webkit' ? true : undefined, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1, acceptDownloads: true,
      userAgent: phone && BR === 'webkit' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : undefined });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(tag + ' ' + m.text()); });
    await p.goto(U + '#calc/wsa', { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
    const acc = await p.getAttribute('#wsaFile', 'accept'); console.log(tag, 'accept', acc, 'multiple', await p.getAttribute('#wsaFile', 'multiple'), 'capture', await p.getAttribute('#wsaFile', 'capture'));
    console.log(tag, 'converter preloaded?', await p.evaluate(() => !!window.MovAudio || !!document.querySelector('script[src*="mp4audio"]')));
    await p.fill('[data-c="d"]', '8'); await p.fill('[data-c="imp"][data-w="w"]', '2');
    const run = async (f, mode) => {
      const tok = await p.evaluate(m => { window.WSA_FORCE_DECODE_FAIL = m; return window.FreqView._state.token; }, mode);
      await p.setInputFiles('#wsaFile', M + f);
      await p.waitForFunction(t => window.FreqView._state.token > t && ['ready', 'empty'].includes(window.FreqView._state.phase) && !document.querySelector('.wsa-prog'), tok, { timeout: 180000 }).catch(() => {});
      return p.evaluate(() => { const s = window.FreqView._state, c = document.querySelector('.wsa-conv'); return { phase: s.phase, sr: s.x ? s.sr : null, dur: s.x ? +s.dur.toFixed(2) : null, top: s.tr && s.tr.top ? +s.tr.top.f.toFixed(1) : null,
        conv: c ? (/WebCodecs/.test(c.innerText) ? 'rewrap+WebCodecs' : /rewrapped/.test(c.innerText) ? 'rewrap->m4a decoded' : /read directly/.test(c.innerText) ? 'pcm read directly' : '?') + (/large/.test(c.innerText) ? ' (big: audio only read)' : '') : null, dl: [...document.querySelectorAll('.wsa-dl button')].map(x => x.dataset.a).join('+'), msg: s.msg && s.x === null ? s.msg.html.replace(/<[^>]+>/g, '').slice(0, 120) : (s.msg ? 'note: ' + s.msg.html.replace(/<[^>]+>/g, '').slice(0, 60) : '') }; });
    };
    for (const f of FILES) for (const mode of ['', 'original', 'all']) {
      if (mode && /wav$/.test(f) && mode === 'all') continue;
      const r = await run(f, mode || undefined); console.log(tag, (f + ' ' + (mode || 'normal')).padEnd(28), JSON.stringify(r));
    }
    // converted state for screenshots + downloads (HEVC .mov with the browser decode forced off)
    const r = await run('iphone_hevc_aac.mov', 'original'); console.log(tag, 'screenshot state', JSON.stringify(r));
    if (r.dl.includes('dlm4a')) {
      const [d] = await Promise.all([p.waitForEvent('download'), p.click('[data-a="dlm4a"]')]); const out = '/tmp/pt/dl-' + BR + '-' + d.suggestedFilename(); await d.saveAs(out);
      let probe = ''; try { probe = execSync('ffprobe -v error -show_entries stream=codec_name,sample_rate,channels,duration -of csv=p=0 ' + out).toString().trim(); } catch (e) { probe = 'ffprobe failed'; }
      console.log(tag, 'download m4a', d.suggestedFilename(), probe);
      const [d2] = await Promise.all([p.waitForEvent('download'), p.click('[data-a="dlwav"]')]); const out2 = '/tmp/pt/dl-' + BR + '-' + d2.suggestedFilename(); await d2.saveAs(out2);
      try { probe = execSync('ffprobe -v error -show_entries stream=codec_name,sample_rate,channels,duration -of csv=p=0 ' + out2).toString().trim(); } catch (e) { probe = 'ffprobe failed'; } console.log(tag, 'download wav', d2.suggestedFilename(), probe);
    }
    if (SHOTS) {
      await p.evaluate(() => document.querySelector('.wsa-conv').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200); await p.screenshot({ path: S + PFX + BR + '-' + tag + '-converted.png' });
      await p.click('[data-a="suggest"]').catch(() => {}); await p.evaluate(() => document.querySelector('#wsaRes').closest('.card').scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -70)); await p.waitForTimeout(200);
      await p.screenshot({ path: S + PFX + BR + '-' + tag + '-converted-result.png' });
      await run('garbage.mp4', undefined); await p.evaluate(() => document.querySelector('.wbnote.over').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); await p.screenshot({ path: S + PFX + BR + '-' + tag + '-convert-error.png' });
    }
    console.log(tag, 'converter loaded after use', await p.evaluate(() => !!window.MovAudio));
    if (process.env.WSA_BIG) { await p.evaluate(() => { window.WSA_FORCE_DECODE_FAIL = undefined; }); const t0 = Date.now(); const rb = await run(process.env.WSA_BIG, undefined); console.log(tag, 'big file', process.env.WSA_BIG, ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(rb)); }
    await ctx.close();
  }
  console.log('ERRORS', JSON.stringify(errs)); await b.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
