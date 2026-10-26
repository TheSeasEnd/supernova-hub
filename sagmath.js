/* Battery sag math (general purpose, no robot-specific values). Pure functions, no DOM.
   Used by sagcalc.js in the app and by tools/test_sagmath.js (node). Model: resistive,
   V_loaded = S × V_rest − I × (R_pack × temp × burst + R_harness). See "How this works" in the app. */
(function (root) {
  'use strict';
  var CHEM = {
    lipo:    { label: 'LiPo',    full: 4.20, nom: 3.70, rest: 3.75, lvc: 3.3, pass: 3.5, fail: 3.3 },
    lihv:    { label: 'LiHV',    full: 4.35, nom: 3.80, rest: 3.85, lvc: 3.3, pass: 3.5, fail: 3.3 },
    liion:   { label: 'Li-ion',  full: 4.20, nom: 3.60, rest: 3.60, lvc: 3.0, pass: 3.2, fail: 2.8 },
    lifepo4: { label: 'LiFePO4', full: 3.60, nom: 3.20, rest: 3.25, lvc: 2.8, pass: 3.0, fail: 2.8 }
  };
  var QUALITY = { good: 7, avg: 10, poor: 15 };              // mΩ·Ah per cell (Rotorama bands, 6S FPV packs)
  var AWG = { 10: 3.28, 12: 5.21, 14: 8.28, 16: 13.2, 18: 21.0, 20: 33.2, 22: 52.9 }; // mΩ per metre, copper, 20 °C

  function n(v) { if (v === '' || v == null) return NaN; var x = typeof v === 'number' ? v : parseFloat(v); return isFinite(x) ? x : NaN; }
  function z(v) { var x = n(v); return isFinite(x) ? x : 0; }
  function pos(v) { var x = n(v); return isFinite(x) && x > 0; }

  function defaults() {
    var c = CHEM.lipo;
    return {
      version: 1,
      wh: { v: '', mah: '', s: '', chem: 'lipo' },
      chem: 'lipo', vFull: c.full, vNom: c.nom, S: '', P: 1, capMode: 'total', mah: '', mahCell: '',
      rMode: 'quality', measWhich: 'cell', rCell: '', rPack: '', qClass: 'avg', k: QUALITY.avg,
      cRating: '', realism: 0.5, dvPeak: 0.5,
      restEnd: c.rest, worstFresh: false, tempFactor: 1.0,
      hMode: 'direct', hMohm: 8, hAwg: 16, hLenCm: 30, hConn: 2, hConnMohm: 1.0, hSwitch: 2,
      shortMult: 1.0, longMult: 1.3, longS: 5, matchS: 180, usable: 80, contRatio: 0.55,
      lvc: c.lvc, becMin: 6.0, pass: c.pass, fail: c.fail, maxFloor: 'fail', customFloor: 3.4,
      loads: [newLoad('weapon'), newLoad('drive')]
    };
  }
  var seq = 0;
  function newLoad(type) {
    seq++;
    return { id: 'L' + Date.now().toString(36) + seq, type: type || 'weapon', name: '', qty: type === 'drive' ? 2 : 1,
      spinA: '', spinS: '', steadyA: '', respins: '', cruiseA: '', pushA: '', pushS: '', pushes: '', peakA: '', avgA: '', duty: '', limitA: '' };
  }
  function harnessMohm(st) {
    if (st.hMode === 'build') return (AWG[st.hAwg] || 0) * z(st.hLenCm) / 100 + z(st.hConn) * z(st.hConnMohm) + z(st.hSwitch);
    return z(st.hMohm);
  }
  // Per-cell resistance (Ω) from the chosen source.
  function cellR(st, S, P, ahCell) {
    if (st.rMode === 'measured') {
      if (st.measWhich === 'pack') return pos(st.rPack) && S > 0 ? n(st.rPack) / 1000 * P / S : NaN;
      return pos(st.rCell) ? n(st.rCell) / 1000 : NaN;
    }
    if (st.rMode === 'crating') return pos(st.cRating) && pos(st.realism) && pos(st.dvPeak) && ahCell > 0 ? n(st.dvPeak) / (n(st.realism) * n(st.cRating) * ahCell) : NaN;
    return pos(st.k) && ahCell > 0 ? n(st.k) / 1000 / ahCell : NaN;   // quality class: k [mΩ·Ah] / Ah per cell
  }
  function loadCurrents(L) {
    var q = n(L.qty); q = isFinite(q) && q >= 0 ? q : 1;
    var lim = pos(L.limitA) ? n(L.limitA) : Infinity, c = function (a) { return Math.min(z(a), lim) * q; };
    var duty = Math.min(Math.max(z(L.duty), 0), 100) / 100;
    if (L.type === 'weapon') return { burst: c(L.spinA), burstS: z(L.spinS), base: c(L.steadyA), open: c(L.spinA), openS: z(L.spinS),
      events: z(L.respins), eventA: c(L.spinA), eventS: z(L.spinS), contA: c(L.steadyA) * duty };
    if (L.type === 'drive') return { burst: c(L.pushA), burstS: z(L.pushS), base: c(L.cruiseA), open: c(L.cruiseA), openS: 0,
      events: z(L.pushes), eventA: c(L.pushA), eventS: z(L.pushS), contA: c(L.cruiseA) * duty };
    return { burst: c(L.peakA), burstS: 0, base: c(L.avgA), open: c(L.avgA), openS: 0, events: 0, eventA: 0, eventS: 0, contA: c(L.avgA) };
  }
  function verdict(v, st, S) {
    var why = [];
    if (!(v.vPack > 0)) return { level: 'fail', why: ['the pack can’t supply this current (model breaks down)'] };
    if (v.vCell < n(st.fail)) why.push('below the ' + n(st.fail) + ' V/cell floor');
    if (pos(st.lvc) && v.vCell < n(st.lvc)) why.push('below the ESC low-voltage cutoff (' + n(st.lvc) + ' V/cell)');
    if (pos(st.becMin) && v.vPack < n(st.becMin)) why.push('pack below the BEC/receiver minimum (' + n(st.becMin) + ' V)');
    if (why.length) return { level: 'fail', why: why };
    if (v.vCell < n(st.pass)) return { level: 'warn', why: ['between ' + n(st.fail) + ' and ' + n(st.pass) + ' V/cell'] };
    return { level: 'pass', why: ['at or above ' + n(st.pass) + ' V/cell'] };
  }
  function point(I, rest, mult, b, st) {
    var rPack = b.rPackEff * mult, rTot = rPack + b.rH, sag = I * rTot, vPack = b.S * rest - sag;
    var v = { I: I, rest: rest, mult: mult, rPack: rPack, rTotal: rTot, sag: sag, packSag: I * rPack, harnessDrop: I * b.rH,
      vPack: vPack, vCell: vPack / b.S, heatPack: I * I * rPack, heatHarness: I * I * b.rH,
      marginLvc: pos(st.lvc) ? vPack / b.S - n(st.lvc) : NaN, marginBec: pos(st.becMin) ? vPack - n(st.becMin) : NaN, marginFloor: vPack / b.S - n(st.fail) };
    v.verdict = verdict(v, st, b.S);
    return v;
  }
  function maxAmps(restCell, floorCell, S, rTotal) { return rTotal > 0 ? Math.max(0, (restCell - floorCell) * S / rTotal) : NaN; }

  function compute(st) {
    var r = { errors: [] };
    var S = n(st.S), P = n(st.P); if (!(P > 0)) P = 1;
    var ah = st.capMode === 'cell' ? z(st.mahCell) * P / 1000 : z(st.mah) / 1000;
    r.S = S; r.P = P; r.ahPack = ah; r.ahCell = ah / P; r.vFull = n(st.vFull); r.vNom = n(st.vNom);
    if (!(S > 0)) r.errors.push('cells in series (S)');
    if (!(ah > 0)) r.errors.push('capacity');
    if (!(r.vFull > 0)) r.errors.push('full-charge V/cell');
    r.wh = S * r.vNom * ah; r.vPackFull = S * r.vFull; r.vPackNom = S * r.vNom;
    r.rCell = cellR(st, S, P, r.ahCell);
    if (!(r.rCell > 0)) r.errors.push(st.rMode === 'measured' ? 'measured resistance' : st.rMode === 'crating' ? 'C-rating' : 'quality k');
    r.rPack = st.rMode === 'measured' && st.measWhich === 'pack' && pos(st.rPack) ? n(st.rPack) / 1000 : S / P * r.rCell;
    r.temp = pos(st.tempFactor) ? n(st.tempFactor) : 1;
    r.rPackEff = r.rPack * r.temp; r.rH = harnessMohm(st) / 1000; r.harnessMohm = r.rH * 1000;
    r.labelMaxA = st.rMode === 'crating' && pos(st.cRating) ? n(st.cRating) * ah : NaN;
    r.valid = !r.errors.length;
    var restEnd = pos(st.restEnd) ? n(st.restEnd) : r.vFull, sm = pos(st.shortMult) ? n(st.shortMult) : 1, lm = pos(st.longMult) ? n(st.longMult) : 1, ls = pos(st.longS) ? n(st.longS) : 5;
    var multFor = function (dur) { return dur > ls ? lm : sm; };
    var L = (st.loads || []).map(loadCurrents);
    var sum = function (k) { return L.reduce(function (a, x) { return a + x[k]; }, 0); };
    r.loadsCount = L.length;
    if (!r.valid) return r;
    var b = { S: S, rPackEff: r.rPackEff, rH: r.rH };
    // 1. worst case: every burst at once (weapon re-spin + drive push + other peaks), late in the match unless "fresh" is ticked
    var wI = sum('burst'), wDur = L.reduce(function (a, x) { return x.burst > 0 ? Math.max(a, x.burstS) : a; }, 0);
    r.worst = point(wI, st.worstFresh ? r.vFull : restEnd, multFor(wDur), b, st); r.worst.dur = wDur; r.worst.late = !st.worstFresh;
    // 2. opening spin-up: weapons spin up, drives cruise, others at average, on a fresh pack
    var oI = sum('open'), oDur = L.reduce(function (a, x) { return x.open > 0 ? Math.max(a, x.openS) : a; }, 0);
    r.opening = point(oI, r.vFull, multFor(oDur), b, st); r.opening.dur = oDur;
    // 3. duty-weighted average over the match
    var match = pos(st.matchS) ? n(st.matchS) : 180;
    var avg = L.reduce(function (a, x) { return a + x.contA + x.eventA * Math.min(x.events * x.eventS, match) / match; }, 0);
    var a = point(avg, (r.vFull + restEnd) / 2, 1, b, st);
    a.mAh = avg * match / 3.6; a.capPct = ah > 0 ? a.mAh / (ah * 1000) * 100 : NaN;
    var usable = pos(st.usable) ? n(st.usable) / 100 : 0.8;
    a.runtimeMin = avg > 0 ? usable * ah / avg * 60 : Infinity;
    a.avgC = avg / ah;
    a.contA = (pos(st.contRatio) ? n(st.contRatio) : 0.55) * 0.5 * S / r.rPackEff;   // ≈ continuous rating estimate
    a.contC = a.contA / ah;
    var lvl = 'pass', why = [];
    if (avg > a.contA) { lvl = 'fail'; why.push('average current is above the continuous estimate (pack will overheat)'); }
    else if (avg > 0.8 * a.contA) { lvl = 'warn'; why.push('average current is within 20% of the continuous estimate'); }
    if (a.capPct > 85) { lvl = 'fail'; why.push('uses over 85% of capacity per match'); }
    else if (a.capPct > 70) { if (lvl !== 'fail') lvl = 'warn'; why.push('uses over 70% of capacity per match'); }
    if (!why.length) why.push('average current and capacity use are within limits');
    a.verdict = { level: lvl, why: why }; a.match = match;
    r.average = a;
    // max amps for the chosen floor
    var floor = st.maxFloor === 'pass' ? n(st.pass) : st.maxFloor === 'lvc' ? n(st.lvc) : st.maxFloor === 'custom' ? n(st.customFloor) : n(st.fail);
    r.floor = floor;
    r.maxA = { lateShort: maxAmps(restEnd, floor, S, r.rPackEff * sm + r.rH), lateLong: maxAmps(restEnd, floor, S, r.rPackEff * lm + r.rH),
      freshShort: maxAmps(r.vFull, floor, S, r.rPackEff * sm + r.rH), freshLong: maxAmps(r.vFull, floor, S, r.rPackEff * lm + r.rH) };
    r.restEnd = restEnd;
    return r;
  }
  var api = { CHEM: CHEM, QUALITY: QUALITY, AWG: AWG, defaults: defaults, newLoad: newLoad, compute: compute, harnessMohm: harnessMohm, cellR: cellR, maxAmps: maxAmps, point: point };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SagMath = api;
})(this);
