/* Weapon Speed Analyzer math (v35, work in progress). Pure functions, no DOM: used by freqview.js in the browser and by
   tools/test_freqmath.js in node. Our own code, no libraries:
   - iterative radix-2 Cooley–Tukey FFT (power-of-two sizes), periodic Hann window,
   - short-time spectrogram (linear power), averaged spectrum of a time window, peak picking with parabolic interpolation,
   - a simple harmonic-sum "suggest fundamental" heuristic and a per-frame strongest-peak tracker (optional octave check),
   - weapon math: rev/s = f / N, RPM = 60 f / N, tip speed = π D RPM / 60 (plain rotational kinematics). */
(function (root) {
  'use strict';
  var TW = {};
  function twiddles(n) {
    if (TW[n]) return TW[n];
    var c = new Float64Array(n / 2), s = new Float64Array(n / 2);
    for (var k = 0; k < n / 2; k++) { c[k] = Math.cos(2 * Math.PI * k / n); s[k] = -Math.sin(2 * Math.PI * k / n); }
    return (TW[n] = { c: c, s: s });
  }
  function isPow2(n) { return n >= 2 && (n & (n - 1)) === 0; }
  // In-place forward DFT X[k] = Σ x[j] e^{-2πijk/n}. re/im: Float64Array (or arrays) of length n (power of two).
  function fft(re, im) {
    var n = re.length; if (!isPow2(n) || im.length !== n) throw new Error('FFT size must be a power of two');
    for (var i = 1, j = 0; i < n; i++) { var bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { var t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    var T = twiddles(n);
    for (var len = 2; len <= n; len <<= 1) {
      var half = len >> 1, step = n / len;
      for (var s0 = 0; s0 < n; s0 += len) for (var k = 0; k < half; k++) {
        var wr = T.c[k * step], wi = T.s[k * step], a = s0 + k, b = a + half;
        var xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
    }
    return { re: re, im: im };
  }
  function dft(re, im) { // slow reference, tests only
    var n = re.length, R = new Float64Array(n), I = new Float64Array(n);
    for (var k = 0; k < n; k++) for (var j = 0; j < n; j++) { var a = -2 * Math.PI * j * k / n; R[k] += re[j] * Math.cos(a) - im[j] * Math.sin(a); I[k] += re[j] * Math.sin(a) + im[j] * Math.cos(a); }
    return { re: R, im: I };
  }
  var HW = {};
  function hann(n) { if (HW[n]) return HW[n]; var w = new Float64Array(n); for (var i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); return (HW[n] = w); }
  // Power spectrum (bins 0..n/2) of x[off..off+n) with a Hann window; scaled so a sine of amplitude A peaks near (A/2)^2.
  function frameSpectrum(x, off, n, out, re, im) {
    var w = hann(n), sw = n / 2; re = re || new Float64Array(n); im = im || new Float64Array(n);
    for (var i = 0; i < n; i++) { var v = off + i < x.length && off + i >= 0 ? x[off + i] : 0; re[i] = v * w[i]; im[i] = 0; }
    fft(re, im); out = out || new Float32Array(n / 2 + 1);
    for (var k = 0; k <= n / 2; k++) out[k] = (re[k] * re[k] + im[k] * im[k]) / (sw * sw);
    return out;
  }
  // Short-time spectrogram, built in steps so the UI can show progress. Frames are capped (maxFrames, maxCells) so long
  // clips / big FFTs stay within memory; the hop grows instead (frames may then skip samples, fine for this use).
  function spectrogramJob(x, sr, n, opt) {
    opt = opt || {}; if (!isPow2(n)) throw new Error('FFT size must be a power of two');
    var bins = n / 2 + 1, maxF = Math.max(8, Math.min(opt.maxFrames || 1200, Math.floor((opt.maxCells || 6e6) / bins)));
    var hop = Math.max(Math.floor(n / (opt.overlap || 2)), Math.ceil(Math.max(0, x.length - n) / (maxF - 1)));
    var frames = Math.max(1, Math.floor(Math.max(0, x.length - n) / hop) + 1);
    var sg = { n: n, sr: sr, hop: hop, frames: frames, bins: bins, data: new Float32Array(frames * bins), done: 0, df: sr / n, dur: x.length / sr };
    sg.time = function (i) { return (i * hop + n / 2) / sr; };
    var re = new Float64Array(n), im = new Float64Array(n);
    sg.step = function (count) {
      var end = Math.min(frames, sg.done + (count || frames));
      for (var i = sg.done; i < end; i++) frameSpectrum(x, i * hop, n, sg.data.subarray(i * bins, (i + 1) * bins), re, im);
      sg.done = end; return end >= frames;
    };
    return sg;
  }
  function spectrogram(x, sr, n, opt) { var sg = spectrogramJob(x, sr, n, opt); sg.step(); return sg; }
  function frameRange(sg, t0, t1) {
    var a = 0, b = sg.frames - 1, lo = Math.min(t0, t1), hi = Math.max(t0, t1);
    if (isFinite(lo)) { a = Math.ceil((lo * sg.sr - sg.n / 2) / sg.hop); }
    if (isFinite(hi)) { b = Math.floor((hi * sg.sr - sg.n / 2) / sg.hop); }
    a = Math.max(0, Math.min(sg.frames - 1, a)); b = Math.max(0, Math.min(sg.frames - 1, b));
    if (b < a) { var c = Math.max(0, Math.min(sg.frames - 1, Math.round(((lo + hi) / 2 * sg.sr - sg.n / 2) / sg.hop))); a = b = c; }
    return [a, b];
  }
  // Mean power per bin over frames whose centre lies in [t0, t1] (at least one frame).
  function avgSpectrum(sg, t0, t1) {
    var r = frameRange(sg, t0, t1), out = new Float64Array(sg.bins), cnt = r[1] - r[0] + 1;
    for (var i = r[0]; i <= r[1]; i++) { var o = i * sg.bins; for (var k = 0; k < sg.bins; k++) out[k] += sg.data[o + k]; }
    for (var k2 = 0; k2 < sg.bins; k2++) out[k2] /= cnt;
    out.frames = cnt; out.f0 = r[0]; out.f1 = r[1];
    return out;
  }
  function db(p) { return 10 * Math.log10(Math.max(p, 1e-20)); }
  function interp(spec, k) { // parabolic interpolation on dB, returns fractional bin offset in [-0.5, 0.5]
    if (k <= 0 || k >= spec.length - 1) return 0;
    var a = db(spec[k - 1]), b = db(spec[k]), c = db(spec[k + 1]), d = a - 2 * b + c;
    return d < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / d)) : 0;
  }
  // Local maxima in [fmin, fmax], strongest first, at least minSep bins apart, within floorDb of the strongest.
  function findPeaks(spec, sr, n, opt) {
    opt = opt || {}; var df = sr / n, kmin = Math.max(1, Math.ceil((opt.fmin || 0) / df)), kmax = Math.min(spec.length - 2, Math.floor((opt.fmax || sr / 2) / df));
    var count = opt.count || 6, sep = opt.minSep || 3, floor = opt.floorDb == null ? -60 : opt.floorDb, cand = [], max = 0;
    for (var k = kmin; k <= kmax; k++) if (spec[k] > max) max = spec[k];
    if (!(max > 0)) return [];
    for (var k2 = kmin; k2 <= kmax; k2++) { var p = spec[k2]; if (p > spec[k2 - 1] && p >= spec[k2 + 1] && db(p / max) >= floor) cand.push(k2); }
    cand.sort(function (a, b) { return spec[b] - spec[a]; });
    var out = [];
    for (var i = 0; i < cand.length && out.length < count; i++) {
      var kk = cand[i], clash = out.some(function (o) { return Math.abs(o.bin - kk) < sep; }); if (clash) continue;
      var d = interp(spec, kk); out.push({ bin: kk, f: (kk + d) * df, p: spec[kk], db: db(spec[kk] / max) });
    }
    return out;
  }
  function bandMax(spec, k0, k1) { var m = 0; for (var k = Math.max(0, k0); k <= Math.min(spec.length - 1, k1); k++) if (spec[k] > m) m = spec[k]; return m; }
  // Harmonic-sum heuristic: for each candidate peak f0 (within 25 dB of the strongest), add the amplitude found near
  // h·f0 for h = 1..H (below Nyquist). Take the best score, then the LOWEST candidate scoring ≥ 85% of it. A suggestion only.
  function suggest(spec, sr, n, peaks, opt) {
    opt = opt || {}; var df = sr / n, H = opt.H || 8, nyq = sr / 2, list = [];
    (peaks || []).forEach(function (pk) {
      if (pk.db < (opt.minDb == null ? -25 : opt.minDb)) return;
      var s = 0, hits = 0;
      for (var h = 1; h <= H && h * pk.f < nyq; h++) {
        var tol = Math.max(2, Math.round(0.015 * h * pk.f / df)), k = Math.round(h * pk.f / df), a = Math.sqrt(bandMax(spec, k - tol, k + tol));
        s += a; if (a >= Math.sqrt(pk.p) * 0.05) hits++;
      }
      list.push({ f: pk.f, score: s, hits: hits, peak: pk });
    });
    if (!list.length) return null;
    var best = list.reduce(function (m, c) { return c.score > m.score ? c : m; }, list[0]);
    var pick = list.filter(function (c) { return c.score >= 0.85 * best.score; }).sort(function (a, b) { return a.f - b.f; })[0];
    return { f: pick.f, score: pick.score, hits: pick.hits, best: best.f, list: list };
  }
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  // Per frame: strongest bin in [fmin, fmax] (interpolated). Frames whose in-band peak is more than minDb below the clip's
  // strongest in-band peak count as silence (f = null). Octave check (optional): if the bin at 1/2 or 1/3 of the pick is
  // within octDb of it (and still in band), use the lowest such bin, so a loud 2nd/3rd harmonic is not tracked by mistake.
  function track(sg, opt) {
    opt = opt || {}; var df = sg.df, kmin = Math.max(1, Math.ceil((opt.fmin || 0) / df)), kmax = Math.min(sg.bins - 2, Math.floor((opt.fmax || sg.sr / 2) / df));
    var minDb = opt.minDb == null ? -30 : opt.minDb, octDb = opt.octDb == null ? 12 : opt.octDb, raw = [], gmax = 0;
    for (var i = 0; i < sg.frames; i++) {
      var o = i * sg.bins, bk = -1, bp = 0;
      for (var k = kmin; k <= kmax; k++) if (sg.data[o + k] > bp) { bp = sg.data[o + k]; bk = k; }
      if (bk > 0 && opt.octave !== false) {
        for (var m = 3; m >= 2; m--) {
          var c = Math.round(bk / m); if (c < kmin) continue;
          var ck = c, cp = 0; for (var j = c - 1; j <= c + 1; j++) if (j >= kmin && sg.data[o + j] > cp) { cp = sg.data[o + j]; ck = j; }
          if (cp > 0 && db(cp / bp) >= -octDb) { bk = ck; bp = cp; break; }
        }
      }
      var spec = sg.data.subarray(o, o + sg.bins);
      raw.push({ t: sg.time(i), f: bk > 0 ? (bk + interp(spec, bk)) * df : null, p: bp });
      if (bp > gmax) gmax = bp;
    }
    raw.forEach(function (r) { r.db = db(r.p / (gmax || 1)); if (r.db < minDb) r.f = null; });
    // 5-frame median over valid neighbours removes single-frame spikes
    var out = raw.map(function (r, i) {
      if (r.f == null) return { t: r.t, f: null, raw: null, db: r.db };
      var w = []; for (var j = i - 2; j <= i + 2; j++) if (raw[j] && raw[j].f != null) w.push(raw[j].f);
      return { t: r.t, f: median(w), raw: r.f, db: r.db };
    });
    var top = null; out.forEach(function (r) { if (r.f != null && (!top || r.f > top.f)) top = r; });
    return { points: out, top: top, dt: sg.hop / sg.sr };
  }
  // ---- weapon math ----
  function num(v) { var x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : NaN; }
  function revHz(f, N) { return num(f) / num(N); }
  function rpm(f, N) { return 60 * num(f) / num(N); }
  function hzFromRpm(r, N) { return num(r) * num(N) / 60; }
  function toMeters(d, unit) { return num(d) * (unit === 'in' ? 0.0254 : 0.001); }
  function tipSpeed(dMeters, r) { var mps = Math.PI * num(dMeters) * num(r) / 60; return { mps: mps, mph: mps / 0.44704, fts: mps / 0.3048, kmh: mps * 3.6 }; }
  // Desmos "Tip Speed via Frequency" (desmos.com/calculator/6asghipk6w, the user's source): S = π·F·D / 17.6 with
  // F = weapon frequency in Hz (revolutions per second), D = blade diameter in inches, S = tip speed in mph.
  // 17.6 = 63,360 in per mile ÷ 3,600 s per hour. Secondary units are derived from S.
  function desmosMph(F, Din) { return Math.PI * num(F) * num(Din) / 17.6; }
  function toInches(d, unit) { return unit === 'mm' ? num(d) / 25.4 : num(d); }
  function fromF(F, Din) { var mph = desmosMph(F, Din); return { F: num(F), rpm: 60 * num(F), mph: mph, mps: mph * 0.44704, fts: mph * 5280 / 3600, kmh: mph * 1.609344 }; }
  function resolution(sr, n) { return sr / n; }
  function rpmUncertainty(sr, n, N) { return 60 * (sr / n / 2) / num(N); } // ± half a bin, expressed in weapon RPM
  function nyquist(sr) { return sr / 2; }
  function maxRpm(sr, N) { return 60 * (sr / 2) / num(N); }
  function kvRpm(kv, volts, ratio) { var r = num(ratio); return num(kv) * num(volts) / (isFinite(r) && r > 0 ? r : 1); }
  var SPEED_OF_SOUND = 343; // m/s in air at about 20 °C
  function dopplerPct(v) { return num(v) / SPEED_OF_SOUND * 100; }
  // Test helpers: synthetic signals (phase-integrated so frequency sweeps are continuous)
  function synth(sr, dur, freqAt, opt) {
    opt = opt || {}; var n = Math.round(sr * dur), x = new Float32Array(n), ph = 0, H = opt.harmonics || [1], seed = opt.seed || 1;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; }
    for (var i = 0; i < n; i++) {
      var t = i / sr, f = freqAt(t); ph += 2 * Math.PI * f / sr; var v = 0;
      for (var h = 0; h < H.length; h++) v += H[h] * Math.sin((h + 1) * ph);
      if (opt.tones) opt.tones.forEach(function (tn) { v += tn[1] * Math.sin(2 * Math.PI * tn[0] * t); });
      x[i] = v * (opt.env ? opt.env(t) : 1) + (opt.noise || 0) * rnd();
    }
    return x;
  }
  var api = { fft: fft, dft: dft, hann: hann, frameSpectrum: frameSpectrum, spectrogramJob: spectrogramJob, spectrogram: spectrogram, avgSpectrum: avgSpectrum, frameRange: frameRange,
    findPeaks: findPeaks, suggest: suggest, track: track, db: db, num: num, revHz: revHz, rpm: rpm, hzFromRpm: hzFromRpm, toMeters: toMeters, tipSpeed: tipSpeed, desmosMph: desmosMph, toInches: toInches, fromF: fromF,
    resolution: resolution, rpmUncertainty: rpmUncertainty, nyquist: nyquist, maxRpm: maxRpm, kvRpm: kvRpm, dopplerPct: dopplerPct, SPEED_OF_SOUND: SPEED_OF_SOUND, synth: synth, isPow2: isPow2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FreqMath = api;
})(typeof window !== 'undefined' ? window : this);
