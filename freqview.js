/* Weapon Speed Analyzer (work in progress; opened from Calcs, #calc/wsa). Load a video or audio clip of the weapon spinning,
   decode its audio in the browser (Web Audio API), look at a spectrogram, average a time window, pick the weapon's impact
   frequency and get RPM + tip speed; optional RPM-over-time track. Math lives in freqmath.js. Nothing is uploaded.
   Per-robot settings (impacts per rev, diameter, Kv check) are saved in localStorage "wsa_v1_<botId>". */
(function () {
  'use strict';
  var F = window.FreqMath, root = null, cfg = null, botId = null, bound = [];
  var KEY = 'wsa_v1_', SR = 48000, WARN_MB = 200, MAX_MB = 1024, MAX_SEC = 300;
  var st = { phase: 'empty', msg: null, prog: 0, progLabel: '', name: '', size: 0, type: '', x: null, sr: 0, dur: 0, truncated: false,
    fft: 8192, fmin: 20, fmax: 4000, t0: 0, t1: 0, count: 6, sg: null, spec: null, peaks: [], selF: null, selSrc: '', sug: null,
    tmin: 20, tmax: 4000, octave: true, tr: null, token: 0, manual: { mode: 'f', val: '' } };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function $(id) { return document.getElementById(id); }
  function bot() { return window.App && window.App.currentBot ? window.App.currentBot() : null; }
  function reduced() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function fmt(v, d) { return isFinite(v) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d }) : '—'; }
  function hz(v) { return isFinite(v) ? (v >= 1000 ? fmt(v / 1000, 2) + ' kHz' : fmt(v, Math.round(v) === v ? 0 : v < 100 ? 2 : 1) + ' Hz') : '—'; }
  function clock(t) { return isFinite(t) ? t.toFixed(t < 10 ? 2 : 1) + ' s' : '—'; }
  function load() {
    var b = bot(); botId = b ? b.id : 'default'; var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY + botId) || 'null'); } catch (e) {}
    cfg = Object.assign({ n: '1', d: '', unit: 'in', kv: '', volts: '', ratio: '' }, s || {});
  }
  function save() { try { localStorage.setItem(KEY + botId, JSON.stringify(cfg)); } catch (e) {} }
  function N() { var n = F.num(cfg.n); return n > 0 ? n : NaN; }
  function dIn() { var d = F.num(cfg.d); return d > 0 ? F.toInches(d, cfg.unit) : NaN; }
  var DESMOS = '<a href="https://www.desmos.com/calculator/6asghipk6w" target="_blank" rel="noopener">Desmos “Tip Speed via Frequency”</a>';

  /* ---------- html ---------- */
  function fld(label, inner, tag) { return '<label class="fld"><span>' + label + (tag ? ' <b class="sgtag">' + tag + '</b>' : '') + '</span>' + inner + '</label>'; }
  function numIn(k, v, ph, extra) { return '<input type="number" inputmode="decimal" step="any" min="0" data-c="' + k + '" value="' + esc(v) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + (extra || '') + '>'; }
  function weaponCard() {
    var di = dIn();
    return '<div class="card"><h2>Weapon</h2><div class="fgrid">' +
      fld('D · blade diameter, tip to tip', '<span class="wsa-du">' + numIn('d', cfg.d, cfg.unit === 'mm' ? 'e.g. 203' : 'e.g. 8') +
        '<select data-c="unit" aria-label="Diameter unit"><option value="in"' + (cfg.unit !== 'mm' ? ' selected' : '') + '>in</option><option value="mm"' + (cfg.unit === 'mm' ? ' selected' : '') + '>mm</option></select></span>') +
      fld('N · impacts per revolution', numIn('n', cfg.n, '1', ' min="1" step="1"'), 'audio only') +
      '</div><div class="note" id="wsaDin">' + (cfg.unit === 'mm' && isFinite(di) ? 'D = ' + fmt(di, 2) + ' in (mm ÷ 25.4; the formula uses inches). ' : '') + 'D is in inches like the Desmos calculator; switch to mm to type millimetres.</div>' +
      '<div class="note">N only matters when F comes from the audio: the strongest audio peak is often the tooth-pass rate (teeth × revolutions per second) rather than the rotation rate, so F = peak ÷ N (bar spinner 2, disc with 1 tooth 1, drum with 3 teeth 3; default 1). This N step is our addition, not part of the Desmos graph. ' +
      'Saved on this device for ' + esc(bot() ? bot().name : 'this robot') + ' (switch robots to switch settings).</div></div>';
  }
  function fileCard() {
    var h = '<div class="card"><h2>Recording</h2><label class="btn sm wsa-file">Choose video or audio<input type="file" id="wsaFile" accept="video/mp4,video/quicktime,video/webm,audio/*,.mp4,.mov,.m4v,.webm,.wav,.mp3,.m4a,.aac,.ogg,.opus,.flac"></label>' +
      '<div class="note">Video (mp4, mov, webm) or audio (wav, m4a, mp3, ogg, flac). <b>Nothing is uploaded:</b> the file is read and analysed in this browser tab only. Files over ' + WARN_MB + ' MB get a warning, over ' + (MAX_MB / 1024) + ' GB are refused; only the first ' + (MAX_SEC / 60) + ' minutes are analysed.</div>';
    if (st.phase === 'reading' || st.phase === 'decoding' || st.phase === 'analysing') h += '<div class="wsa-prog" role="progressbar" aria-label="' + esc(st.progLabel) + '"' + (st.phase === 'decoding' ? '' : ' aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(st.prog * 100) + '"') + '><i class="' + (st.phase === 'decoding' ? 'ind' : '') + '" style="width:' + (st.phase === 'decoding' ? 100 : Math.round(st.prog * 100)) + '%"></i></div><div class="note" id="wsaProgTxt">' + esc(st.progLabel) + '</div>';
    if (st.msg) h += '<div class="wbnote ' + st.msg.level + '" role="' + (st.msg.level === 'over' ? 'alert' : 'status') + '">' + st.msg.html + '</div>';
    if (st.x) h += '<div class="note wsa-meta">' + metaText() + '</div>';
    return h + '</div>';
  }
  function metaText() { return esc(st.name) + ' · ' + fmt(st.size / 1048576, 1) + ' MB · ' + clock(st.dur) + (st.truncated ? ' (first ' + MAX_SEC / 60 + ' min)' : '') + ' · decoded at ' + fmt(st.sr) + ' Hz · Nyquist ' + hz(st.sr / 2) + ' · max measurable ≈ ' + fmt(F.maxRpm(st.sr, N())) + ' RPM at N = ' + esc(cfg.n); }
  function resNote() { return 'Resolution: ' + fmt(F.resolution(st.sr, st.fft), 2) + ' Hz per bin (sample rate ÷ FFT size) → about ±' + fmt(F.rpmUncertainty(st.sr, st.fft, N())) + ' RPM at N = ' + esc(cfg.n) + '. A bigger FFT gives finer frequency steps but smears fast speed changes.'; }
  function opts(list, cur) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
  function specCard() {
    if (!st.x) return '';
    var res = F.resolution(st.sr, st.fft);
    return '<div class="card wsa-wide"><h2>Spectrogram</h2><div class="fgrid wsa-ctl">' +
      fld('FFT size', '<select data-s="fft">' + opts([2048, 4096, 8192, 16384, 32768].map(function (n) { return [n, n + ' · ' + fmt(st.sr / n, 1) + ' Hz bins · ' + fmt(n / st.sr * 1000) + ' ms']; }), st.fft) + '</select>') +
      fld('Band min', numIn('fmin', st.fmin, '20', ' data-s="fmin"') + '<em>Hz</em>') +
      fld('Band max', numIn('fmax', st.fmax, '4000', ' data-s="fmax"') + '<em>Hz</em>') +
      '</div><div class="note">Band = the frequencies searched for peaks and shown below; set it to skip motor rumble or ESC/PWM whine. Up to Nyquist (' + hz(st.sr / 2) + ').</div>' +
      '<div class="wsa-cv"><canvas id="wsaSg" class="wsa-sg" role="img" aria-label="Spectrogram: time left to right, frequency bottom to top, brighter is louder. Drag across it to choose the time window."></canvas></div>' +
      '<div class="note">Drag across the spectrogram (or use the sliders) to choose the time window to average, ideally a steady stretch at full speed.</div>' +
      '<div class="fgrid wsa-rng"><label class="fld"><span>Window start <b id="wsaT0l">' + clock(st.t0) + '</b></span><input type="range" id="wsaT0" min="0" max="' + st.dur.toFixed(3) + '" step="0.01" value="' + st.t0.toFixed(3) + '"></label>' +
      '<label class="fld"><span>Window end <b id="wsaT1l">' + clock(st.t1) + '</b></span><input type="range" id="wsaT1" min="0" max="' + st.dur.toFixed(3) + '" step="0.01" value="' + st.t1.toFixed(3) + '"></label></div>' +
      '<div class="sgbtns"><button type="button" class="btn ghost sm" data-a="all">Whole clip</button></div>' +
      '<div class="note" id="wsaResNote">' + resNote() + '</div></div>';
  }
  function peaksHtml() {
    if (!st.spec) return '';
    if (!st.peaks.length) return '<div class="wbnote warn">No peaks in ' + hz(st.fmin) + '–' + hz(st.fmax) + ' for this window. Widen the band or pick another window.</div>';
    var h = '<table class="sgtbl wsa-pk"><thead><tr><th scope="col">Use</th><th scope="col">#</th><th scope="col">Frequency</th><th scope="col">Level</th><th scope="col">If fundamental</th><th scope="col">vs chosen</th></tr></thead><tbody>';
    st.peaks.forEach(function (p, i) {
      var on = st.selF != null && Math.abs(p.f - st.selF) < 1e-9, ratio = st.selF ? p.f / st.selF : NaN, rtxt = '—';
      if (isFinite(ratio) && !on) { var r = Math.round(ratio); rtxt = r >= 2 && Math.abs(ratio - r) < 0.03 * r ? '×' + r + ' harmonic' : ratio < 1 && Math.abs(1 / ratio - Math.round(1 / ratio)) < 0.03 / ratio && Math.round(1 / ratio) >= 2 ? '÷' + Math.round(1 / ratio) : '×' + ratio.toFixed(2); }
      h += '<tr' + (on ? ' class="on"' : '') + '><td><input type="radio" name="wsaPk" value="' + i + '" id="wsaPk' + i + '"' + (on ? ' checked' : '') + ' aria-label="Use peak ' + (i + 1) + ', ' + esc(hz(p.f)) + ', as the weapon fundamental"></td><td>' + (i + 1) + '</td><td><label for="wsaPk' + i + '">' + hz(p.f) + '</label></td><td>' + fmt(p.db, 1) + ' dB</td><td>' + fmt(F.rpm(p.f, N())) + ' RPM</td><td>' + rtxt + '</td></tr>';
    });
    h += '</tbody></table>';
    if (st.sug) h += '<div class="wbnote warn">Suggestion only: ' + hz(st.sug.f) + ' (' + fmt(F.rpm(st.sug.f, N())) + ' RPM) is the lowest peak whose harmonics (×2, ×3…) add up to near the strongest family (harmonic-sum heuristic' + (Math.abs(st.sug.best - st.sug.f) > 1e-9 ? '; the strongest family starts at ' + hz(st.sug.best) : '') + '). Check it against the spectrogram, N and the motor’s Kv before trusting it.</div>';
    return h;
  }
  function spectrumCard() {
    if (!st.x) return '';
    return '<div class="card"><h2>Spectrum of the window</h2><div class="note" id="wsaWin">' + winText() + '</div>' +
      '<div class="wsa-cv"><canvas id="wsaSp" class="wsa-sp" role="img" aria-label="Averaged spectrum of the selected window with numbered peaks"></canvas></div>' +
      '<div class="sgbtns wsa-pkbar"><label class="fld wsa-cnt"><span>Peaks shown</span><select data-s="count">' + opts([3, 4, 6, 8, 10, 12].map(function (n) { return [n, n]; }), st.count) + '</select></label>' +
      '<button type="button" class="btn ghost sm" data-a="suggest">Suggest fundamental</button></div>' +
      '<div class="note">Pick the peak that is the weapon’s impact frequency. The loudest peak is often a harmonic (2×, 3×…) or motor/ESC noise, so it is not picked for you.</div>' +
      '<div id="wsaPeaks">' + peaksHtml() + '</div></div>';
  }
  function winText() { return st.spec ? 'Window ' + clock(Math.min(st.t0, st.t1)) + '–' + clock(Math.max(st.t0, st.t1)) + ' · ' + st.spec.frames + ' frame' + (st.spec.frames === 1 ? '' : 's') + ' averaged · ' + hz(st.fmin) + '–' + hz(st.fmax) : ''; }
  function speedRows(Fr, src) {
    var o = F.fromF(Fr, dIn()), di = dIn();
    return '<div class="wsa-head">' + (isFinite(o.mph) ? '<div class="wsa-mph"><b>' + fmt(o.mph, 1) + '</b> mph</div><div class="note wsa-form">S = π × F × D ÷ 17.6 = π × ' + fmt(Fr, 2) + ' × ' + fmt(di, 2) + ' ÷ 17.6' + (src ? ' · F ' + src : '') + '</div>' :
        '<div class="wsa-mph wsa-dim">S = — mph</div><div class="note wsa-form">Enter D (blade diameter) to get the tip speed S = π × F × D ÷ 17.6.</div>') + '</div>' +
      '<div class="wbkv wsa-kv"><span>F (weapon frequency)</span><b>' + fmt(Fr, 2) + ' Hz (rev/s)</b><span>RPM (60 × F)</span><b>' + fmt(o.rpm) + ' RPM</b>' +
      (isFinite(o.mph) ? '<span>Also</span><b>' + fmt(o.mps, 1) + ' m/s · ' + fmt(o.fts, 0) + ' ft/s</b>' : '') + '</div>';
  }
  function kvText(r) {
    var ceil = F.kvRpm(cfg.kv, cfg.volts, cfg.ratio), h = '';
    if (isFinite(ceil) && ceil > 0) {
      h += 'No-load ceiling ≈ ' + fmt(ceil) + ' weapon RPM (Kv × V ÷ reduction). Real weapons spin below it (load, sag, ESC limits).';
      if (isFinite(r)) { var pct = r / ceil * 100; h += ' Measured = ' + fmt(pct) + '% of it.' + (pct > 105 ? ' <b class="wbwarn">Above the ceiling: the chosen peak is probably a harmonic, or N is too low.</b>' : pct < 35 ? ' <b class="wbwarn">Far below: maybe a subharmonic, N too high, or not at full speed.</b>' : ''); }
    } else h += 'Enter Kv and voltage to compare the measured RPM with the motor’s no-load speed.';
    return h;
  }
  function kvHtml() {
    return '<details class="wsa-kvd"' + (cfg.kv ? ' open' : '') + '><summary>Sanity check: motor Kv × voltage</summary><div class="fgrid wb3">' +
      fld('Motor Kv', numIn('kv', cfg.kv, 'RPM/V')) + fld('Pack voltage', numIn('volts', cfg.volts, 'e.g. 22.2') + '<em>V</em>') + fld('Reduction', numIn('ratio', cfg.ratio, '1 = direct'), 'motor turns per weapon turn') + '</div>' +
      '<div class="note" id="wsaKvRes">' + kvText(curRpm()) + '</div></details>';
  }
  function curRpm() { return st.selF != null ? F.rpm(st.selF, N()) : st.manual.val ? F.fromF(manF(), dIn()).rpm : NaN; }
  function resultHtml() {
    var h = '', n = N();
    if (!isFinite(n)) return '<div class="wbnote warn">Enter the impacts per revolution (N).</div>';
    if (st.selF != null) {
      var r = F.rpm(st.selF, n), u = st.spec ? F.rpmUncertainty(st.sr, st.fft, n) : NaN;
      h += '<div class="note">From the chosen peak' + (st.selSrc === 'suggest' ? ' <b class="wbwarn">(suggested, not confirmed)</b>' : '') + ': ' + hz(st.selF) + ' ÷ N (' + esc(cfg.n) + ') = F.</div>' + speedRows(st.selF / n, 'from audio') +
        '<div class="note">Uncertainty from bin size alone: about ±' + fmt(u) + ' RPM (F ±' + fmt(st.sr / st.fft / 2 / n, 2) + ' Hz' + (isFinite(dIn()) ? ', S ±' + fmt(F.desmosMph(st.sr / st.fft / 2 / n, dIn()), 1) + ' mph' : '') + '). Real error can be larger (see the accuracy notes).' +
        (st.selF > 0.8 * st.sr / 2 ? ' <b class="wbwarn">This is close to Nyquist (' + hz(st.sr / 2) + '): the recording may not capture it reliably.</b>' : '') + '</div>';
    } else h += '<div class="note">' + (st.x ? 'Choose a peak in the list to get the weapon speed.' : 'Load a clip, or use the plain calculator below.') + '</div>';
    return h;
  }
  function resultCard() { return '<div class="card"><h2>Result · tip speed S</h2><div id="wsaRes">' + resultHtml() + '</div>' + kvHtml() + '<div class="note">Formula from ' + DESMOS + ' (the source used here): F = weapon frequency in Hz, D = blade diameter in inches, S = tip speed in mph; 17.6 = 63,360 in per mile ÷ 3,600 s.</div></div>'; }
  function trackHtml() {
    if (!st.tr) return st.sg && st.sg.done < st.sg.frames ? '' : '';
    var t = st.tr.top, n = N();
    if (!t) return '<div class="wbnote warn">Nothing loud enough to track in ' + hz(st.tmin) + '–' + hz(st.tmax) + '.</div>';
    return '<div class="note">Top speed at ' + clock(t.t) + ': peak ' + hz(t.f) + ' ÷ N (' + esc(cfg.n) + ') = F.</div>' + speedRows(t.f / n, 'from the RPM track') +
      '<div class="note">Per frame (' + fmt(st.tr.dt * 1000) + ' ms steps) the strongest peak in the track band is taken, a 5-frame median removes spikes, and quiet frames are skipped. ' +
      'If the line jumps to double or half speed it is following a harmonic: narrow the band around the fundamental.</div>';
  }
  function trackCard() {
    if (!st.x) return '';
    return '<div class="card wsa-wide"><h2>RPM over time</h2><div class="fgrid wsa-trc">' +
      fld('Track band min', numIn('tmin', st.tmin, '20', ' data-s="tmin"') + '<em>Hz</em>') + fld('Track band max', numIn('tmax', st.tmax, '4000', ' data-s="tmax"') + '<em>Hz</em>') +
      '<label class="sgchk wsa-oct"><input type="checkbox" data-s="octave"' + (st.octave ? ' checked' : '') + '> <span>Octave check (prefer ½ or ⅓ of the pick when nearly as loud) <b class="sgtag">heuristic</b></span></label></div>' +
      '<div class="sgbtns"><button type="button" class="btn ghost sm" data-a="fitband"' + (st.selF ? '' : ' disabled') + '>Fit band to chosen peak</button></div>' +
      '<div class="wsa-cv"><canvas id="wsaTr" class="wsa-tr" role="img" aria-label="Weapon RPM over time, with the top speed marked"></canvas></div><div id="wsaTop">' + trackHtml() + '</div></div>';
  }
  function manF() { var m = st.manual, v = F.num(m.val); return m.mode === 'rpm' ? v / 60 : m.mode === 'hz' ? v / N() : v; }
  function manRes() {
    var m = st.manual, v = F.num(m.val), Fr = manF();
    return v > 0 && isFinite(Fr) ? speedRows(Fr, m.mode === 'f' ? 'typed in' : m.mode === 'rpm' ? '= RPM ÷ 60' : '= impacts ÷ N') : '<div class="note">Type F (and D above) to get S = π × F × D ÷ 17.6 in mph, same as the Desmos calculator.</div>';
  }
  function manualHtml() {
    var m = st.manual, lab = { f: ['F · weapon frequency', 'Hz', 'e.g. 140'], rpm: ['Weapon RPM', 'RPM', 'e.g. 8400'], hz: ['Impacts per second', 'Hz', 'e.g. 280'] }[m.mode] || ['F', 'Hz', ''];
    var h = '<div class="fgrid">' + fld('I know', '<select data-m="mode"><option value="f"' + (m.mode === 'f' ? ' selected' : '') + '>F, revolutions per second (Hz)</option><option value="rpm"' + (m.mode === 'rpm' ? ' selected' : '') + '>Weapon RPM (F = RPM ÷ 60)</option><option value="hz"' + (m.mode === 'hz' ? ' selected' : '') + '>Impacts per second (F = that ÷ N)</option></select>') +
      fld(lab[0], '<input type="number" inputmode="decimal" step="any" min="0" data-m="val" value="' + esc(m.val) + '" placeholder="' + lab[2] + '"><em>' + lab[1] + '</em>') + '</div>';
    return h + '<div id="wsaManRes">' + manRes() + '</div>';
  }
  function manualCard() { return '<div class="card"><h2>Plain calculator <b class="sgtag">no audio needed</b></h2><div id="wsaMan">' + manualHtml() + '</div></div>'; }
  function notesHtml() {
    var sr = st.sr || SR, res = F.resolution(sr, st.fft);
    return '<details class="card wsa-notes wsa-wide"><summary>Accuracy notes and limits (read before trusting a number)</summary><ul class="note sglist">' +
      '<li><b>This is an estimate.</b> Sanity-check it against motor Kv × voltage (above) and what you see on video.</li>' +
      '<li><b>Resolution:</b> sample rate ÷ FFT size = ' + fmt(sr, 0) + ' ÷ ' + st.fft + ' = ' + fmt(res, 2) + ' Hz per bin, about ±' + fmt(F.rpmUncertainty(sr, st.fft, N())) + ' RPM at N = ' + esc(cfg.n) + '. Peak interpolation can do better on a clean steady tone, but the app only claims ± half a bin. Averaging more frames lowers noise, not the bin size.</li>' +
      '<li><b>Harmonics and subharmonics:</b> a 2-tooth weapon at 100 rev/s (6,000 RPM) makes a 200 Hz fundamental plus 400, 600 Hz… An unbalanced weapon can also show the rev rate itself (100 Hz here), which looks like a subharmonic. Wrong N or picking a harmonic changes the answer by 2× or 3×.</li>' +
      '<li><b>Other sounds:</b> motor whine (poles × motor rev/s), ESC PWM tones (often several kHz, constant while the speed changes), drive motors, belts, the arena and people. Use the band limits to leave them out. A tone that stays flat while the weapon spins up is not the weapon.</li>' +
      '<li><b>Doppler and movement:</b> a robot driving toward or away from the phone shifts frequencies by about v ÷ 343 m/s (≈0.9% at 3 m/s). Rolling, impacts and floor scraping add broadband noise. Film a stationary robot, phone held still, for the cleanest reading.</li>' +
      '<li><b>Sample rate and Nyquist:</b> the audio is decoded at ' + fmt(sr) + ' Hz, so nothing above ' + hz(sr / 2) + ' can be measured (≈' + fmt(F.maxRpm(sr, 1)) + ' RPM at N = 1, plenty for weapons). The browser resamples on decode, and the original recording may have a lower rate. Phone audio is often compressed (AAC), which can cut the highest frequencies. Above about 80% of Nyquist the app warns. Tones above Nyquist are normally filtered out by the recorder, but if not they fold back (alias) as false lower tones.</li>' +
      '<li><b>Phone audio processing:</b> automatic gain control, noise suppression and compression change levels and can distort or remove tones. Clipping (a very loud weapon close to the mic) adds false harmonics. Record from a few metres away and avoid “voice” or noise-reduction modes if your phone has them.</li>' +
      '<li><b>Spin-up and spin-down:</b> a long FFT averages over its length (' + fmt(st.fft / sr * 1000) + ' ms now), so fast speed changes smear and the RPM track lags. Use a smaller FFT for the track and a bigger one for a steady top speed.</li>' +
      '<li><b>Formulas:</b> tip speed S (mph) = π × F × D ÷ 17.6 with F in Hz (rev/s) and D in inches, from ' + DESMOS + ' (17.6 = 63,360 in/mile ÷ 3,600 s/h). From audio, F = peak frequency ÷ N (our addition). RPM = 60 × F. m/s = mph × 0.44704 and ft/s = mph × 5280 ÷ 3600 (exact). The FFT is a standard radix-2 Cooley–Tukey transform with a Hann window, written for this app (no external code).</li>' +
      '<li>Video files: some containers and codecs (for example iPhone .mov, often HEVC video) don’t decode in every browser. If yours fails, share or export the clip as audio (m4a/wav) or re-export as an H.264 MP4.</li></ul></details>';
  }
  function render() {
    if (!root) return;
    load();
    var b = bot(), h = '<div class="calcbar"><button class="back" data-back>‹ Calculators</button></div><div class="wbhead wsahead"><div><div class="wbtitle">Weapon speed analyzer <span class="tbuild">Work in progress</span></div>' +
      '<div class="note">' + esc(b ? b.name : '') + ' · frequency analyzer: tip speed S = π × F × D ÷ 17.6 (mph) with F from the sound of a video or audio clip, or typed in. Runs in this browser, nothing is uploaded.</div></div></div>';
    h += '<div class="wsa-grid">' + weaponCard() + fileCard() + specCard() + spectrumCard() + resultCard() + trackCard() + manualCard() + notesHtml() + '</div>';
    var ae = document.activeElement, key = ae && root.contains(ae) ? (ae.id ? '#' + ae.id : ['c', 'm', 's', 'a'].map(function (k) { return ae.dataset && ae.dataset[k] ? '[data-' + k + '="' + ae.dataset[k] + '"]' : ''; }).join('')) : '';
    root.innerHTML = h;
    if (key) { var nf = root.querySelector(key); if (nf) try { nf.focus({ preventScroll: true }); } catch (e) {} }
    drawAll();
  }

  /* ---------- drawing ---------- */
  var CM = [[0, [18, 18, 18]], [0.3, [58, 10, 70]], [0.55, [200, 30, 190]], [0.78, [255, 140, 40]], [1, [255, 240, 190]]];
  function cmap(v) {
    v = Math.max(0, Math.min(1, v)); for (var i = 1; i < CM.length; i++) if (v <= CM[i][0]) { var a = CM[i - 1], b = CM[i], u = (v - a[0]) / (b[0] - a[0]); return [0, 1, 2].map(function (j) { return Math.round(a[1][j] + (b[1][j] - a[1][j]) * u); }); }
    return CM[CM.length - 1][1];
  }
  function prep(cv) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(10, cv.clientWidth), h = Math.max(10, cv.clientHeight);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); return { g: g, w: w, h: h };
  }
  var PAD = { l: 44, r: 8, t: 8, b: 20 }, sgImg = null, sgKey = '';
  function sgImage() {
    var sg = st.sg, key = [sg && sg.done, st.fft, st.fmax].join('|'); if (!sg) return null; if (sgImg && sgKey === key) return sgImg;
    var rows = 256, kmax = Math.min(sg.bins - 1, Math.ceil(st.fmax / sg.df)), c = document.createElement('canvas'); c.width = sg.frames; c.height = rows;
    var g = c.getContext('2d'), im = g.createImageData(sg.frames, rows), mx = 1e-20, i, r, k;
    for (i = 0; i < sg.done; i++) for (k = 1; k <= kmax; k++) if (sg.data[i * sg.bins + k] > mx) mx = sg.data[i * sg.bins + k];
    var top = F.db(mx), range = 70;
    for (i = 0; i < sg.frames; i++) for (r = 0; r < rows; r++) {
      var k0 = Math.floor(r / rows * kmax), k1 = Math.max(k0, Math.floor((r + 1) / rows * kmax) - 1), p = 0;
      if (i < sg.done) for (k = k0; k <= k1; k++) if (sg.data[i * sg.bins + k] > p) p = sg.data[i * sg.bins + k];
      var col = i < sg.done ? cmap((F.db(p) - top + range) / range) : [18, 18, 18], o = ((rows - 1 - r) * sg.frames + i) * 4;
      im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = 255;
    }
    g.putImageData(im, 0, 0); sgImg = c; sgKey = key; return c;
  }
  function axisY(g, w, h, max, lab) {
    g.fillStyle = '#8c8c8c'; g.font = '10px system-ui,sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
    for (var i = 0; i <= 4; i++) { var v = max * i / 4, y = PAD.t + (h - PAD.t - PAD.b) * (1 - i / 4); g.fillText(lab(v), PAD.l - 4, y); g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(PAD.l, y); g.lineTo(w - PAD.r, y); g.stroke(); }
  }
  function axisT(g, w, h) {
    g.fillStyle = '#8c8c8c'; g.textAlign = 'center'; g.textBaseline = 'top';
    for (var i = 0; i <= 4; i++) { var t = st.dur * i / 4; g.fillText(t.toFixed(1) + 's', PAD.l + (w - PAD.l - PAD.r) * i / 4, h - PAD.b + 4); }
  }
  function tx(t, w) { return PAD.l + (w - PAD.l - PAD.r) * (st.dur ? t / st.dur : 0); }
  function kfmt(v) { return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : String(Math.round(v)); }
  function drawSg() {
    var cv = $('wsaSg'); if (!cv || !st.sg) return; var P = prep(cv), g = P.g, w = P.w, h = P.h, img = sgImage();
    g.imageSmoothingEnabled = false; if (img) g.drawImage(img, PAD.l, PAD.t, w - PAD.l - PAD.r, h - PAD.t - PAD.b);
    axisY(g, w, h, st.fmax, function (v) { return kfmt(v) + 'Hz'; }); axisT(g, w, h);
    var a = tx(Math.min(st.t0, st.t1), w), b = tx(Math.max(st.t0, st.t1), w);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(PAD.l, PAD.t, a - PAD.l, h - PAD.t - PAD.b); g.fillRect(b, PAD.t, w - PAD.r - b, h - PAD.t - PAD.b);
    g.strokeStyle = '#ffa621'; g.lineWidth = 2; g.strokeRect(a, PAD.t + 1, Math.max(2, b - a), h - PAD.t - PAD.b - 2);
    if (st.fmin > 0) { var yb = PAD.t + (h - PAD.t - PAD.b) * (1 - st.fmin / st.fmax); g.strokeStyle = 'rgba(140,255,26,.6)'; g.setLineDash([4, 4]); g.lineWidth = 1; g.beginPath(); g.moveTo(PAD.l, yb); g.lineTo(w - PAD.r, yb); g.stroke(); g.setLineDash([]); }
    if (st.selF) { var ys = PAD.t + (h - PAD.t - PAD.b) * (1 - st.selF / st.fmax); if (ys > PAD.t) { g.strokeStyle = 'rgba(34,211,255,.8)'; g.lineWidth = 1; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(PAD.l, ys); g.lineTo(w - PAD.r, ys); g.stroke(); g.setLineDash([]); } }
  }
  function drawSp() {
    var cv = $('wsaSp'); if (!cv || !st.spec) return; var P = prep(cv), g = P.g, w = P.w, h = P.h, sp = st.spec, df = st.sr / st.fft;
    var k0 = Math.max(1, Math.floor(st.fmin / df)), k1 = Math.min(sp.length - 1, Math.ceil(st.fmax / df)), mx = 1e-20, k;
    for (k = k0; k <= k1; k++) if (sp[k] > mx) mx = sp[k];
    var top = F.db(mx), rng = 60, X = function (f) { return PAD.l + (w - PAD.l - PAD.r) * (f - st.fmin) / (st.fmax - st.fmin); }, Y = function (d) { return PAD.t + (h - PAD.t - PAD.b) * Math.min(1, Math.max(0, (top - d) / rng)); };
    g.fillStyle = '#8c8c8c'; g.font = '10px system-ui,sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
    for (var i = 0; i <= 3; i++) { var y = PAD.t + (h - PAD.t - PAD.b) * i / 3; g.fillText(-rng * i / 3 + 'dB', PAD.l - 4, y); g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(PAD.l, y); g.lineTo(w - PAD.r, y); g.stroke(); }
    g.textAlign = 'center'; g.textBaseline = 'top'; for (i = 0; i <= 4; i++) { var f = st.fmin + (st.fmax - st.fmin) * i / 4; g.fillText(kfmt(f) + 'Hz', X(f), h - PAD.b + 4); }
    g.strokeStyle = '#ff2bf0'; g.lineWidth = 1.2; g.beginPath(); var px = -1, pv = -Infinity;
    for (k = k0; k <= k1; k++) { var x = Math.round(X(k * df)), d = F.db(sp[k]); if (x !== px) { if (px >= 0) g.lineTo(px, Y(pv)); else g.moveTo(x, Y(d)); px = x; pv = d; } else if (d > pv) pv = d; }
    g.lineTo(px, Y(pv)); g.stroke();
    st.peaks.forEach(function (p, j) {
      var on = st.selF != null && Math.abs(p.f - st.selF) < 1e-9, x2 = X(p.f), y2 = Y(F.db(p.p));
      g.fillStyle = on ? '#22d3ff' : '#ffa621'; g.beginPath(); g.arc(x2, y2, on ? 5 : 3.5, 0, 7); g.fill();
      g.fillStyle = '#f2f2f2'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.font = 'bold 10px system-ui,sans-serif'; g.fillText(String(j + 1), x2, y2 - 6);
    });
  }
  function drawTr() {
    var cv = $('wsaTr'); if (!cv || !st.tr) return; var P = prep(cv), g = P.g, w = P.w, h = P.h, n = N(), pts = st.tr.points, mx = 0;
    pts.forEach(function (p) { if (p.f != null) mx = Math.max(mx, F.rpm(p.f, n)); });
    if (!(mx > 0)) mx = F.rpm(st.tmax, n) || 1; mx *= 1.12;
    axisY(g, w, h, mx, function (v) { return kfmt(v); }); axisT(g, w, h);
    g.save(); g.translate(8, PAD.t + (h - PAD.t - PAD.b) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillStyle = '#8c8c8c'; g.fillText('RPM', 0, 0); g.restore();
    var a = tx(Math.min(st.t0, st.t1), w), b = tx(Math.max(st.t0, st.t1), w); g.fillStyle = 'rgba(255,166,33,.08)'; g.fillRect(a, PAD.t, Math.max(1, b - a), h - PAD.t - PAD.b);
    var Y = function (r) { return PAD.t + (h - PAD.t - PAD.b) * (1 - r / mx); };
    g.strokeStyle = '#ffa621'; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath(); var pen = false;
    pts.forEach(function (p) { if (p.f == null) { pen = false; return; } var x = tx(p.t, w), y = Y(F.rpm(p.f, n)); if (pen) g.lineTo(x, y); else g.moveTo(x, y); pen = true; }); g.stroke();
    var t = st.tr.top; if (t) {
      var x = tx(t.t, w), y = Y(F.rpm(t.f, n)); g.fillStyle = '#ff2bf0'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
      g.fillStyle = '#f2f2f2'; g.font = 'bold 11px system-ui,sans-serif'; g.textBaseline = 'bottom'; g.textAlign = x > w - 120 ? 'right' : 'left';
      g.fillText('Top ≈ ' + fmt(F.rpm(t.f, n)) + ' RPM', x + (x > w - 120 ? -8 : 8), Math.max(PAD.t + 12, y - 6));
    }
  }
  function drawAll() { drawSg(); drawSp(); drawTr(); }

  /* ---------- analysis ---------- */
  function clampBand() {
    var nyq = st.sr / 2 || SR / 2;
    st.fmin = Math.max(0, Math.min(F.num(st.fmin) || 0, nyq - 10)); st.fmax = Math.min(nyq, Math.max(st.fmin + 10, F.num(st.fmax) || 4000));
    st.tmin = Math.max(0, Math.min(F.num(st.tmin) || 0, nyq - 10)); st.tmax = Math.min(nyq, Math.max(st.tmin + 10, F.num(st.tmax) || st.fmax));
  }
  function updateSpectrum(keepSel) {
    if (!st.sg || st.sg.done < st.sg.frames) return;
    st.spec = F.avgSpectrum(st.sg, st.t0, st.t1);
    st.peaks = F.findPeaks(st.spec, st.sr, st.fft, { fmin: st.fmin, fmax: st.fmax, count: st.count, minSep: 3 });
    st.sug = null;
    if (st.selF != null && keepSel !== false) {
      var tol = Math.max(2 * st.sr / st.fft, 0.03 * st.selF), best = null;
      st.peaks.forEach(function (p) { if (Math.abs(p.f - st.selF) <= tol && (!best || Math.abs(p.f - st.selF) < Math.abs(best.f - st.selF))) best = p; });
      st.selF = best ? best.f : null; if (!best) st.selSrc = '';
    }
  }
  function updateTrack() { if (st.sg && st.sg.done >= st.sg.frames) st.tr = F.track(st.sg, { fmin: st.tmin, fmax: st.tmax, octave: st.octave }); }
  function refreshParts() {
    var el;
    if ((el = $('wsaPeaks'))) el.innerHTML = peaksHtml();
    if ((el = $('wsaWin'))) el.textContent = winText();
    if ((el = $('wsaRes'))) el.innerHTML = resultHtml();
    if ((el = $('wsaTop'))) el.innerHTML = trackHtml();
    if ((el = $('wsaManRes'))) el.innerHTML = manRes();
    if ((el = $('wsaKvRes'))) el.innerHTML = kvText(curRpm());
    if ((el = root.querySelector('.wsa-meta'))) el.innerHTML = metaText();
    if ((el = $('wsaResNote'))) el.innerHTML = resNote();
    var fb = root.querySelector('[data-a="fitband"]'); if (fb) fb.disabled = !st.selF;
    drawAll();
  }
  function analyse() {
    var tok = ++st.token; st.sg = F.spectrogramJob(st.x, st.sr, st.fft, { maxFrames: 1200, maxCells: 6e6 }); st.spec = null; st.peaks = []; st.tr = null; sgImg = null;
    st.phase = 'analysing'; st.prog = 0; st.progLabel = 'Analysing… 0%'; render();
    var t0 = performance.now();
    (function tick() {
      if (tok !== st.token) return;
      var done = st.sg.step(Math.max(4, Math.round(200000 / st.fft)));
      st.prog = st.sg.done / st.sg.frames; st.progLabel = 'Analysing… ' + Math.round(st.prog * 100) + '%';
      var bar = root && root.querySelector('.wsa-prog i'), txt = $('wsaProgTxt');
      if (bar) { bar.style.width = Math.round(st.prog * 100) + '%'; bar.parentNode.setAttribute('aria-valuenow', Math.round(st.prog * 100)); } if (txt) txt.textContent = st.progLabel;
      if (!done) { setTimeout(tick, 0); return; }
      st.phase = 'ready'; updateSpectrum(); updateTrack(); st.ms = performance.now() - t0; render();
    })();
  }
  function fail(html) { st.phase = st.x ? 'ready' : 'empty'; st.msg = { level: 'over', html: html }; render(); }
  function decodeErr(f) {
    var mov = /\.mov$|quicktime/i.test(f.name + ' ' + f.type), vid = /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name);
    return 'This browser could not decode the audio in <b>' + esc(f.name) + '</b>' + (f.type ? ' (' + esc(f.type) + ')' : '') + '. ' +
      (vid ? 'The clip may have no audio track, or its container/codec isn’t supported here' + (mov ? ' (iPhone .mov files, often HEVC video, don’t decode in every browser)' : '') + '. ' : 'The format may not be supported in this browser. ') +
      'Try: share or export the clip as an audio file (m4a or wav), re-export the video as an H.264 MP4, or open the app in another browser (Safari on iPhone, Chrome on Android). You can also type a known RPM in the plain calculator.';
  }
  function onFile(f) {
    if (!f) return; st.token++; st.msg = null;
    var mb = f.size / 1048576;
    if (mb > MAX_MB) { fail('<b>' + esc(f.name) + '</b> is ' + fmt(mb, 0) + ' MB, over the ' + (MAX_MB / 1024) + ' GB limit: the whole file plus its decoded audio must fit in this tab’s memory. Trim the clip to the spin-up (a few seconds is enough) or export just the audio.'); return; }
    var warn = mb > WARN_MB ? 'Large file (' + fmt(mb, 0) + ' MB): decoding needs a lot of memory and may fail or be slow, especially on phones. A short trimmed clip or an audio-only export works better.' : '';
    st.x = null; st.sg = null; st.spec = null; st.peaks = []; st.tr = null; st.selF = null; st.selSrc = ''; st.sug = null;
    st.name = f.name; st.size = f.size; st.type = f.type; st.phase = 'reading'; st.prog = 0; st.progLabel = 'Reading file… 0%'; if (warn) st.msg = { level: 'warn', html: esc(warn) }; render();
    var tok = st.token, rd = new FileReader();
    rd.onprogress = function (e) { if (tok !== st.token || !e.lengthComputable) return; st.prog = e.loaded / e.total; st.progLabel = 'Reading file… ' + Math.round(st.prog * 100) + '%'; var bar = root && root.querySelector('.wsa-prog i'), txt = $('wsaProgTxt'); if (bar) bar.style.width = Math.round(st.prog * 100) + '%'; if (txt) txt.textContent = st.progLabel; };
    rd.onerror = function () { if (tok === st.token) fail('Could not read <b>' + esc(f.name) + '</b> from the device.'); };
    rd.onload = function () {
      if (tok !== st.token) return; st.phase = 'decoding'; st.progLabel = 'Decoding audio… (no progress available for this step)'; render();
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC) { fail('This browser has no Web Audio API, so the audio can’t be decoded here. Use the plain calculator.'); return; }
      var ctx; try { ctx = new OAC(1, 1, SR); } catch (e) { fail('Could not start the audio decoder in this browser.'); return; }
      var done = false, ok = function (buf) {
        if (done || tok !== st.token) return; done = true;
        if (!buf || !buf.length) { fail(decodeErr(f)); return; }
        var len = Math.min(buf.length, Math.round(MAX_SEC * buf.sampleRate)), x = new Float32Array(len), ch = buf.numberOfChannels;
        for (var c = 0; c < ch; c++) { var d = buf.getChannelData(c); for (var i = 0; i < len; i++) x[i] += d[i] / ch; }
        var peak = 0; for (var j = 0; j < len; j++) { var a = Math.abs(x[j]); if (a > peak) peak = a; }
        st.x = x; st.sr = buf.sampleRate; st.dur = len / buf.sampleRate; st.truncated = buf.length > len; st.t0 = 0; st.t1 = st.dur;
        var notes = []; if (warn) notes.push(esc(warn));
        if (st.truncated) notes.push('Clip is ' + clock(buf.length / buf.sampleRate) + ': only the first ' + MAX_SEC / 60 + ' minutes are analysed.');
        if (peak < 1e-4) notes.push('The audio is silent or nearly silent, so there is nothing to measure.');
        else if (peak > 0.985) notes.push('The audio reaches full scale (clipping): distortion adds false harmonics. Record further from the weapon if you can.');
        if (st.dur < 0.2) notes.push('Very short clip: frequency resolution will be poor.');
        st.msg = notes.length ? { level: 'warn', html: notes.join(' ') } : null;
        clampBand(); analyse();
      };
      var bad = function () { if (!done && tok === st.token) { done = true; fail((warn ? esc(warn) + '<br>' : '') + decodeErr(f)); } };
      try { var p = ctx.decodeAudioData(rd.result, ok, bad); if (p && p.then) p.then(ok, bad); } catch (e) { bad(); }
    };
    rd.readAsArrayBuffer(f);
  }

  /* ---------- events ---------- */
  var drag = null;
  function tAt(e) { var cv = $('wsaSg'), r = cv.getBoundingClientRect(), u = (e.clientX - r.left - PAD.l) / (r.width - PAD.l - PAD.r); return Math.max(0, Math.min(1, u)) * st.dur; }
  function syncRange() { var a = $('wsaT0'), b = $('wsaT1'); if (a) a.value = st.t0; if (b) b.value = st.t1; if ($('wsaT0l')) $('wsaT0l').textContent = clock(st.t0); if ($('wsaT1l')) $('wsaT1l').textContent = clock(st.t1); }
  function onPointer(e) {
    if (e.target.id !== 'wsaSg' && !drag) return;
    if (e.type === 'pointerdown') { if (!st.sg || st.phase !== 'ready') return; drag = { id: e.pointerId, a: tAt(e), x: e.clientX, moved: false }; try { e.target.setPointerCapture(e.pointerId); } catch (er) {} return; }
    if (!drag || e.pointerId !== drag.id) return;
    if (e.type === 'pointermove') { if (Math.abs(e.clientX - drag.x) > 4) drag.moved = true; if (!drag.moved) return; var t = tAt(e); st.t0 = Math.min(drag.a, t); st.t1 = Math.max(drag.a, t); syncRange(); drawSg(); drawTr(); return; }
    if (e.type === 'pointerup' || e.type === 'pointercancel') { var was = drag.moved; drag = null; if (was && e.type === 'pointerup') { if (st.t1 - st.t0 < st.fft / st.sr) { var m = (st.t0 + st.t1) / 2, hw = st.fft / st.sr; st.t0 = Math.max(0, m - hw); st.t1 = Math.min(st.dur, m + hw); syncRange(); } updateSpectrum(); refreshParts(); } }
  }
  function onInput(e) {
    var t = e.target, k;
    if (t.id === 'wsaT0' || t.id === 'wsaT1') {
      var v = F.num(t.value); if (t.id === 'wsaT0') st.t0 = Math.min(v, st.t1); else st.t1 = Math.max(v, st.t0); syncRange(); drawSg(); drawTr();
      if (e.type === 'change') { updateSpectrum(); refreshParts(); } return;
    }
    if ((k = t.dataset.c)) {
      if (k === 'unit') { var d0 = F.num(cfg.d); if (d0 > 0 && t.value !== cfg.unit) cfg.d = String(+(t.value === 'mm' ? d0 * 25.4 : d0 / 25.4).toFixed(t.value === 'mm' ? 1 : 3)); cfg.unit = t.value; save(); render(); return; }
      cfg[k] = t.value; save();
      if (k === 'd') { var dn = $('wsaDin'); if (dn) dn.innerHTML = (cfg.unit === 'mm' && isFinite(dIn()) ? 'D = ' + fmt(dIn(), 2) + ' in (mm ÷ 25.4; the formula uses inches). ' : '') + 'D is in inches like the Desmos calculator; switch to mm to type millimetres.'; }
      refreshParts(); return;
    }
    if ((k = t.dataset.m)) { st.manual[k] = t.value; if (k === 'mode') { if (e.type === 'change') { $('wsaMan').innerHTML = manualHtml(); var sm = root.querySelector('[data-m="mode"]'); if (sm) sm.focus(); } return; } refreshParts(); return; }
    if ((k = t.dataset.s)) {
      if (e.type === 'input' && t.type === 'number') return; // apply band/limits on change (blur/enter), not every keystroke
      if (k === 'octave') st.octave = t.checked; else if (k === 'fft' || k === 'count') st[k] = +t.value; else st[k] = F.num(t.value);
      clampBand();
      if (k === 'fft') { analyse(); return; }
      if (k === 'fmin' || k === 'fmax' || k === 'count') { sgImg = null; updateSpectrum(); }
      if (k === 'tmin' || k === 'tmax' || k === 'octave') updateTrack();
      render();
    }
  }
  function onClick(e) {
    var b = e.target.closest('button,input[type=radio]'); if (!b || !root.contains(b)) return;
    if (b.hasAttribute('data-back')) return; // handled by calcs.js
    if (b.name === 'wsaPk') { var p = st.peaks[+b.value]; if (p) { st.selF = p.f; st.selSrc = 'peak'; var s = st.sug; refreshParts(); st.sug = s; var pk = $('wsaPeaks'); if (pk) pk.innerHTML = peaksHtml(); var r = root.querySelector('input[name=wsaPk][value="' + b.value + '"]'); if (r) r.focus(); } return; }
    var a = b.dataset.a;
    if (a === 'all') { st.t0 = 0; st.t1 = st.dur; updateSpectrum(); render(); }
    else if (a === 'suggest') {
      var sg = st.spec && F.suggest(st.spec, st.sr, st.fft, st.peaks);
      if (!sg) { st.sug = null; refreshParts(); return; }
      var match = st.peaks.filter(function (q) { return Math.abs(q.f - sg.f) < 1e-9; })[0]; st.selF = match ? match.f : sg.f; st.selSrc = 'suggest';
      refreshParts(); st.sug = sg; $('wsaPeaks').innerHTML = peaksHtml();
      var res = $('wsaRes'); if (res) res.closest('.card').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' });
    } else if (a === 'fitband' && st.selF) { st.tmin = Math.max(1, Math.round(st.selF * 0.5)); st.tmax = Math.min(st.sr / 2, Math.round(st.selF * 1.4)); clampBand(); updateTrack(); render(); }
  }
  var rz = null;
  window.addEventListener('resize', function () { if (!shown()) return; cancelAnimationFrame(rz); rz = requestAnimationFrame(drawAll); });
  function shown() { return !!(root && root.querySelector('.wsahead')); }
  window.FreqView = {
    mount: function (el) {
      if (bound.indexOf(el) < 0) {
        bound.push(el);
        el.addEventListener('input', function (e) { if (root === el && shown()) onInput(e); });
        el.addEventListener('change', function (e) { if (root !== el || !shown()) return; if (e.target.id === 'wsaFile') { onFile(e.target.files && e.target.files[0]); e.target.value = ''; } else onInput(e); });
        el.addEventListener('click', function (e) { if (root === el && shown()) onClick(e); });
        ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(function (t) { el.addEventListener(t, function (e) { if (root === el && shown()) onPointer(e); }); });
      }
      root = el; render();
    },
    rerender: function () { if (shown()) render(); },
    _state: st
  };
})();
