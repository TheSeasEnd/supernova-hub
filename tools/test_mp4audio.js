// node tools/test_mp4audio.js: MOV/MP4 audio extractor + M4A/WAV writers (mp4audio.js) on small ffmpeg-made fixtures (tools/fixtures,
// 1 s 280 Hz tone at 16 kHz): H.264+AAC .mov, HEVC+AAC .mov, ALAC, PCM s24le / s16be (stereo) / f32le, and a video with no audio.
const M = require('../mp4audio.js'), F = require('../freqmath.js'), fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const fx = f => new Blob([fs.readFileSync(path.join(__dirname, 'fixtures', f))]);
const peak = (x, sr) => { const n = 4096, sg = F.spectrogram(x, sr, n), sp = F.avgSpectrum(sg, 0, 1); return F.findPeaks(sp, sr, n, { fmin: 50, fmax: 2000 })[0].f; };
(async () => {
  for (const [f, fmt, bits, type, ch] of [['pcm_s24le.mov', 'in24', 24, 'int', 1], ['pcm_s16be.mov', 'twos', 16, 'int', 2], ['pcm_f32le.mov', 'fl32', 32, 'float', 1]]) {
    const r = await M.extract(fx(f), { maxSec: 300 });
    ok(r.kind === 'pcm' && r.format === fmt && r.bits === bits && r.pcmType === type && r.channels === ch && r.rate === 16000, f + ' parsed as ' + fmt + ' ' + bits + '-bit ' + ch + 'ch');
    ok(Math.abs(r.x.length / r.rate - 1) < 0.02, f + ' duration ≈ 1 s');
    ok(Math.abs(peak(r.x, r.rate) - 280) < 16000 / 4096, f + ' tone at 280 Hz (' + peak(r.x, r.rate).toFixed(1) + ')');
    const amp = r.x.reduce((m, v) => Math.max(m, Math.abs(v)), 0); const want = ch === 2 ? 0.0625 / Math.SQRT2 : 0.0625; ok(Math.abs(amp - want) < 0.002, f + ' amplitude ' + amp.toFixed(4) + ' ≈ ' + want.toFixed(4) + ' (ffmpeg sine 1/8 × 0.5' + (ch === 2 ? ', −3 dB stereo upmix' : '') + ')');
  }
  for (const [f, codec, ch] of [['h264_aac.mov', 'aac', 2], ['hevc_aac.mov', 'aac', 1], ['alac.mov', 'alac', 1]]) {
    const r = await M.extract(fx(f), { maxSec: 300 });
    ok(r.kind === 'compressed' && r.codec === codec && r.channels === ch && r.sizes.length >= 3 && r.data.length === r.sizes.reduce((a, b) => a + b, 0), f + ' -> ' + codec + ' track, ' + r.sizes.length + ' frames, video ignored');
    if (codec === 'aac') ok(r.ascInfo && r.ascInfo.aot === 2 && r.ascInfo.rate === 16000 && r.ascInfo.channels === ch && r.rate === 16000, f + ' AudioSpecificConfig: AAC-LC 16 kHz ' + ch + 'ch');
    const m4a = M.toM4A(r), back = await M.extract(new Blob([m4a]), {});
    ok(String.fromCharCode(...m4a.subarray(4, 12)) === 'ftypM4A ', f + ' -> .m4a starts with ftyp M4A');
    ok(back.kind === 'compressed' && back.codec === codec && back.sizes.length === r.sizes.length && Buffer.compare(Buffer.from(back.data), Buffer.from(r.data)) === 0, f + ' -> .m4a round-trips: same ' + r.sizes.length + ' frames, bytes unchanged');
    ok(back.timescale === r.timescale && JSON.stringify(back.stts) === JSON.stringify(r.stts), f + ' -> .m4a keeps timing');
  }
  { const r = await M.extract(fx('h264_aac.mov'), { maxSec: 0.5 }); ok(r.truncated && Math.abs(r.sizes.length * 1024 / 16000 - 0.5) < 0.07, 'maxSec cap: only ~0.5 s of frames read'); }
  { const r = await M.extract(fx('pcm_s24le.mov'), { maxSec: 0.25 }); ok(r.truncated && r.x.length === 4000, 'maxSec cap for PCM (4000 frames)'); }
  for (const [blob, code, what] of [[fx('noaudio.mp4'), 'noaudio', 'video without audio'], [new Blob([new Uint8Array(4000).fill(7)]), 'notmp4', 'random bytes'], [new Blob([fs.readFileSync(path.join(__dirname, 'fixtures', 'h264_aac.mov')).subarray(0, 3000)]), 'nomoov', 'cut-short .mov (index missing)']]) {
    let e = null; try { await M.extract(blob, {}); } catch (er) { e = er; } ok(e && e.code === code, what + ' -> ' + code + ' (' + (e && e.code) + ')');
  }
  { // progress reported
    const seen = []; await M.extract(fx('pcm_s16be.mov'), { onProgress: (f, s) => seen.push(s + ':' + f.toFixed(2)) }); ok(seen.includes('index:0.00') && seen[seen.length - 1] === 'audio:1.00', 'progress: index then audio to 100%');
  }
  { // WAV writer / reader round trip
    const x = F.synth(16000, 0.5, () => 280), w = M.toWav(x, 16000), r = M.wavToMono(w);
    ok(String.fromCharCode(...w.subarray(0, 4)) === 'RIFF' && w.length === 44 + x.length * 2 && r.rate === 16000 && r.x.length === x.length, 'WAV 16-bit mono written and read back');
    let e = 0; for (let i = 0; i < x.length; i++) e = Math.max(e, Math.abs(r.x[i] - x[i])); ok(e < 1 / 16000, 'WAV round trip error < 1 LSB (' + e.toExponential(1) + ')');
    let bad = null; try { M.wavToMono(new Uint8Array(20)); } catch (er) { bad = er; } ok(bad && bad.code === 'notwav', 'non-WAV rejected');
  }
  { // esds / ASC parsing on a hand-made descriptor (AAC-LC 44.1 kHz stereo = 0x12 0x10)
    const esds = Uint8Array.from([0, 0, 0, 0x27, 0x65, 0x73, 0x64, 0x73, 0, 0, 0, 0, 3, 0x19, 0, 1, 0, 4, 0x11, 0x40, 0x15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 2, 0x12, 0x10, 6, 1, 2]);
    const e = M.parseEsds(esds); ok(e.oti === 0x40 && e.asc && e.asc[0] === 0x12 && e.asc[1] === 0x10, 'esds -> OTI 0x40 + ASC'); const a = M.ascInfo(e.asc); ok(a.aot === 2 && a.rate === 44100 && a.channels === 2, 'ASC 0x1210 = AAC-LC 44.1 kHz stereo');
  }
  const v = fs.readFileSync(path.join(__dirname, '../freqview.js'), 'utf8'), sw = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8'), html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  ok(!/mp4audio\.js/.test(html) && !/'mp4audio\.js'/.test(sw) && /sc\.src = 'mp4audio\.js'/.test(v), 'converter lazy-loaded (not in index.html or the precache list; the SW caches it on first use)');
  ok(/c\.put\(e\.request, r\.clone\(\)\)/.test(sw) && /supernova-v(3[6-9]|[4-9]\d)/.test(sw), 'SW runtime-caches same-origin files, v36+');
  ok(/accept="video\/\*,audio\/\*,video\/quicktime,video\/mp4,\.mov,/.test(v) && !/type="file"[^>]*(multiple|capture)/.test(v), 'picker accepts any video (Photos) + .mov, no capture/multiple');
  ok(/convert\(f, tok, 'fallback', warn\)/.test(v) && /mb > direct/.test(v) && /DECODE_TIMEOUT_MS = 15000/.test(v), 'fallback on decode failure, audio-only path for big videos, decode timeout');
  ok(/Converted in this tab, nothing uploaded/.test(v) && /The video track was not read or converted/.test(v) && /Download converted audio \(\.m4a/.test(v), 'honest conversion note + downloads');
  ok(/WSA_FORCE_DECODE_FAIL/.test(v), 'test hook to force the fallback');
  ok((v.match(/code: 'load'/g) || []).length === 2 && /couldn’t be downloaded/.test(v), 'converter load failure (offline before first use) gives the clear message');
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
