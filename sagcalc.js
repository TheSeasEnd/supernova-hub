/* Battery Sag & Wh calculator UI (general purpose: any robot, any pack). Math lives in sagmath.js.
   State is saved on this device only (localStorage 'sag_calc_v1'), with optional named profiles. Nothing is prefilled
   for a specific robot; "Fill example" loads a clearly-labelled generic example. */
(function () {
  'use strict';
  var M = window.SagMath, KEY = 'sag_calc_v1';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function f(x, d) { return isFinite(x) ? (+x).toFixed(d == null ? 1 : d) : '—'; }
  function load() {
    try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && d.cur && d.cur.version === 1) return d; } catch (e) {}
    return { cur: M.defaults(), profiles: {} };
  }
  var DB = load(), root = null;
  function S() { return DB.cur; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }
  function get(path) { var o = S(), p = path.split('.'); for (var i = 0; i < p.length; i++) { if (o == null) return ''; o = o[p[i]]; } return o == null ? '' : o; }
  function set(path, v) { var o = S(), p = path.split('.'); for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v; }

  function fld(label, path, unit, opts) {
    opts = opts || {};
    return '<label class="fld' + (opts.cls ? ' ' + opts.cls : '') + '"><span>' + label + (opts.tag ? ' <b class="sgtag">' + opts.tag + '</b>' : '') + '</span>' +
      '<input type="' + (opts.text ? 'text' : 'number') + '"' + (opts.text ? '' : ' inputmode="decimal" step="any" min="0"') + ' data-k="' + path + '" value="' + esc(get(path)) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>' +
      (unit ? '<em>' + unit + '</em>' : '') + '</label>';
  }
  function sel(label, path, options, opts) {
    opts = opts || {}; var v = String(get(path));
    return '<label class="fld' + (opts.cls ? ' ' + opts.cls : '') + '"><span>' + label + '</span><select data-k="' + path + '" data-rerender="1">' +
      options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function seg(path, options) {
    var v = String(get(path));
    return '<div class="seg sgseg" role="radiogroup">' + options.map(function (o) { return '<button type="button" data-seg="' + path + '" data-val="' + esc(o[0]) + '" class="' + (String(o[0]) === v ? 'on' : '') + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>';
  }
  function chk(label, path) { return '<label class="sgchk"><input type="checkbox" data-k="' + path + '" data-rerender="1"' + (get(path) ? ' checked' : '') + '> <span>' + label + '</span></label>'; }

  /* ---------- inputs ---------- */
  function whHtml() {
    var w = S().wh;
    return '<div class="card sgwh"><h2>Watt-hours</h2><div class="note">Wh = pack volts × amp-hours. Use nominal volts for the number on most event rules (check your event’s rules).</div>' +
      '<div class="fgrid sg3">' + fld('Pack volts', 'wh.v', 'V', { ph: 'e.g. 14.8' }) + fld('Capacity', 'wh.mah', 'mAh', { ph: 'e.g. 1300' }) +
      '<div class="sgwhout" id="sgWhOut"></div></div>' +
      '<div class="sgquick"><span>Fill volts from</span>' + '<input type="number" inputmode="decimal" min="1" step="1" data-k="wh.s" value="' + esc(w.s) + '" placeholder="S" aria-label="Cells in series">' +
      '<select data-k="wh.chem" aria-label="Chemistry">' + Object.keys(M.CHEM).map(function (k) { return '<option value="' + k + '"' + (w.chem === k ? ' selected' : '') + '>' + M.CHEM[k].label + ' (' + M.CHEM[k].nom + ' V nominal)</option>'; }).join('') + '</select>' +
      '<button type="button" class="btn ghost sm" data-act="whfill">Fill</button></div></div>';
  }
  function batteryHtml() {
    var s = S(), h = '<div class="card"><h2>Battery</h2>';
    h += '<div class="fgrid">' + sel('Chemistry', 'chem', Object.keys(M.CHEM).map(function (k) { return [k, M.CHEM[k].label + ' (' + M.CHEM[k].full + ' / ' + M.CHEM[k].nom + ' V)']; })) +
      fld('Cells in series (S)', 'S', '', { ph: 'e.g. 4' }) + fld('Full-charge V/cell', 'vFull', 'V') + fld('Nominal V/cell', 'vNom', 'V') + '</div>';
    h += '<div class="sectiontitle sgst">Capacity</div>' + seg('capMode', [['total', 'Total pack mAh'], ['cell', 'Per cell × P']]) +
      '<div class="fgrid">' + (s.capMode === 'cell' ? fld('Capacity per cell', 'mahCell', 'mAh', { ph: 'e.g. 650' }) : fld('Total pack capacity', 'mah', 'mAh', { ph: 'label, e.g. 1300' })) +
      fld('Cells in parallel (P)', 'P', '', { ph: '1' }) + '</div>' +
      '<div class="note">Total capacity is the number on the label. P only matters for turning per-cell numbers into pack numbers (leave 1 for a normal pack).</div>';
    h += '<div class="sectiontitle sgst">Internal resistance</div>' + seg('rMode', [['measured', 'Measured'], ['quality', 'Quality class'], ['crating', 'Label C']]);
    if (s.rMode === 'measured') {
      h += seg('measWhich', [['cell', 'Per cell (worst cell)'], ['pack', 'Whole pack']]) + '<div class="fgrid">' +
        (s.measWhich === 'pack' ? fld('Whole-pack resistance', 'rPack', 'mΩ') : fld('Resistance per cell', 'rCell', 'mΩ', { ph: 'worst cell' })) + '</div>' +
        '<div class="note">Best option. Use the worst cell from your charger’s IR reading (about 50% charge, room temperature), or ΔV ÷ ΔI from a logged load test (that also includes your wiring, so set harness to 0).</div>';
    } else if (s.rMode === 'quality') {
      h += '<div class="fgrid">' + sel('Pack quality', 'qClass', [['good', 'Good / excellent (k = 7)'], ['avg', 'Average (k = 10)'], ['poor', 'Poor (k = 15)'], ['custom', 'Custom k']]) +
        fld('k (per-cell mΩ × Ah)', 'k', 'mΩ·Ah', { tag: 'estimate' }) + '</div>' +
        '<div class="note">R<sub>cell</sub> = k ÷ Ah per cell. Bands from Rotorama’s bench tests of 6S FPV packs; small insect packs may differ. A measured value always wins.</div>';
    } else {
      h += '<div class="fgrid">' + fld('Label C-rating', 'cRating', 'C', { ph: 'e.g. 120' }) + fld('Realism factor', 'realism', '×', { tag: 'estimate' }) +
        fld('Sag at real peak', 'dvPeak', 'V/cell', { tag: 'estimate' }) + '</div>' +
        '<div class="note">Labels are inflated: real peak is typically 25–60% of the label (Rotorama). Real peak current = realism × C × Ah; R<sub>cell</sub> = sag at real peak ÷ that current. Least reliable option.</div>';
    }
    h += '</div>';
    return h;
  }
  function conditionsHtml() {
    var s = S();
    var h = '<div class="card"><h2>Conditions &amp; wiring</h2><div class="fgrid">' +
      fld('Resting V/cell late in match', 'restEnd', 'V', { tag: 'suggested' }) + fld('Temperature / age factor', 'tempFactor', '× R', { tag: 'estimate' }) + '</div>' +
      chk('Worst case on a fresh pack instead (full-charge volts)', 'worstFresh') +
      '<div class="note">Late-match resting voltage is a starting point; measure your pack right after a match. Temperature/age multiplies pack resistance (cold or old packs: try 1.2–1.5).</div>' +
      '<div class="sectiontitle sgst">Harness (wires, connectors, switch)</div>' + seg('hMode', [['direct', 'Enter mΩ'], ['build', 'Build it up']]);
    if (s.hMode === 'build') {
      h += '<div class="fgrid">' + sel('Main wire gauge', 'hAwg', Object.keys(M.AWG).map(function (g) { return [g, g + ' AWG (' + M.AWG[g] + ' mΩ/m)']; })) +
        fld('Wire length, + and − together', 'hLenCm', 'cm') + fld('Connectors in path', 'hConn', '') + fld('Per connector', 'hConnMohm', 'mΩ', { tag: 'assumed' }) +
        fld('Switch / link', 'hSwitch', 'mΩ', { tag: 'assumed' }) + '<div class="sgcalc" id="sgHarness"></div></div>' +
        '<div class="note">Copper at 20 °C. XT60 ≈ 0.55 mΩ, XT30 ≈ 0.7–1.2 mΩ (Amass datasheets). Switch and link resistance varies a lot; measure if you can.</div>';
    } else {
      h += '<div class="fgrid">' + fld('Harness resistance', 'hMohm', 'mΩ', { tag: 'assumed' }) + '</div><div class="note">8 mΩ ≈ 30 cm of 16 AWG + two XT30 contacts + a switch. Set 0 if your resistance number already includes the wiring.</div>';
    }
    return h + '</div>';
  }
  function loadsHtml() {
    var s = S();
    var h = '<div class="card"><h2>Loads</h2><div class="note">Battery-side amps (what the battery supplies: ESC telemetry or a wattmeter), not motor phase or datasheet stall amps. Quantity multiplies the row; the ESC limit caps each motor.</div>';
    s.loads.forEach(function (L, i) {
      var p = 'loads.' + i + '.';
      h += '<div class="sgload" data-type="' + esc(L.type) + '"><div class="sgload-h">' +
        '<select data-k="' + p + 'type" data-rerender="1" aria-label="Load type">' + [['weapon', 'Weapon'], ['drive', 'Drive'], ['other', 'Other']].map(function (o) { return '<option value="' + o[0] + '"' + (L.type === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
        '<input type="text" data-k="' + p + 'name" value="' + esc(L.name) + '" placeholder="Name (optional)" aria-label="Load name">' +
        '<button type="button" class="x" data-act="del" data-i="' + i + '" aria-label="Remove load">×</button></div><div class="fgrid sg3">' +
        fld('Quantity', p + 'qty', '');
      if (L.type === 'weapon') h += fld('Spin-up amps', p + 'spinA', 'A') + fld('Spin-up time', p + 'spinS', 's') + fld('Steady amps at speed', p + 'steadyA', 'A') + fld('Re-spins per match', p + 'respins', '') + fld('Duty (spinning)', p + 'duty', '%');
      else if (L.type === 'drive') h += fld('Cruise amps', p + 'cruiseA', 'A') + fld('Push / pin amps', p + 'pushA', 'A') + fld('Push length', p + 'pushS', 's') + fld('Pushes per match', p + 'pushes', '') + fld('Duty (driving)', p + 'duty', '%');
      else h += fld('Peak amps', p + 'peakA', 'A') + fld('Average amps', p + 'avgA', 'A');
      h += fld('ESC current limit', p + 'limitA', 'A', { ph: 'optional' }) + '</div></div>';
    });
    h += '<div class="sgbtns"><button type="button" class="btn ghost sm" data-act="add" data-type="weapon">+ Weapon</button><button type="button" class="btn ghost sm" data-act="add" data-type="drive">+ Drive</button><button type="button" class="btn ghost sm" data-act="add" data-type="other">+ Other</button></div></div>';
    return h;
  }
  function thresholdsHtml() {
    return '<div class="card"><h2>Thresholds &amp; model settings</h2><div class="note">Suggested starting points; set them to match your ESCs, receiver and pack.</div><div class="fgrid sg3">' +
      fld('PASS at or above', 'pass', 'V/cell', { tag: 'suggested' }) + fld('FAIL below (floor)', 'fail', 'V/cell', { tag: 'suggested' }) + fld('ESC low-voltage cutoff', 'lvc', 'V/cell', { tag: 'suggested' }) +
      fld('BEC / receiver minimum', 'becMin', 'V pack', { tag: 'suggested' }) + fld('Match length', 'matchS', 's') + fld('Usable capacity', 'usable', '%', { tag: 'suggested' }) +
      fld('Burst multiplier, short', 'shortMult', '× R', { tag: 'estimate' }) + fld('Burst multiplier, long', 'longMult', '× R', { tag: 'estimate' }) + fld('“Long” burst over', 'longS', 's') +
      fld('Continuous ÷ burst ratio', 'contRatio', '×', { tag: 'estimate' }) + '</div>' +
      '<div class="note">Set the ESC cutoff or BEC minimum to 0 to ignore it. Long bursts (pushing, pinning) sag more than short ones because cell resistance grows over a few seconds.</div></div>';
  }
  function profilesHtml() {
    var names = Object.keys(DB.profiles).sort();
    return '<div class="card sgprof"><h2>Saved setups</h2><div class="note">Saved on this device only.</div><div class="sgquick">' +
      '<input type="text" id="sgProfName" placeholder="Name this setup" aria-label="Setup name"><button type="button" class="btn sm" data-act="psave">Save</button></div>' +
      (names.length ? '<div class="sgplist">' + names.map(function (n) { return '<div class="sgprow"><span>' + esc(n) + '</span><button type="button" class="btn ghost sm" data-act="pload" data-n="' + esc(n) + '">Load</button><button type="button" class="x" data-act="pdel" data-n="' + esc(n) + '" aria-label="Delete ' + esc(n) + '">×</button></div>'; }).join('') + '</div>' : '') +
      '<div class="sgbtns"><button type="button" class="btn ghost sm" data-act="example">Fill generic example</button><button type="button" class="btn ghost sm" data-act="clear">Clear all</button></div></div>';
  }

  /* ---------- results ---------- */
  var LV = { pass: ['PASS', 'ok'], warn: ['WARN', 'warn'], fail: ['FAIL', 'bad'] };
  function vbadge(v) { var l = LV[v.level]; return '<span class="sgv ' + l[1] + '">' + l[0] + '</span>'; }
  function scenario(title, sub, v, r) {
    return '<div class="sgsc ' + LV[v.verdict.level][1] + '"><div class="sgsc-h"><div><div class="sgsc-t">' + title + '</div><div class="sgsc-s">' + sub + '</div></div>' + vbadge(v.verdict) + '</div>' +
      '<div class="sgkv"><span>Current</span><b>' + f(v.I, 0) + ' A</b><span>Loaded</span><b>' + f(v.vCell, 2) + ' V/cell · ' + f(v.vPack, 1) + ' V</b>' +
      '<span>Sag</span><b>' + f(v.sag, 2) + ' V <small>(pack ' + f(v.packSag, 2) + ' + harness ' + f(v.harnessDrop, 2) + ')</small></b>' +
      '<span>From rest</span><b>' + f(v.rest, 2) + ' V/cell <small>· R × ' + f(v.mult, 2) + ' = ' + f(v.rTotal * 1000, 1) + ' mΩ total</small></b>' +
      '<span>Margins</span><b>' + (isFinite(v.marginLvc) ? 'ESC cutoff ' + (v.marginLvc >= 0 ? '+' : '') + f(v.marginLvc, 2) + ' V/cell · ' : '') + 'floor ' + (v.marginFloor >= 0 ? '+' : '') + f(v.marginFloor, 2) + ' V/cell' + (isFinite(v.marginBec) ? ' · BEC ' + (v.marginBec >= 0 ? '+' : '') + f(v.marginBec, 1) + ' V' : '') + '</b>' +
      '<span>Heat</span><b>' + f(v.heatPack, 0) + ' W in pack · ' + f(v.heatHarness, 0) + ' W in harness</b></div>' +
      '<div class="sgwhy">' + esc(v.verdict.why.join('; ')) + '</div></div>';
  }
  function resultsHtml() {
    var s = S(), r = M.compute(s);
    var h = '<div class="card sgres"><h2>Results <span class="esttag">estimate</span></h2>';
    if (!r.valid) return h + '<div class="note">Enter ' + esc(r.errors.join(', ')) + ' to see results.</div></div>';
    h += '<div class="grid2 rgrid sgpack">' +
      '<div class="stat"><div class="v">' + f(r.rPack * 1000, 1) + ' mΩ</div><div class="k">Pack resistance</div><div class="s">' + f(r.S, 0) + 'S' + f(r.P, 0) + 'P · ' + f(r.rCell * 1000, 2) + ' mΩ/cell' + (r.temp !== 1 ? ' · ×' + f(r.temp, 2) + ' temp/age' : '') + '</div></div>' +
      '<div class="stat"><div class="v">' + f(r.harnessMohm, 1) + ' mΩ</div><div class="k">Harness</div><div class="s">' + (s.hMode === 'build' ? 'built up' : 'entered') + ' (assumed unless measured)</div></div>' +
      '<div class="stat"><div class="v">' + f(r.wh, 1) + ' Wh</div><div class="k">Pack energy</div><div class="s">' + f(r.vPackNom, 1) + ' V nominal × ' + f(r.ahPack, 3) + ' Ah</div></div>' +
      '<div class="stat"><div class="v">' + f(r.vPackFull, 1) + ' V</div><div class="k">Full charge</div><div class="s">late-match rest ' + f(r.restEnd * r.S, 1) + ' V</div></div></div>';
    if (isFinite(r.labelMaxA)) h += '<div class="note">Label max (C × Ah): ' + f(r.labelMaxA, 0) + ' A. Not used for the math; real packs rarely reach it.</div>';
    if (!r.loadsCount || !(r.worst.I > 0 || r.average.I > 0)) h += '<div class="verdict">Add load currents to check sag.</div>';
    else {
      h += scenario('Worst case', 'every burst at once (weapon re-spin + drive push), ' + (r.worst.late ? 'late in the match' : 'fresh pack') + ', with harness' + (r.worst.dur ? ', ' + f(r.worst.dur, 1) + ' s' : ''), r.worst, r);
      h += scenario('Opening spin-up', 'weapons spin up while drives cruise, fresh pack', r.opening, r);
      var a = r.average;
      h += '<div class="sgsc ' + LV[a.verdict.level][1] + '"><div class="sgsc-h"><div><div class="sgsc-t">Match average</div><div class="sgsc-s">duty-weighted over ' + f(a.match, 0) + ' s (heat and capacity)</div></div>' + vbadge(a.verdict) + '</div>' +
        '<div class="sgkv"><span>Average current</span><b>' + f(a.I, 1) + ' A · ' + f(a.avgC, 1) + 'C</b><span>Continuous estimate</span><b>' + f(a.contA, 0) + ' A · ' + f(a.contC, 0) + 'C <small>(estimate)</small></b>' +
        '<span>Used per match</span><b>' + f(a.mAh, 0) + ' mAh · ' + f(a.capPct, 0) + '% of pack</b><span>Runtime</span><b>' + (isFinite(a.runtimeMin) ? f(a.runtimeMin, 1) + ' min to ' + f(s.usable, 0) + '% used' : '—') + '</b>' +
        '<span>Pack heat</span><b>' + f(a.heatPack, 1) + ' W at average current <small>(peaks add more)</small></b></div><div class="sgwhy">' + esc(a.verdict.why.join('; ')) + '</div></div>';
    }
    h += '<div class="sgmax"><div class="sgmax-h"><span>Max amps to stay above</span>' +
      '<select data-k="maxFloor" data-rerender="1" aria-label="Floor">' + [['fail', 'FAIL floor (' + s.fail + ' V/cell)'], ['pass', 'PASS line (' + s.pass + ' V/cell)'], ['lvc', 'ESC cutoff (' + s.lvc + ' V/cell)'], ['custom', 'Custom']].map(function (o) { return '<option value="' + o[0] + '"' + (s.maxFloor === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' +
      (s.maxFloor === 'custom' ? '<input type="number" inputmode="decimal" step="any" data-k="customFloor" value="' + esc(s.customFloor) + '" aria-label="Custom floor V per cell" class="sgcf">' : '') + '</div>' +
      '<table class="sgtbl"><tr><th></th><th>Short burst</th><th>Long burst</th></tr>' +
      '<tr><td>Late in match (' + f(r.restEnd, 2) + ' V/cell)</td><td>' + f(r.maxA.lateShort, 0) + ' A</td><td>' + f(r.maxA.lateLong, 0) + ' A</td></tr>' +
      '<tr><td>Fresh (' + f(r.vFull, 2) + ' V/cell)</td><td>' + f(r.maxA.freshShort, 0) + ' A</td><td>' + f(r.maxA.freshLong, 0) + ' A</td></tr></table>' +
      '<div class="note">Total battery current, including harness. (rest − floor) × S ÷ R<sub>total</sub>.</div></div>';
    return h + '</div>';
  }
  function howHtml() {
    return '<details class="card sghow"><summary>How this works</summary>' +
      '<div class="formula">R<sub>cell</sub>: measured · or k ÷ Ah<sub>cell</sub> · or ΔV<sub>peak</sub> ÷ (realism × C × Ah<sub>cell</sub>)<br>R<sub>pack</sub> = (S ÷ P) × R<sub>cell</sub> × temp/age<br>R<sub>total</sub> = R<sub>pack</sub> × burst multiplier + R<sub>harness</sub><br>V<sub>loaded</sub> = S × V<sub>rest</sub> − I × R<sub>total</sub><br>I<sub>max</sub> = (V<sub>rest</sub> − V<sub>floor</sub>) × S ÷ R<sub>total</sub><br>Heat = I² × R · Wh = S × V<sub>nominal</sub> × Ah<sub>pack</sub><br>Continuous ≈ ratio × 0.5 V × S ÷ R<sub>pack</sub></div>' +
      '<div class="note sglist"><b>Continuous vs burst.</b> Sag is instant, so “does it sag” uses the biggest current that happens at the same time (bursts). Average current decides heat and capacity. Weapons: spin-up and every re-spin after a hit are the bursts. Drives: cruising is continuous, pushing or pinning is a long burst. The worst case is a weapon re-spin while pushing, late in the match.<br><br>' +
      '<b>Scenarios.</b> Worst case = every load’s burst at once (weapon spin-up, drive push, other peaks) from the late-match resting voltage, with the long-burst multiplier if any burst is longer than the “long” setting. Opening = weapon spin-up + drive cruise from full charge. Average = steady × duty + bursts × (count × length ÷ match length), at the mid-match voltage.<br><br>' +
      '<b>Verdicts.</b> PASS at or above the PASS line; WARN between the floor and the PASS line; FAIL below the floor, the ESC cutoff or the BEC/receiver minimum. Average: FAIL above the continuous estimate or over 85% of capacity; WARN within 20% of it or over 70%.<br><br>' +
      '<b>Caveats.</b> Simple resistive model. A measured resistance always beats an estimate. The quality bands (k = 7 / 10 / 15 mΩ·Ah) and the continuous ratio come from Rotorama’s 6S FPV pack tests and may not match small insect packs. Label C-ratings are inflated (real peak ≈ 25–60% of label). Resistance rises when cold, near empty and with age, and grows over the first seconds of a burst; very short spikes sag a bit less. Brushless battery current is lower than motor phase current at low speed, so use battery-side amps. Brushed stall current drops as the pack sags, so the worst case is conservative there.</div>' +
      '<div class="note sglist"><b>Sources</b>: ' +
      '<a href="https://batt.rotorama.cz/en/p/methodology" target="_blank" rel="noopener">Rotorama Battery Benchmark: methodology</a> (peak vs burst vs continuous, specific resistance bands) · ' +
      '<a href="https://wiki.combatrobots.org/power/lipo-batteries/" target="_blank" rel="noopener">Combat Robots Wiki: LiPo batteries</a> · ' +
      '<a href="https://wiki.combatrobots.org/weapons/motors-escs/" target="_blank" rel="noopener">Combat Robots Wiki: weapon motors &amp; ESCs</a> · ' +
      '<a href="https://www.runamok.tech/AskAaron/LiPo_FAQ.html" target="_blank" rel="noopener">Run Amok LiPo FAQ</a> · ' +
      '<a href="http://www.batteryuniversity.com/article/bu-802a-how-does-rising-internal-resistance-affect-performance/" target="_blank" rel="noopener">Battery University BU-802a</a> · ' +
      '<a href="https://github.com/am32-firmware/AM32" target="_blank" rel="noopener">AM32 ESC firmware</a> (low-voltage cutoff) · ' +
      '<a href="https://www.devicecraft.com/ApplicationNotes/WireResistanceTable.pdf" target="_blank" rel="noopener">wire resistance table</a> · ' +
      '<a href="https://www.tme.eu/Document/2d152ced3b7a446066e6c419d84bb460/XT60%20SPEC.pdf" target="_blank" rel="noopener">Amass XT60 spec</a>.</div></details>';
  }
  function render(el) {
    root = el || root; if (!root) return;
    var y = window.scrollY;
    root.innerHTML = '<div class="calcbar"><button class="back" data-back>‹ Calculators</button><a class="btn ghost sm sgjump" href="#sgResults" data-act="jump">Results ↓</a></div>' +
      '<div class="calctitle">Battery Sag &amp; Wh</div><div class="calccredit">Built into this app · general purpose, works for any robot and pack · saved on this device</div>' +
      whHtml() + '<div class="sag"><div class="sag-in">' + batteryHtml() + conditionsHtml() + loadsHtml() + thresholdsHtml() + profilesHtml() + '</div>' +
      '<div class="sag-out" id="sgResults"><div id="sgRes">' + resultsHtml() + '</div>' + howHtml() + '</div></div>';
    updateSmall();
    window.scrollTo(0, y);
  }
  function updateSmall() {
    var w = S().wh, v = parseFloat(w.v), mah = parseFloat(w.mah), o = document.getElementById('sgWhOut');
    if (o) o.innerHTML = '<div class="sgwhv">' + (isFinite(v) && isFinite(mah) && v > 0 && mah > 0 ? f(v * mah / 1000, 2) : '—') + '<small> Wh</small></div><div class="sgwhk">' + (isFinite(v) && isFinite(mah) && v > 0 && mah > 0 ? f(v, 2) + ' V × ' + f(mah / 1000, 3) + ' Ah' : 'enter volts and mAh') + '</div>';
    var hz = document.getElementById('sgHarness'); if (hz) hz.innerHTML = '<span>Harness total</span><b>' + f(M.harnessMohm(S()), 2) + ' mΩ</b>';
  }
  function refreshResults() { var e = document.getElementById('sgRes'); if (e) e.innerHTML = resultsHtml(); updateSmall(); }
  function applyChem(k) { var c = M.CHEM[k]; if (!c) return; var s = S(); s.vFull = c.full; s.vNom = c.nom; s.restEnd = c.rest; s.lvc = c.lvc; s.pass = c.pass; s.fail = c.fail; }
  function onInput(e) {
    var t = e.target; if (!t.dataset || !t.dataset.k) return;
    var k = t.dataset.k, v = t.type === 'checkbox' ? t.checked : t.value;
    set(k, v);
    if (k === 'qClass' && M.QUALITY[v]) set('k', M.QUALITY[v]);
    if (k === 'k') set('qClass', ({ 7: 'good', 10: 'avg', 15: 'poor' })[parseFloat(v)] || 'custom');
    if (k === 'chem') applyChem(v);
    save();
    if (t.dataset.rerender && e.type === 'change') render(); else refreshResults();
  }
  function onClick(e) {
    var b = e.target.closest('button,a'); if (!b || !root || !root.contains(b)) return;
    var s = S(), act = b.dataset.act;
    if (b.dataset.seg) { set(b.dataset.seg, b.dataset.val); save(); render(); return; }
    if (!act) return;
    if (act === 'jump') { e.preventDefault(); var r = document.getElementById('sgResults'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (act === 'add') { s.loads.push(M.newLoad(b.dataset.type)); }
    else if (act === 'del') { s.loads.splice(+b.dataset.i, 1); }
    else if (act === 'whfill') { var c = M.CHEM[s.wh.chem] || M.CHEM.lipo, n = parseFloat(s.wh.s); if (n > 0) s.wh.v = +(n * c.nom).toFixed(2); }
    else if (act === 'psave') { var nm = (document.getElementById('sgProfName') || {}).value; nm = (nm || '').trim(); if (!nm) return; var copy = JSON.parse(JSON.stringify(s)); DB.profiles[nm] = copy; }
    else if (act === 'pload') { var p = DB.profiles[b.dataset.n]; if (p) DB.cur = JSON.parse(JSON.stringify(p)); }
    else if (act === 'pdel') { delete DB.profiles[b.dataset.n]; }
    else if (act === 'clear') { if (!confirm('Clear all inputs? Saved setups are kept.')) return; DB.cur = M.defaults(); }
    else if (act === 'example') {
      var d = M.defaults(); d.S = 4; d.mah = 1300; d.rMode = 'quality'; d.qClass = 'good'; d.k = 7; d.wh = { v: 14.8, mah: 1300, s: 4, chem: 'lipo' };
      var w = M.newLoad('weapon'); w.name = 'Example weapon'; w.spinA = 40; w.spinS = 2; w.steadyA = 6; w.respins = 10; w.duty = 80;
      var dr = M.newLoad('drive'); dr.name = 'Example drive'; dr.qty = 2; dr.cruiseA = 3; dr.pushA = 10; dr.pushS = 4; dr.pushes = 5; dr.duty = 70;
      d.loads = [w, dr]; d.isExample = true; DB.cur = d;
    } else return;
    save(); render();
  }
  window.SagCalc = {
    render: function (el) { if (root !== el) { if (el) { el.addEventListener('input', onInput); el.addEventListener('change', onInput); el.addEventListener('click', onClick); } } render(el); },
    state: function () { return DB.cur; }
  };
})();
