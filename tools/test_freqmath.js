// node tools/test_freqmath.js: FFT + weapon-speed math with synthetic signals (freqmath.js).
const F = require('../freqmath.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// FFT vs slow DFT on random data
for (const n of [2, 8, 64, 256]) {
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
  const re = Float64Array.from({ length: n }, r), im = Float64Array.from({ length: n }, r), D = F.dft(re, im), X = F.fft(re.slice(), im.slice());
  let e = 0; for (let k = 0; k < n; k++) e = Math.max(e, Math.abs(X.re[k] - D.re[k]), Math.abs(X.im[k] - D.im[k]));
  ok(e < 1e-9, 'fft == dft n=' + n + ' (err ' + e.toExponential(1) + ')');
}
{ const re = new Float64Array(16), im = new Float64Array(16); re[0] = 1; F.fft(re, im); ok(re.every(v => near(v, 1, 1e-12)) && im.every(v => near(v, 0, 1e-12)), 'impulse -> flat'); }
{ let threw = false; try { F.fft(new Float64Array(12), new Float64Array(12)); } catch (e) { threw = true; } ok(threw, 'non power of two rejected'); }
{ // Parseval
  const n = 128, re = Float64Array.from({ length: n }, (_, i) => Math.sin(i * 0.3) + 0.2 * Math.cos(i * 1.7)), im = new Float64Array(n);
  const et = re.reduce((a, v) => a + v * v, 0); F.fft(re, im); const ef = re.reduce((a, v, k) => a + v * v + im[k] * im[k], 0) / n; ok(near(et, ef, 1e-9), 'Parseval');
}
{ const w = F.hann(8); ok(near(w[0], 0, 1e-12) && near(w[4], 1, 1e-12) && near(w[2], 0.5, 1e-12), 'Hann (periodic) values'); }
{ // sine amplitude scaling: amplitude 1 sine on a bin -> ~ -6 dB (0.25 power)
  const sr = 48000, n = 4096, f = 100 * sr / n, x = F.synth(sr, 0.2, () => f), sp = F.frameSpectrum(x, 0, n);
  ok(near(F.db(sp[100]), -6.02, 0.1), 'sine power scaling ' + F.db(sp[100]).toFixed(2) + ' dB');
}
// single tone + noise: peak within one bin
const sr = 48000;
for (const [f, n] of [[237.3, 4096], [1234.5, 8192], [61.7, 16384]]) {
  const x = F.synth(sr, 2, () => f, { noise: 0.3 }), sg = F.spectrogram(x, sr, n), sp = F.avgSpectrum(sg, 0, 2), pk = F.findPeaks(sp, sr, n, { fmin: 20, fmax: 5000 });
  ok(pk.length && near(pk[0].f, f, sr / n), 'tone ' + f + ' Hz found at ' + (pk[0] && pk[0].f.toFixed(2)) + ' (res ' + (sr / n).toFixed(2) + ')');
}
{ // harmonics: 2nd harmonic louder than the fundamental; suggest picks the fundamental (lowest strong family)
  const f0 = 150, n = 8192, x = F.synth(sr, 2, () => f0, { harmonics: [0.4, 0.8, 0.3, 0.2], noise: 0.2, tones: [[3150, 0.15]] });
  const sg = F.spectrogram(x, sr, n), sp = F.avgSpectrum(sg, 0, 2), pk = F.findPeaks(sp, sr, n, { fmin: 20, fmax: 4000, count: 8 });
  ok(near(pk[0].f, 300, sr / n), 'loudest peak is the 2nd harmonic (300 Hz)');
  ok(pk.some(p => near(p.f, 150, sr / n)) && pk.some(p => near(p.f, 450, sr / n)) && pk.some(p => near(p.f, 3150, sr / n)), 'harmonics + whine detected');
  const s = F.suggest(sp, sr, n, pk); ok(s && near(s.f, f0, sr / n), 'suggest -> fundamental ' + (s && s.f.toFixed(1)));
  const top = pk.slice(0, 2).map(p => p.db); ok(near(top[0], 0, 1e-9) && top[1] < 0, 'relative dB (0 dB = strongest)');
}
{ // band limit excludes low motor rumble
  const n = 8192, x = F.synth(sr, 1, () => 400, { tones: [[45, 3]] }), sp = F.avgSpectrum(F.spectrogram(x, sr, n), 0, 1);
  ok(near(F.findPeaks(sp, sr, n, { fmin: 100, fmax: 2000 })[0].f, 400, sr / n), 'band ignores 45 Hz rumble');
}
{ // averaged window selection: two tones in different halves
  const n = 4096, x = F.synth(sr, 4, t => (t < 2 ? 200 : 500)), sg = F.spectrogram(x, sr, n);
  ok(near(F.findPeaks(F.avgSpectrum(sg, 0.2, 1.8), sr, n, { fmin: 20, fmax: 2000 })[0].f, 200, sr / n), 'window 0.2–1.8 s -> 200 Hz');
  ok(near(F.findPeaks(F.avgSpectrum(sg, 2.2, 3.8), sr, n, { fmin: 20, fmax: 2000 })[0].f, 500, sr / n), 'window 2.2–3.8 s -> 500 Hz');
  ok(F.avgSpectrum(sg, 1, 1).frames >= 1, 'zero-length window still uses one frame');
}
{ // chirp spin-up / hold / spin-down tracking (2-tooth weapon: f = 2 x rev/s)
  const n = 4096, fAt = t => (t < 3 ? 20 + 280 * t / 3 : t < 5 ? 300 : Math.max(20, 300 - 280 * (t - 5) / 3));
  const x = F.synth(sr, 8, fAt, { harmonics: [1, 0.6, 0.3], noise: 0.1 }), sg = F.spectrogram(x, sr, n), tr = F.track(sg, { fmin: 15, fmax: 1000 });
  let worst = 0, cnt = 0; tr.points.forEach(p => { if (p.f == null) return; cnt++; worst = Math.max(worst, Math.abs(p.f - fAt(p.t))); });
  const slope = 280 / 3 * (n / sr); // Hz swept within one frame during the ramp
  ok(cnt > tr.points.length * 0.9 && worst <= sr / n + slope, 'chirp tracked within resolution+sweep (worst ' + worst.toFixed(2) + ' Hz, lim ' + (sr / n + slope).toFixed(2) + ')');
  ok(near(tr.top.f, 300, sr / n), 'top speed frame ' + tr.top.f.toFixed(2) + ' Hz');
  ok(near(F.rpm(tr.top.f, 2), 9000, 60 * (sr / n) / 2), 'top RPM ' + F.rpm(tr.top.f, 2).toFixed(0) + ' for N=2');
  const loud = F.synth(sr, 8, fAt, { harmonics: [0.5, 1, 0.3], noise: 0.05 }), sgl = F.spectrogram(loud, sr, n);
  ok(near(F.track(sgl, { fmin: 15, fmax: 1000 }).top.f, 300, sr / n), 'octave check keeps the fundamental when the 2nd harmonic is louder');
  ok(F.track(sgl, { fmin: 15, fmax: 1000, octave: false }).top.f > 500, 'without octave check the louder 2nd harmonic is tracked (documented behaviour)');
  const sil = F.synth(sr, 3, () => 200, { env: t => (t < 1 ? 1 : 0), noise: 0.0005 }), trs = F.track(F.spectrogram(sil, sr, n), { fmin: 20, fmax: 2000 });
  ok(trs.points.filter(p => p.t > 1.2 && p.f != null).length === 0, 'silence is not tracked');
}
{ // spectrogram memory cap
  const x = new Float32Array(48000 * 60), sg = F.spectrogramJob(x, 48000, 32768, { maxCells: 6e6 });
  ok(sg.frames * sg.bins <= 6e6 + sg.bins && sg.frames >= 8, 'frames capped for big FFT (' + sg.frames + ' frames)');
  const sg2 = F.spectrogramJob(F.synth(48000, 1, () => 100), 48000, 4096); let steps = 0; while (!sg2.step(5)) steps++; ok(steps > 1 && sg2.done === sg2.frames, 'stepwise job completes');
}
// weapon math
ok(F.rpm(300, 2) === 9000 && F.revHz(300, 2) === 150 && F.hzFromRpm(9000, 2) === 300, 'RPM = 60 f / N');
ok(near(F.rpm(100, 1), 6000, 1e-9) && near(F.rpm(600, 3), 12000, 1e-9), 'N=1 disc, N=3 drum');
const ts = F.tipSpeed(F.toMeters(254, 'mm'), 6000);
ok(near(ts.mps, Math.PI * 0.254 * 100, 1e-9) && near(ts.mph, ts.mps / 0.44704, 1e-9) && near(ts.fts, ts.mps / 0.3048, 1e-9), 'tip speed π D RPM / 60 and units');
ok(near(F.toMeters(10, 'in'), 0.254, 1e-12) && near(F.tipSpeed(F.toMeters(10, 'in'), 6000).mps, ts.mps, 1e-9), 'inch conversion');
ok(near(F.tipSpeed(0.1, 10000).mph, 117.13, 0.01), '100 mm at 10k RPM ≈ 52.36 m/s ≈ 117.13 mph');
ok(F.resolution(48000, 4096) === 48000 / 4096 && near(F.rpmUncertainty(48000, 4096, 2), 60 * 48000 / 4096 / 4, 1e-9), 'resolution and ± RPM');
ok(F.nyquist(44100) === 22050 && F.maxRpm(44100, 1) === 1323000, 'Nyquist 22.05 kHz -> 1.32M RPM at N=1');
ok(F.kvRpm(1000, 22.2, 2) === 11100 && F.kvRpm(1000, 22.2, '') === 22200, 'Kv x V / reduction');
ok(near(F.dopplerPct(3.43), 1, 1e-9), 'Doppler 3.43 m/s ≈ 1%');
ok(isNaN(F.rpm('', 1)) && F.num('1,5') === 1.5, 'empty input is NaN, comma decimals');
// Desmos "Tip Speed via Frequency": S = π F D / 17.6 (mph), F in Hz (rev/s), D in inches
ok(near(F.desmosMph(140, 8), 199.9, 0.05) && near(F.desmosMph(140, 8), Math.PI * 140 * 8 / 17.6, 1e-12), 'Desmos example F=140, D=8 -> S ≈ 199.9 mph (' + F.desmosMph(140, 8).toFixed(3) + ')');
ok(F.fromF(140, 8).rpm === 8400, 'F=140 -> 8,400 RPM');
ok(near(F.fromF(140, 8).mph, F.tipSpeed(F.toMeters(8, 'in'), 8400).mph, 1e-9), 'Desmos formula agrees with π D RPM / 60');
ok(near(F.fromF(140, 8).mps, 89.37, 0.01) && near(F.fromF(140, 8).fts, 293.2, 0.05), 'secondary m/s and ft/s');
ok(near(F.toInches(203.2, 'mm'), 8, 1e-12) && F.toInches(8, 'in') === 8, 'mm toggle converts to inches');
ok(near(F.desmosMph(F.revHz(280, 2), 8), 199.9, 0.05), 'audio peak 280 Hz with N=2 -> F=140 -> 199.9 mph');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
