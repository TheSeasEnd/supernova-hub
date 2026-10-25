/* Calculators tab: a list of calculators (credited to their owners) + our own native
   Battery Sag / Max Amps estimator. External tools are embedded (iframe) only where the owner's
   site allows framing; others open in the browser. No third-party calculator code is copied here. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  var EMBER = 'https://ember.level5robotics.com';
  var EMBER_CREDIT = 'Ember by <a href="https://level5robotics.com" target="_blank" rel="noopener">Level 5 Robotics</a> (with the SCAR community)';

  var CALCS = [
    { id: 'battery', kind: 'native', group: 'Built in', title: 'Battery Sag / Max Amps',
      desc: 'Pack resistance, max amps before your sag limit, loaded voltage vs. component draw, watt-hours.',
      credit: 'Built into this app · our own estimate math' },
    { id: 'robocalc', kind: 'embed', group: 'Embedded calculators', title: 'ROBO CALC',
      desc: 'Combat Robotics Calculator Tool: weapon, drive and more.',
      url: 'https://bdboxell.github.io/robocalc/',
      credit: 'Calculator by <a href="https://github.com/bdboxell/robocalc" target="_blank" rel="noopener">Brian Boxell / Too Hot Robotics</a>',
      note: 'CSV import/export may not work inside the embedded view on phones. Use “Open in browser” for that.' },
    { id: 'ember-wh', kind: 'embed', group: 'Embedded calculators', title: 'Ember · Watt-Hour Calculator',
      desc: 'Battery energy in watt-hours (handy for event battery limits).', url: EMBER + '/watt-hour', credit: EMBER_CREDIT },
    { id: 'ember-battery', kind: 'embed', group: 'Embedded calculators', title: 'Ember · Battery Size Calculator',
      desc: 'Size a pack for your robot’s loads.', url: EMBER + '/battery-size', credit: EMBER_CREDIT },
    { id: 'ember-cd', kind: 'embed', group: 'Embedded calculators', title: 'Ember · Center Distance',
      desc: 'Gears, chain and timing belt center distance.', url: EMBER + '/center-distance', credit: EMBER_CREDIT },
    { id: 'ember-vbelt', kind: 'embed', group: 'Embedded calculators', title: 'Ember · Center Distance (V-belt mode)',
      desc: 'Center distance with the V-belt mode preselected.', url: EMBER + '/center-distance?type=vbelt', credit: EMBER_CREDIT },
    { id: 'ember-home', kind: 'embed', group: 'Embedded calculators', title: 'Ember · all calculators',
      desc: 'Drivetrain, weapon, motor torque, scale factors, tach, tournament and more.', url: EMBER + '/', credit: EMBER_CREDIT },
    { id: 'fingertech', kind: 'link', group: 'Open in browser (site blocks embedding)', title: 'FingerTech Pulley & Belt Calculator',
      desc: 'Pulley and belt how-to and calculator.', url: 'https://www.fingertechrobotics.com/how-to_pulley_belt.php',
      credit: 'By <a href="https://www.fingertechrobotics.com" target="_blank" rel="noopener">FingerTech Robotics</a>' },
    { id: 'sdpsi', kind: 'link', group: 'Open in browser (site blocks embedding)', title: 'SDP/SI Center Distance Designer',
      desc: 'Belt/pulley center distance designer.', url: 'https://sdp-si.com/tools/center-distance-designer.php',
      credit: 'By <a href="https://sdp-si.com" target="_blank" rel="noopener">SDP/SI (Stock Drive Products / Sterling Instrument)</a>' },
    { id: 'gates', kind: 'link', group: 'Open in browser (site blocks embedding)', title: 'Gates Belt Tension Calculator',
      desc: 'Recommended belt installation tension.', url: 'https://calculators.gates.com/BeltTension',
      credit: 'By <a href="https://www.gates.com" target="_blank" rel="noopener">Gates Corporation</a>' }
  ];
  function byId(id) { for (var i = 0; i < CALCS.length; i++) if (CALCS[i].id === id) return CALCS[i]; return null; }

  var root, current = 'list';

  function renderList() {
    var h = '<div class="sectiontitle" style="margin:2px 2px 10px">Calculators</div>', group = null;
    CALCS.forEach(function (c) {
      if (c.group !== group) { group = c.group; h += '<div class="calcgroup">' + esc(group) + '</div>'; }
      var action = c.kind === 'link'
        ? '<a class="btn ghost sm" href="' + esc(c.url) + '" target="_blank" rel="noopener">Open ↗</a>'
        : '<button class="btn sm" data-open="' + c.id + '">' + (c.kind === 'native' ? 'Open' : 'Open here') + '</button>';
      h += '<div class="card calcitem' + (c.kind === 'native' ? ' native' : '') + '"><div class="ci-main"><div class="ci-title">' + esc(c.title) + '</div>' +
        '<div class="ci-desc">' + esc(c.desc) + '</div><div class="ci-credit">' + c.credit + '</div></div><div class="ci-act">' + action +
        (c.kind === 'embed' ? '<a class="ci-ext" href="' + esc(c.url) + '" target="_blank" rel="noopener">Open in browser ↗</a>' : '') + '</div></div>';
    });
    h += '<div class="note" style="padding:0 4px">External calculators belong to their owners and load live from their sites. Nothing is copied into this app. Embedded ones load in a frame; the sites in the last group don’t allow embedding, so they open in your browser.</div>';
    root.innerHTML = h;
  }

  function renderEmbed(c) {
    root.innerHTML = '<div class="calcbar"><button class="back" data-back>‹ Calculators</button>' +
      '<a class="btn sm" href="' + esc(c.url) + '" target="_blank" rel="noopener">Open in browser ↗</a></div>' +
      '<div class="calctitle">' + esc(c.title) + '</div><div class="calccredit">' + c.credit + '</div>' +
      (c.note ? '<div class="calcnote">' + esc(c.note) + '</div>' : '') +
      '<div class="framewrap"><iframe title="' + esc(c.title) + '" src="' + esc(c.url) + '" referrerpolicy="no-referrer-when-downgrade"></iframe></div>';
  }

  /* ---------- Battery Sag / Max Amps (original math) ---------- */
  var ASSUMED_SAG_AT_RATED_C = 0.4; // volts per cell assumed at the rated C current (for the C-rating estimate)

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { return isFinite(n) ? n.toFixed(d == null ? 1 : d) : '—'; }

  function compute(p) {
    var b = p.battery, r = {};
    r.S = num(b.cellsSeries); r.P = num(b.cellsParallel); r.mAh = num(b.capacityMah);
    r.vFull = num(b.cellFullV); r.vNom = num(b.cellNominalV); r.sagPct = num(b.allowedSagPct);
    r.ahCell = r.mAh / 1000; r.ahPack = r.ahCell * r.P;
    if (b.resistanceMode === 'c') {
      r.rCellMohm = ASSUMED_SAG_AT_RATED_C / (num(b.cRating) * r.ahCell) * 1000; r.rEstimated = true;
    } else { r.rCellMohm = num(b.cellResistanceMohm); r.rEstimated = false; }
    r.rPack = (r.S / r.P) * r.rCellMohm / 1000;           // ohms
    r.vPackFull = r.S * r.vFull; r.vPackNom = r.S * r.vNom;
    r.sagAllowedV = r.vPackFull * r.sagPct / 100;
    r.iMax = r.sagAllowedV / r.rPack;
    r.wh = r.vPackNom * r.ahPack;
    r.cMaxA = b.resistanceMode === 'c' ? num(b.cRating) * r.ahPack : NaN;
    r.peak = 0; r.typ = 0;
    (p.components || []).forEach(function (c) { var q = num(c.qty); q = isFinite(q) ? q : 1; r.peak += q * (num(c.peakA) || 0); r.typ += q * (num(c.typicalA) || 0); });
    r.vLoadedPeak = r.vPackFull - r.peak * r.rPack; r.sagPeakPct = (r.peak * r.rPack) / r.vPackFull * 100;
    r.vLoadedTyp = r.vPackFull - r.typ * r.rPack; r.sagTypPct = (r.typ * r.rPack) / r.vPackFull * 100;
    r.perCellPeak = r.vLoadedPeak / r.S;
    r.runtimeMin = r.typ > 0 ? r.ahPack / r.typ * 60 : NaN;
    r.valid = [r.S, r.P, r.mAh, r.vFull, r.rCellMohm, r.sagPct].every(function (x) { return isFinite(x) && x > 0; });
    return r;
  }

  function field(label, path, val, opts) {
    opts = opts || {};
    return '<label class="fld"><span>' + label + '</span><input inputmode="decimal" type="number" step="any" min="0" data-path="' + path + '" value="' + esc(val) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>' + (opts.unit ? '<em>' + opts.unit + '</em>' : '') + '</label>';
  }

  function renderBattery() {
    var p = window.RobotProfile.get(), b = p.battery;
    var h = '<div class="calcbar"><button class="back" data-back>‹ Calculators</button><button class="btn ghost sm" data-reset>Reset</button></div>' +
      '<div class="calctitle">Battery Sag / Max Amps</div><div class="calccredit">Built into this app · our own estimate math · saved on this phone in the robot profile “' + esc(p.name) + '”</div>';
    h += '<div id="exBanner" class="exbanner"' + (p.isExample ? '' : ' hidden') + '>Example values loaded (6S is from Supernova’s wiki page; everything else is a generic example). Replace them with your own specs.</div>';
    h += '<div class="card"><h2>Battery pack</h2><div class="fgrid">' +
      field('Cells in series (S)', 'battery.cellsSeries', b.cellsSeries) +
      field('Cells in parallel (P)', 'battery.cellsParallel', b.cellsParallel) +
      field('Capacity per cell', 'battery.capacityMah', b.capacityMah, { unit: 'mAh' }) +
      field('Full-charge cell V', 'battery.cellFullV', b.cellFullV, { unit: 'V' }) +
      field('Nominal cell V', 'battery.cellNominalV', b.cellNominalV, { unit: 'V' }) +
      field('Allowed sag', 'battery.allowedSagPct', b.allowedSagPct, { unit: '%' }) + '</div>' +
      '<div class="seg" role="radiogroup"><button data-rmode="ir" class="' + (b.resistanceMode !== 'c' ? 'on' : '') + '">I know cell IR (mΩ)</button><button data-rmode="c" class="' + (b.resistanceMode === 'c' ? 'on' : '') + '">Only C-rating</button></div>' +
      '<div class="fgrid" id="rFields">' + (b.resistanceMode === 'c'
        ? field('C-rating', 'battery.cRating', b.cRating, { unit: 'C' }) + '<div class="note est">Estimated: R<sub>cell</sub> ≈ ' + ASSUMED_SAG_AT_RATED_C + ' V ÷ (C × Ah<sub>cell</sub>). Assumes a cell sags about ' + ASSUMED_SAG_AT_RATED_C + ' V at its rated current. C-ratings are often optimistic, so real sag is usually worse. Measure IR if you can.</div>'
        : field('Internal resistance per cell', 'battery.cellResistanceMohm', b.cellResistanceMohm, { unit: 'mΩ' })) + '</div></div>';
    h += '<div class="card"><h2>Component current draw</h2><div id="comps"></div><button class="btn ghost sm" data-add>+ Add component</button></div>';
    h += '<div id="bResults"></div>';
    h += '<div class="card"><h2>Formulas</h2><div class="formula">R<sub>pack</sub> = (S ÷ P) × R<sub>cell</sub><br>V<sub>pack</sub> = S × V<sub>cell,full</sub><br>I<sub>max</sub> = (sag% × V<sub>pack</sub>) ÷ R<sub>pack</sub><br>V<sub>loaded</sub> = V<sub>pack</sub> − I<sub>total peak</sub> × R<sub>pack</sub><br>Wh = S × V<sub>cell,nominal</sub> × P × Ah<sub>cell</sub></div>' +
      '<div class="note">Simple resistive model (Ohm’s law). It ignores wiring, connector and ESC resistance, temperature, state of charge and voltage recovery, and assumes every peak draw happens at once (worst case). Treat the results as an estimate.</div></div>';
    root.innerHTML = h;
    renderComps(); renderResults();
  }

  function renderComps() {
    var p = window.RobotProfile.get(), el = document.getElementById('comps'); if (!el) return;
    el.innerHTML = '<div class="crow chead"><span>Component</span><span>Qty</span><span>Peak / stall A</span><span>Typical A</span><span></span></div>' +
      (p.components || []).map(function (c, i) {
        return '<div class="crow"><input type="text" data-ci="' + i + '" data-ck="name" value="' + esc(c.name) + '" placeholder="e.g. Drive motor">' +
          '<input type="number" inputmode="decimal" step="any" min="0" data-ci="' + i + '" data-ck="qty" value="' + esc(c.qty) + '">' +
          '<input type="number" inputmode="decimal" step="any" min="0" data-ci="' + i + '" data-ck="peakA" value="' + esc(c.peakA) + '" placeholder="stall/peak">' +
          '<input type="number" inputmode="decimal" step="any" min="0" data-ci="' + i + '" data-ck="typicalA" value="' + esc(c.typicalA) + '" placeholder="typical">' +
          '<button class="x" data-del="' + i + '" aria-label="Remove">×</button></div>';
      }).join('');
  }

  function renderResults() {
    var el = document.getElementById('bResults'); if (!el) return;
    var r = compute(window.RobotProfile.get());
    if (!r.valid) { el.innerHTML = '<div class="card"><div class="note">Fill in S, P, capacity, full-charge voltage, resistance (or C-rating) and allowed sag to see results.</div></div>'; return; }
    var ok = r.peak <= r.iMax, low = r.perCellPeak < 3.0;
    var verdict = r.peak <= 0 ? '<div class="verdict">Add component peak currents to compare against the pack.</div>'
      : ok ? '<div class="verdict ok">✓ OK: total peak ' + fmt(r.peak, 0) + ' A is within the ' + fmt(r.iMax, 0) + ' A limit. Expected loaded voltage ' + fmt(r.vLoadedPeak) + ' V (' + fmt(r.sagPeakPct) + '% sag).</div>'
      : '<div class="verdict bad">⚠ Will sag: total peak ' + fmt(r.peak, 0) + ' A is over the ' + fmt(r.iMax, 0) + ' A limit for ' + fmt(r.sagPct, 0) + '% sag. Expected loaded voltage ' + fmt(r.vLoadedPeak) + ' V (' + fmt(r.sagPeakPct) + '% sag, ' + fmt(r.perCellPeak, 2) + ' V/cell)' + (r.vLoadedPeak <= 0 ? ' (the model breaks down here; the pack can’t supply this).' : '.') + (low && r.vLoadedPeak > 0 ? ' That’s under 3.0 V/cell, where ESCs may brown out or cut off.' : '') + '</div>';
    el.innerHTML = '<div class="card"><h2>Results <span class="esttag">estimate</span></h2>' + verdict +
      '<div class="grid2 rgrid">' +
      '<div class="stat"><div class="v">' + fmt(r.iMax, 0) + ' A</div><div class="k">Max amps @ ' + fmt(r.sagPct, 0) + '% sag</div><div class="s">' + fmt(r.sagAllowedV, 2) + ' V ÷ ' + fmt(r.rPack * 1000, 1) + ' mΩ</div></div>' +
      '<div class="stat"><div class="v">' + fmt(r.rPack * 1000, 1) + ' mΩ</div><div class="k">Pack resistance' + (r.rEstimated ? ' (est.)' : '') + '</div><div class="s">(' + fmt(r.S, 0) + '/' + fmt(r.P, 0) + ') × ' + fmt(r.rCellMohm, 2) + ' mΩ</div></div>' +
      '<div class="stat"><div class="v">' + fmt(r.peak, 0) + ' A</div><div class="k">Total peak draw</div><div class="s">loaded ' + fmt(r.vLoadedPeak) + ' V</div></div>' +
      '<div class="stat"><div class="v">' + fmt(r.typ, 0) + ' A</div><div class="k">Total typical draw</div><div class="s">loaded ' + fmt(r.vLoadedTyp) + ' V (' + fmt(r.sagTypPct) + '%)</div></div>' +
      '<div class="stat"><div class="v">' + fmt(r.wh, 1) + ' Wh</div><div class="k">Pack energy</div><div class="s">' + fmt(r.vPackNom) + ' V × ' + fmt(r.ahPack, 2) + ' Ah</div></div>' +
      '<div class="stat"><div class="v">' + fmt(r.vPackFull) + ' V</div><div class="k">Full-charge pack V</div><div class="s">' + (isFinite(r.runtimeMin) ? '~' + fmt(r.runtimeMin, 1) + ' min at typical draw' : '') + '</div></div>' +
      '</div>' + (isFinite(r.cMaxA) ? '<div class="note">C-rating × capacity = ' + fmt(r.cMaxA, 0) + ' A rated max' + (r.peak > r.cMaxA ? ', and your peak draw is above even that.' : '.') + '</div>' : '') + '</div>';
  }

  function onInput(e) {
    var t = e.target, P = window.RobotProfile;
    if (t.dataset.path) {
      var parts = t.dataset.path.split('.');
      P.save(function (p) { p.isExample = false; p[parts[0]][parts[1]] = t.value === '' ? '' : num(t.value); });
    } else if (t.dataset.ci != null) {
      var i = +t.dataset.ci, k = t.dataset.ck;
      P.save(function (p) { p.isExample = false; p.components[i][k] = k === 'name' ? t.value : (t.value === '' ? '' : num(t.value)); });
    } else return;
    var bn = document.getElementById('exBanner'); if (bn) bn.hidden = true;
    renderResults();
  }

  function onClick(e) {
    var t = e.target.closest('button'); if (!t || !root.contains(t)) return;
    var P = window.RobotProfile;
    if (t.dataset.open) window.App.navigate('#calc/' + t.dataset.open, true);
    else if (t.hasAttribute('data-back')) window.App.back('#calc');
    else if (t.dataset.rmode) { P.save(function (p) { p.battery.resistanceMode = t.dataset.rmode; }); renderBattery(); }
    else if (t.hasAttribute('data-add')) { P.save(function (p) { p.isExample = false; p.components.push({ id: 'c' + Date.now(), name: '', qty: 1, peakA: '', typicalA: '' }); }); renderComps(); renderResults(); var bn = document.getElementById('exBanner'); if (bn) bn.hidden = true; }
    else if (t.dataset.del != null) { P.save(function (p) { p.isExample = false; p.components.splice(+t.dataset.del, 1); }); renderComps(); renderResults(); }
    else if (t.hasAttribute('data-reset')) { if (confirm('Reset the battery calculator to the example values?')) { P.reset(); renderBattery(); } }
  }

  function open(id, fromHash) {
    var c = byId(id); current = c && c.kind !== 'link' ? id : 'list';
    if (current === 'list') renderList(); else if (c.kind === 'native') renderBattery(); else renderEmbed(c);
    root.classList.toggle('embedmode', !!(c && c.kind === 'embed'));

  }

  window.Calcs = {
    init: function (el) { root = el; root.addEventListener('input', onInput); root.addEventListener('click', onClick); renderList(); },
    open: open,
    compute: compute,
    list: CALCS
  };
})();
