/* Weight budget calculator (work in progress; opened from Calcs, #calc/weight): per-robot weight budget spreadsheet. Math, limits and file formats live in weightmath.js.
   Saved per robot in localStorage ("wb_v1_<botId>"). Desktop (≥900px) shows a spreadsheet table, phones show cards. */
(function () {
  'use strict';
  var W = window.WeightMath, lastCat = 'Weapon', root = null, botId = null, sheet = null, openIds = {}, pending = null, armClear = false, lastWide = null;
  var KEY = 'wb_v1_';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function wide() { return window.matchMedia('(min-width:900px)').matches; }
  function bot() { return window.App && window.App.currentBot ? window.App.currentBot() : null; }
  function load() {
    var b = bot(); botId = b ? b.id : 'default';
    var s = null; try { s = JSON.parse(localStorage.getItem(KEY + botId) || 'null'); } catch (e) {}
    var cls = b && [1, 3, 12, 30].indexOf(+b.weightClass) >= 0 ? String(b.weightClass) : '';
    sheet = s && s.parts ? Object.assign(W.newSheet(cls), W.migrate(s)) : W.newSheet(cls);
    if (!sheet.cats || !sheet.cats.length) sheet.cats = W.CATS.slice();
  }
  function save() { try { localStorage.setItem(KEY + botId, JSON.stringify(sheet)); } catch (e) {} }
  function part(id) { for (var i = 0; i < sheet.parts.length; i++) if (sheet.parts[i].id === id) return sheet.parts[i]; return null; }
  function U() { return sheet.unit || 'g'; }
  function dispU(g) { if (!isFinite(W.num(g))) return ''; var v = W.fromG(W.num(g), U()); return String(+v.toFixed(U() === 'g' ? 2 : U() === 'oz' ? 3 : 4)); }
  function both(g) { if (!isFinite(g)) return '—'; return U() === 'g' ? W.fmtW(g, 'g') + ' · ' + W.fmtW(g, 'lb') : W.fmtW(g, U()) + ' · ' + W.fmtW(g, 'g'); }
  function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function sel(path, options, cur, attrs) { return '<select data-w="' + path + '"' + (attrs || '') + '>' + options.map(function (o) { return opt(o[0], o[1], cur); }).join('') + '</select>'; }
  function inp(path, val, attrs) { return '<input data-w="' + path + '" value="' + esc(val) + '"' + (attrs || ' type="text"') + '>'; }
  function numIn(path, val, ph) { return inp(path, val, ' type="number" inputmode="decimal" step="any" min="0"' + (ph ? ' placeholder="' + esc(ph) + '"' : '')); }
  function catOpts() { var c = sheet.cats.slice(); sheet.parts.forEach(function (p) { if (c.indexOf(p.cat) < 0) c.push(p.cat); }); return c.map(function (x) { return [x, x]; }); }
  var RULE_LINK = function () { return '<a href="' + W.RULES.url + '" target="_blank" rel="noopener">NHRL Open Rules 2026</a>'; };
  var SPARC_LINK = function () { return '<a href="' + W.SPARC.url + '" target="_blank" rel="noopener">SPARC Robot Construction Specifications v1.7</a>'; };
  var SPARC_LOCO = { traditional: 'Rolling (wheels, tracks or the whole robot)', shuffler: 'Shuffler (SPARC 1.25×)', bristle: 'Bristle drive (SPARC non-traditional 1.5×)', flying: 'Flying (SPARC non-traditional 1.5×, event decides)', gyro: 'Gyro walker (SPARC non-traditional 1.5×)', torque: 'Torque drive (SPARC non-traditional 1.5×)', jansen: 'Jansen linkage (not listed by SPARC)', hover: 'Hovercraft (SPARC non-traditional 1.5×)', 'ntl-other': 'Other non-traditional (unverified)', walker: 'Walker (SPARC 2×)' };

  /* ---------- summary ---------- */
  function bar(g, limG, st) {
    var pct = limG > 0 ? Math.min(100, g / limG * 100) : 0, wp = limG > 0 ? 100 - (W.num(sheet.warnPct) >= 0 ? W.num(sheet.warnPct) : W.WARN_DEFAULT) : 0;
    return '<div class="wbbar ' + st.level + '"><i style="width:' + pct.toFixed(1) + '%"></i>' + (limG > 0 ? '<b style="left:' + wp + '%" title="warn line"></b>' : '') + '</div>';
  }
  function summaryHtml() {
    var s = W.summary(sheet), L = s.limit, st = s.status, b = bot(), h = '';
    h += '<div class="wbsum-top"><div><div class="wbbig">' + esc(W.fmtW(s.total, U())) + '</div><div class="note">' + (U() === 'g' ? esc(W.fmtW(s.total, 'lb')) + ' · ' + esc(W.fmtW(s.total, 'oz')) : esc(W.fmtW(s.total, 'g'))) + ' counted</div></div>' +
      '<span class="wbst ' + st.level + '">' + esc(st.label) + '</span></div>';
    h += bar(s.total, L.g, st);
    if (isFinite(L.g)) {
      h += '<div class="wbkv"><span>Limit</span><b>' + esc(both(L.g)) + '</b><span></span><small>' + esc(L.label) + (L.overridden ? ' · not from the rules' : '') + '</small>' +
        '<span>' + (s.remaining >= 0 ? 'Remaining' : 'Over by') + '</span><b class="' + (s.remaining >= 0 ? '' : 'neg') + '">' + esc(both(Math.abs(s.remaining))) + '</b>' +
        '<span>Used</span><b>' + s.pct.toFixed(1) + '%</b></div>';
      if (st.note) h += '<div class="wbnote ' + st.level + '">' + esc(st.note) + (st.level === 'over' && L.ruleset === 'nhrl' ? ' (NHRL pre-fight weight check). Robots also will not pass bot inspection if overweight.' : '') + '</div>';
    } else h += '<div class="wbnote warn">No limit set: pick the weight class below' + (b && b.planned ? ' (this robot’s class is Unknown in the team data)' : '') + ', or enter a custom limit.</div>';
    (L.flags || []).forEach(function (f) { h += '<div class="wbnote warn">' + esc(f) + '</div>'; });
    if (L.conflict) h += '<div class="wbnote over">Locomotion bonus and multibot bonus cannot be combined (NHRL rules: choose one). No bonus is applied until you pick one.</div>';
    if (s.segs.length) h += '<div class="wbsegs">' + s.segs.map(function (x) { return '<div class="wbseg"><div class="wbseg-h"><span>Segment ' + x.seg + '</span><b>' + esc(W.fmtW(x.g, U())) + ' / ' + esc(W.fmtW(L.segG, U())) + '</b><span class="wbst sm ' + x.status.level + '">' + esc(x.status.label) + '</span></div>' + bar(x.g, L.segG, x.status) + '</div>'; }).join('') + '</div>';
    var extra = [];
    if (s.exempt > 0) extra.push('Exempt (not counted): ' + W.fmtW(s.exempt, U()));
    if (s.unweighed) extra.push(s.unweighed + ' part' + (s.unweighed > 1 ? 's' : '') + ' without a weight');
    if (s.printed.both) { var d = s.printed.meas - s.printed.est; extra.push('Prints: measured ' + W.fmtW(s.printed.meas, 'g') + ' vs slicer ' + W.fmtW(s.printed.est, 'g') + ' (' + (d >= 0 ? '+' : '') + d.toFixed(1) + ' g, ' + (s.printed.est ? (d / s.printed.est * 100 >= 0 ? '+' : '') + (d / s.printed.est * 100).toFixed(1) + '%' : '—') + ')'); }
    if (isFinite(s.weaponPct) && s.byCat.Weapon && s.byCat.Weapon.g > 0) extra.push('Weapon category: ' + s.weaponPct.toFixed(0) + '% of the limit');
    if (extra.length) h += '<div class="note wbextra">' + extra.map(esc).join(' · ') + '</div>';
    return h;
  }

  /* ---------- limit / settings card ---------- */
  function limitHtml() {
    var L = W.limitOf(sheet), loco = W.loco(sheet.loco), c = W.RULES.classes[sheet.cls], sp = W.SPARC.classes[sheet.cls], h = '<div class="card wblimit"><h2>Class limit</h2><div class="fgrid wb3">';
    h += '<label class="fld"><span>Weight class</span>' + sel('s.cls', [['', 'Unknown, pick one'], ['1', '1lb (SPARC rules; not an NHRL class)'], ['3', '3lb'], ['12', '12lb'], ['30', '30lb']], sheet.cls) + '</label>';
    h += '<label class="fld"><span>Locomotion type</span>' + sel('s.loco', W.LOCO.map(function (l) { return [l.id, sp ? SPARC_LOCO[l.id] : l.name]; }), sheet.loco) + '</label>';
    h += '<label class="fld"><span>Multibot</span>' + sel('s.multi', W.MULTI.map(function (m) { return [m[0], sp && m[0] > 1 ? m[1].replace('Multibot bonus', 'Multibot') + ' (no SPARC bonus)' : m[1]]; }), sheet.multi || 1) + '</label>';
    h += '<label class="fld"><span>Custom limit override <b class="sgtag">optional</b></span>' + numIn('s.override', sheet.override, 'from rules') + '<em>lb</em></label>';
    h += '<label class="fld"><span>Warn when within</span>' + numIn('s.warnPct', sheet.warnPct, String(W.WARN_DEFAULT)) + '<em>%</em></label>';
    h += '<label class="fld"><span>Enter weights in</span>' + sel('s.unit', [['g', 'grams (g)'], ['oz', 'ounces (oz)'], ['lb', 'pounds (lb)']], U()) + '</label></div>';
    if (sp) {
      h += '<div class="note wbrule"><b>1lb under SPARC rules:</b> NHRL’s 2026 rules define only 3lb, 12lb and 30lb, so this uses ' + SPARC_LINK() + ' (' + esc(W.SPARC.checked) + ' check), section 3 “Weight Classes”: rolling ' + sp.base + ' lb (SPARC lists 454 g), shuffler ' + sp.shuffler + ' lb, non-traditional ' + sp.ntl + ' lb, walker ' + sp.walker + ' lb. ' +
        'Section 4: walkers have no rolling elements on the floor and no continuous rolling or cam-operated floor motion (directly or via a linkage); shuffling is rotational cam-operated legs; non-traditional is bristle/torque drive, gyro walkers, hovercrafts (jumping and flying only at some events). SPARC asks builders of non-wheeled robots to contact the event early. SPARC defines no multibot bonus. ' +
        '<a href="' + W.SPARC.eventUrl + '" target="_blank" rel="noopener">Example 1lb event at NHRL</a> using “General SPARC rules”. Your event’s own rules win.</div>';
      h += '<div class="note">Source: ' + SPARC_LINK() + '. ' + (L.overridden ? '<b class="wbwarn">Using your custom limit, not the rules.</b>' : L.verified ? 'Limit taken from the SPARC table.' : '<b class="wbwarn">Not verified for this choice: see the note above; set a custom limit once your event confirms.</b>') + '</div>';
    } else {
    var bonusTxt = !c ? 'Pick a class to see the allowance.' : loco.kind === 'ntl' ? '+' + c.ntl + ' lb non-traditional locomotion bonus → ' + (c.base + c.ntl) + ' lb.' : loco.kind === 'walker' ? '+' + c.walker + ' lb true walker bonus → ' + (c.base + c.walker) + ' lb. Needs NHRL approval before registration.' : 'No locomotion bonus: ' + c.base + ' lb.';
    h += '<div class="note wbrule"><b>' + esc(loco.name) + ':</b> ' + esc(bonusTxt) + ' ' +
      (loco.kind === 'traditional' ? esc(loco.rule) : loco.kind === 'ntl' ? 'Listed by NHRL as a non-traditional locomotion example (shuffling, bristle bots, flying systems, gyroscopic precession, torque reaction, Jansen linkages, hovercrafts). Cannot use unpowered rotating objects (wheels, drums, rollers, ball bearings) to reduce friction, or wheel-like features to ease rotation, in any orientation.' :
        'Legs that contact the floor and move with two or more independently controlled degrees of freedom; locomotion must not be possible from continuous motor rotation or single-degree-of-freedom leg motion; must also meet the non-traditional rules.') +
      ' NHRL has final say on locomotion bonuses. Multibots: every segment must qualify. Declare bonus use before the event.</div>';
    h += '<div class="note">Source: ' + RULE_LINK() + ' (checked ' + esc(W.RULES.checked) + '). ' + (L.overridden ? '<b class="wbwarn">Using your custom limit, not the rules.</b>' : L.verified ? 'Limit taken from the rules table.' : '<b class="wbwarn">No verified limit for this robot yet.</b>') + '</div>';
    }
    h += '<details class="wbrules"><summary>Weight rules used here (NHRL 2026, SPARC v1.7 for 1lb)</summary>' + rulesHtml() + '</details></div>';
    return h;
  }
  function rulesHtml() {
    var C = W.RULES.classes, rows = [3, 12, 30].map(function (k) { var c = C[k]; return '<tr><td>' + k + ' lb</td><td>' + c.base + '</td><td>+' + c.ntl + ' (' + (c.base + c.ntl) + ')</td><td>+' + c.walker + ' (' + (c.base + c.walker) + ')</td><td>' + c.multi[2] + ' / ' + c.multi[3] + ' / ' + c.multi[4] + '</td></tr>'; }).join('');
    return '<table class="sgtbl wbrtbl"><tr><th>Class</th><th>Max lb</th><th>Non-trad. loco.</th><th>True walker</th><th>Multibot max per segment (2 / 3 / 4 parts)</th></tr>' + rows + '</table>' +
      '<ul class="note sglist">' +
      '<li>Robots must weigh at or below their class maximum at the start of each fight. There is no stated tolerance: at the pre-fight weight check, up to 2.5 oz over gives 1 TKO point (you may still fight if you fix it quickly); more than 2.5 oz over gives 3 TKO points and an immediate TKO.</li>' +
      '<li>Locomotion and multibot bonuses cannot be combined. Bonuses and exemptions can be used together. Bonuses are declared before the event and tied to the robot’s archetype.</li>' +
      '<li>Multibot bonus: up to 4 segments, each gets an equal share; unused weight can’t move between segments. Without the bonus, weight can be split freely.</li>' +
      '<li>Exemptions (mark parts “Exempt”): systems with fuel or stored liquids/gases are weighed dry (flamethrowers with an empty tank installed; pneumatic and ICE tanks removed; hydraulic fluid pre-declared and subtracted). Electronics used only for discrete autonomous functions and active cameras don’t count, but need NHRL approval.</li>' +
      '<li>Also: rigidly coupled spinning weapon parts can’t exceed the nominal class limit; weapon modules can’t exceed 50% of the robot’s maximum weight including bonuses.</li></ul>' +
      '<div class="sectiontitle sgst">1lb (SPARC, not an NHRL class)</div><table class="sgtbl wbrtbl"><tr><th>Class</th><th>Rolling</th><th>Shuffler (1.25×)</th><th>Non-traditional (1.5×)</th><th>Walker (2×)</th></tr><tr><td>1 lb</td><td>1 lb (454 g)</td><td>1.25 lb</td><td>1.5 lb</td><td>2 lb</td></tr></table>' +
      '<div class="note">Source: ' + SPARC_LINK() + ' (Sep 1, 2026), sections 3 and 4. SPARC defines no multibot bonus and no weigh-in tolerance; Jansen linkages and “other” methods aren’t classified, so the app flags them instead of guessing. The NHRL penalties and exemptions above apply to NHRL classes only.</div>' +
      '<div class="note">Source: ' + RULE_LINK() + ' sections “Weight Requirements”, “Locomotion Based Weight Bonuses”, “Multibot Weight Bonuses”, “Weight Exemptions”, “Modular Weapons” and “Pre-Fight Weight Checks”. Always check the current rules before an event.</div>';
  }

  /* ---------- parts ---------- */
  function printFields(p) {
    var m = W.material(p.mat), pi = W.printInfo(p), h = '<div class="wbprint"><div class="fgrid wb3">';
    h += '<label class="fld"><span>Material</span>' + sel(p.id + '.mat', W.MATERIALS.map(function (x) { return [x.id, x.name + (x.d ? ' · ' + x.d : '')]; }), p.mat) + '</label>';
    if (p.mat === 'other') h += '<label class="fld"><span>Density <b class="sgtag">typical / unsourced</b></span>' + numIn(p.id + '.density', p.density, 'e.g. 1.2') + '<em>g/cm³</em></label>';
    h += '<label class="fld"><span>Infill</span>' + numIn(p.id + '.infill', p.infill, '%') + '<em>%</em></label>';
    h += '<label class="fld"><span>Walls</span>' + numIn(p.id + '.walls', p.walls, 'count') + '</label>';
    h += '<label class="fld"><span>Layer height</span>' + numIn(p.id + '.layer', p.layer, '0.2') + '<em>mm</em></label>';
    h += '<label class="fld"><span>Slicer estimate</span>' + numIn(p.id + '.slicerG', p.slicerG, 'per part') + '<em>g</em></label>';
    h += '<label class="fld"><span>Measured after print</span>' + numIn(p.id + '.measuredG', p.measuredG, 'per part') + '<em>g</em></label>';
    h += '<label class="fld"><span>Model volume <b class="sgtag">optional</b></span>' + numIn(p.id + '.volCm3', p.volCm3, 'from CAD') + '<em>cm³</em></label></div>';
    h += '<div class="note" data-pinfo="' + p.id + '">' + printInfoText(p) + '</div>';
    h += '<div class="note">' + (m && m.url ? 'Density: <a href="' + m.url + '" target="_blank" rel="noopener">' + esc(m.src) + '</a> (ISO 1183). Other brands differ.' : 'Custom density: typical/unsourced, enter your filament’s data-sheet value.') + ' Weight used: measured, else slicer estimate, else the unit weight.</div></div>';
    return h;
  }
  function printInfoText(p) {
    var pi = W.printInfo(p), t = [];
    if (isFinite(pi.deltaG)) t.push('<b class="' + (pi.deltaG > 0 ? 'neg' : 'posv') + '">Measured vs slicer: ' + (pi.deltaG >= 0 ? '+' : '') + pi.deltaG.toFixed(1) + ' g (' + (pi.deltaPct >= 0 ? '+' : '') + (isFinite(pi.deltaPct) ? pi.deltaPct.toFixed(1) : '—') + '%)</b>');
    if (isFinite(pi.solidG)) t.push('Solid (100%) upper bound: ' + pi.solidG.toFixed(1) + ' g' + (pi.sourced ? '' : ' (unsourced density)'));
    t.push('Using: ' + W.unitWeight(p).from);
    return t.join(' · ');
  }
  function extraFields(p) {
    var L = W.limitOf(sheet), h = '<div class="wbextra2"><label class="sgchk"><input type="checkbox" data-w="' + p.id + '.print"' + (p.print ? ' checked' : '') + '> <span>3D printed part</span></label>' +
      '<label class="sgchk"><input type="checkbox" data-w="' + p.id + '.exempt"' + (p.exempt ? ' checked' : '') + '> <span>Exempt from weigh-in (fuel, fluid, camera…)</span></label>';
    if (p.exempt) h += '<label class="fld wbwhy"><span>Exemption reason</span>' + inp(p.id + '.exemptWhy', p.exemptWhy, ' type="text" placeholder="e.g. active camera (needs approval)"') + '</label>';
    if (L.segs > 1) h += '<label class="fld wbwhy"><span>Multibot segment</span>' + sel(p.id + '.seg', Array.from({ length: L.segs }, function (_, i) { return [i + 1, 'Segment ' + (i + 1)]; }), p.seg || 1) + '</label>';
    h += '</div>';
    if (p.print) h += printFields(p);
    return h;
  }
  function unitCell(p) {
    var uw = W.unitWeight(p);
    if (p.print && uw.from !== 'unit weight') return '<span class="wbauto" title="from ' + esc(uw.from) + '" data-uauto="' + p.id + '">' + esc(W.fmtW(uw.g, U())) + '</span>';
    return numIn(p.id + '.unitW', dispU(p.unitG), U());
  }
  function badges(p) { return (p.print ? '<span class="cbadge you">3D</span>' : '') + (p.exempt ? '<span class="cbadge unk">exempt</span>' : '') + '<span class="cbadge ' + (p.source === 'measured' ? 'ok' : 'unk') + '">' + esc(p.source) + '</span>'; }
  function groups() {
    var s = W.summary(sheet), list = W.sortedParts(sheet), g = [];
    s.order.forEach(function (c) { var ps = list.filter(function (p) { return p.cat === c; }); if (ps.length || W.CATS.indexOf(c) < 0) g.push({ cat: c, parts: ps, sub: s.byCat[c] ? s.byCat[c].g : 0, custom: W.CATS.indexOf(c) < 0 }); });
    return g;
  }
  function tableHtml() {
    var srcO = W.SOURCES.map(function (x) { return [x, x]; }), co = catOpts();
    var h = '<div class="wbtblwrap"><table class="wbtbl"><colgroup><col style="width:22%"><col style="width:15%"><col style="width:64px"><col style="width:96px"><col style="width:96px"><col style="width:118px"><col><col style="width:40px"><col style="width:34px"><col style="width:34px"></colgroup><thead><tr><th class="c-name">Part</th><th>Category</th><th class="r">Qty</th><th class="r">Unit (' + U() + ')</th><th class="r">Total</th><th>Source</th><th>Notes</th><th class="c">3D</th><th></th><th></th></tr></thead>';
    groups().forEach(function (G) {
      h += '<tbody><tr class="wbgrp"><td colspan="4">' + esc(G.cat) + ' <small>' + G.parts.length + ' part' + (G.parts.length === 1 ? '' : 's') + '</small>' + (G.custom && !G.parts.length ? ' <button type="button" class="wbx" data-wa="delcat" data-cat="' + esc(G.cat) + '" aria-label="Remove category">×</button>' : '') + '</td><td class="r" data-sub="' + esc(G.cat) + '">' + esc(W.fmtW(G.sub, U())) + '</td><td colspan="5"><button type="button" class="wbadd" data-wa="add" data-cat="' + esc(G.cat) + '">+ Add ' + esc(G.cat) + ' part</button></td></tr>';
      G.parts.forEach(function (p) {
        var o = !!openIds[p.id];
        h += '<tr class="wbrow' + (p.exempt ? ' exempt' : '') + '"><td class="c-name">' + inp(p.id + '.name', p.name, ' type="text" placeholder="Part name"') + '</td><td>' + sel(p.id + '.cat', co, p.cat) + '</td><td class="r">' + numIn(p.id + '.qty', p.qty) + '</td><td class="r">' + unitCell(p) + '</td>' +
          '<td class="r tot" data-tot="' + p.id + '">' + esc(W.fmtW(W.partTotal(p), U())) + '</td><td>' + sel(p.id + '.source', srcO, p.source) + '</td><td>' + inp(p.id + '.notes', p.notes, ' type="text" placeholder="—"') + '</td>' +
          '<td class="c"><input type="checkbox" data-w="' + p.id + '.print"' + (p.print ? ' checked' : '') + ' aria-label="3D printed"></td><td><button type="button" class="wbmore' + (o ? ' on' : '') + '" data-wa="toggle" data-id="' + p.id + '" aria-label="More fields">' + (o ? '▴' : '▾') + '</button></td><td><button type="button" class="wbx" data-wa="del" data-id="' + p.id + '" aria-label="Delete part">×</button></td></tr>';
        if (o || p.print) h += '<tr class="wbdetail"><td colspan="10">' + extraFields(p) + '</td></tr>';
      });
      h += '</tbody>';
    });
    return h + '</table></div>';
  }
  function cardsHtml() {
    var srcO = W.SOURCES.map(function (x) { return [x, x]; }), co = catOpts(), h = '';
    groups().forEach(function (G) {
      h += '<div class="wbgrpc"><div class="wbgrpc-h"><span>' + esc(G.cat) + '</span><b data-sub="' + esc(G.cat) + '">' + esc(W.fmtW(G.sub, U())) + '</b>' + (G.custom && !G.parts.length ? '<button type="button" class="wbx" data-wa="delcat" data-cat="' + esc(G.cat) + '" aria-label="Remove category">×</button>' : '') + '</div>';
      G.parts.forEach(function (p) {
        var o = !!openIds[p.id], uw = W.unitWeight(p);
        h += '<div class="wbcard' + (o ? ' open' : '') + (p.exempt ? ' exempt' : '') + '"><button type="button" class="wbcard-h" data-wa="toggle" data-id="' + p.id + '"><span class="wbcard-n">' + esc(p.name || 'Unnamed part') + '</span><span class="wbcard-t" data-tot="' + p.id + '">' + esc(W.fmtW(W.partTotal(p), U())) + '</span>' +
          '<span class="wbcard-s" data-line="' + p.id + '">' + esc(W.qtyOf(p) + ' × ' + W.fmtW(uw.g, U())) + '</span><span class="wbcard-b">' + badges(p) + '</span></button>';
        if (o) h += '<div class="wbcard-b2"><div class="fgrid"><label class="fld wbfull"><span>Name</span>' + inp(p.id + '.name', p.name, ' type="text" placeholder="Part name"') + '</label>' +
          '<label class="fld"><span>Category</span>' + sel(p.id + '.cat', co, p.cat) + '</label><label class="fld"><span>Quantity</span>' + numIn(p.id + '.qty', p.qty) + '</label>' +
          '<label class="fld"><span>Unit weight</span>' + (p.print && uw.from !== 'unit weight' ? '<span class="wbauto" data-uauto="' + p.id + '">' + esc(W.fmtW(uw.g, U())) + ' (' + esc(uw.from) + ')</span>' : numIn(p.id + '.unitW', dispU(p.unitG), U()) + '<em>' + U() + '</em>') + '</label>' +
          '<label class="fld"><span>Weight source</span>' + sel(p.id + '.source', srcO, p.source) + '</label><label class="fld wbfull"><span>Notes</span>' + inp(p.id + '.notes', p.notes, ' type="text"') + '</label></div>' +
          extraFields(p) + '<div class="sgbtns"><button type="button" class="btn ghost sm" data-wa="del" data-id="' + p.id + '">Delete part</button></div></div>';
        h += '</div>';
      });
      h += '<button type="button" class="wbadd" data-wa="add" data-cat="' + esc(G.cat) + '">+ Add ' + esc(G.cat) + ' part</button></div>';
    });
    return h;
  }
  function importHtml() {
    if (!pending) return '';
    if (pending.kind === 'error') return '<div class="card wbimp bad"><h2>Import failed</h2><div class="note">' + esc(pending.msg) + '</div><div class="sgbtns"><button type="button" class="btn ghost sm" data-wa="impcancel">Dismiss</button></div></div>';
    if (pending.kind === 'json') return '<div class="card wbimp"><h2>Restore backup?</h2><div class="note">' + esc(pending.file) + ': weight sheets for ' + pending.names.map(esc).join(', ') + '. Restoring replaces the sheets of those robots on this device.</div><div class="sgbtns"><button type="button" class="btn sm" data-wa="jsonok">Restore</button><button type="button" class="btn ghost sm" data-wa="impcancel">Cancel</button></div></div>';
    var r = pending.res, m = Object.keys(r.mapped).map(function (k) { return esc(r.mapped[k]) + ' → ' + k; }).join(', ');
    return '<div class="card wbimp"><h2>Import ' + r.parts.length + ' part' + (r.parts.length === 1 ? '' : 's') + '?</h2><div class="note">' + esc(pending.file) + '. Columns matched: ' + (m || 'none') + '.' + (r.newCats.length ? ' New categories: ' + r.newCats.map(esc).join(', ') + '.' : '') + '</div>' +
      (r.warnings.length ? '<div class="wbnote warn">' + r.warnings.map(esc).join('<br>') + '</div>' : '') +
      '<div class="sgbtns"><button type="button" class="btn sm" data-wa="impappend">Add to this sheet</button><button type="button" class="btn ghost sm" data-wa="impreplace">Replace all parts</button><button type="button" class="btn ghost sm" data-wa="impcancel">Cancel</button></div></div>';
  }
  function render() {
    if (!root) return;
    load(); lastWide = wide();
    var b = bot(), h = '<div class="calcbar"><button class="back" data-back>‹ Calculators</button></div><div class="wbhead"><div><div class="wbtitle">Weight budget <span class="tbuild">Work in progress</span></div><div class="note">' + esc(b ? b.name : '') + ' · parts list saved on this device, per robot (switch robots to switch sheets)</div></div></div>';
    h += '<div class="wbtop"><div class="card wbsum" id="wbSum">' + summaryHtml() + '</div>' + limitHtml() + '</div>';
    h += importHtml();
    h += '<div class="card wbparts"><div class="wbparts-h"><h2>Parts <small>' + sheet.parts.length + '</small></h2><div class="wbtools">' +
      '<span class="wbnewcat"><select id="wbAddCat" aria-label="Category for the new part">' + catOpts().map(function (o) { return opt(o[0], o[1], lastCat); }).join('') + '</select><button type="button" class="btn sm" data-wa="add">+ Add part</button></span>' +
      '<span class="wbnewcat"><input type="text" id="wbNewCat" placeholder="New category" aria-label="New category name"><button type="button" class="btn ghost sm" data-wa="addcat">Add category</button></span></div></div>';
    h += sheet.parts.length ? '' : '<div class="note wbempty">No parts yet. Add parts by category, or import a CSV / Excel file (download the template to start).</div>';
    h += lastWide ? tableHtml() : cardsHtml();
    h += '<div class="wbfiles"><div class="sectiontitle">Spreadsheet files</div><div class="sgbtns">' +
      '<button type="button" class="btn ghost sm" data-wa="xlsx">Export Excel (.xlsx)</button><button type="button" class="btn ghost sm" data-wa="csv">Export CSV</button>' +
      '<label class="btn ghost sm wbfile">Import CSV / Excel<input type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-wf="sheet" hidden></label>' +
      '<button type="button" class="btn ghost sm" data-wa="template">Download template</button></div>' +
      '<div class="sgbtns"><button type="button" class="btn ghost sm" data-wa="json">Backup all robots (JSON)</button><label class="btn ghost sm wbfile">Restore backup<input type="file" accept=".json,application/json" data-wf="json" hidden></label>' +
      '<button type="button" class="btn ghost sm wbdanger" data-wa="clear">' + (armClear ? 'Tap again to clear all parts' : 'Clear all parts') + '</button></div>' +
      '<div class="note">CSV is UTF-8 with Excel-friendly quoting; weights in grams. Import matches columns by name (Part/Name/Item, Qty/Count, Weight/Unit weight/Each with g, oz, lb or kg, Total, Category, Source, Notes, Material…). Only the first sheet of an .xlsx is read.</div></div></div>';
    root.innerHTML = h;
  }
  function refreshNumbers() {
    var e = document.getElementById('wbSum'); if (e) e.innerHTML = summaryHtml();
    var s = W.summary(sheet);
    root.querySelectorAll('[data-sub]').forEach(function (n) { var c = s.byCat[n.dataset.sub]; n.textContent = W.fmtW(c ? c.g : 0, U()); });
    root.querySelectorAll('[data-tot]').forEach(function (n) { var p = part(n.dataset.tot); if (p) n.textContent = W.fmtW(W.partTotal(p), U()); });
    root.querySelectorAll('[data-line]').forEach(function (n) { var p = part(n.dataset.line); if (p) n.textContent = W.qtyOf(p) + ' × ' + W.fmtW(W.unitWeight(p).g, U()); });
    root.querySelectorAll('[data-pinfo]').forEach(function (n) { var p = part(n.dataset.pinfo); if (p) n.innerHTML = printInfoText(p); });
    root.querySelectorAll('[data-uauto]').forEach(function (n) { var p = part(n.dataset.uauto); if (p) { var u = W.unitWeight(p); n.textContent = W.fmtW(u.g, U()) + (n.closest('.wbcard') ? ' (' + u.from + ')' : ''); } });
  }
  var RERENDER = { cat: 1, print: 1, exempt: 1, mat: 1, seg: 1, source: 1 };
  function onInput(e) {
    var t = e.target, path = t.dataset && t.dataset.w; if (!path) return;
    var dot = path.indexOf('.'), id = path.slice(0, dot), f = path.slice(dot + 1), v = t.type === 'checkbox' ? t.checked : t.value;
    if (id === 's') {
      sheet[f] = f === 'multi' ? +v : v; if (f === 'warnPct') sheet.warnCustom = v !== '' && +v !== W.WARN_DEFAULT; save();
      if (e.type === 'change' && t.tagName === 'SELECT') render(); else refreshNumbers();
      return;
    }
    var p = part(id); if (!p) return;
    if (f === 'unitW') p.unitG = v === '' ? '' : +W.toG(v, U()).toFixed(4);
    else if (f === 'seg') p.seg = +v; else p[f] = v;
    if (f === 'measuredG' && e.type === 'change' && v !== '' && p.source !== 'measured') { p.source = 'measured'; save(); render(); return; }
    save();
    if (RERENDER[f] && (e.type === 'change')) render(); else if (!RERENDER[f]) refreshNumbers();
    if (f === 'name' && !lastWide) { var c = t.closest('.wbcard'); var n = c && c.querySelector('.wbcard-n'); if (n) n.textContent = v || 'Unnamed part'; }
  }
  function download(name, data, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function fname(ext) { var b = bot(), n = (b ? b.name : 'robot').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(), d = new Date(); return n + '-weight-budget-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.' + ext; }
  function onClick(e) {
    var b = e.target.closest('[data-wa]'); if (!b || !root.contains(b)) return;
    var a = b.dataset.wa;
    if (a !== 'clear') armClear = false;
    if (a === 'add') { var sc = document.getElementById('wbAddCat'), cat = b.dataset.cat || (sc ? sc.value : 'Other'); lastCat = cat; var p = W.newPart(cat); sheet.parts.push(p); openIds[p.id] = !wide(); save(); render(); var i = root.querySelector('[data-w="' + p.id + '.name"]'); if (i) { i.focus(); } return; }
    if (a === 'del') { sheet.parts = sheet.parts.filter(function (x) { return x.id !== b.dataset.id; }); save(); render(); return; }
    if (a === 'toggle') { openIds[b.dataset.id] = !openIds[b.dataset.id]; render(); return; }
    if (a === 'addcat') { var n = document.getElementById('wbNewCat'), v = n ? n.value.trim() : ''; if (v && sheet.cats.map(function (c) { return c.toLowerCase(); }).indexOf(v.toLowerCase()) < 0) { sheet.cats.push(v.slice(0, 40)); save(); } render(); return; }
    if (a === 'delcat') { sheet.cats = sheet.cats.filter(function (c) { return c !== b.dataset.cat; }); save(); render(); return; }
    if (a === 'csv') { download(fname('csv'), W.toCSV(sheet), 'text/csv;charset=utf-8'); return; }
    if (a === 'template') { download('weight-budget-template.csv', W.templateCSV(), 'text/csv;charset=utf-8'); return; }
    if (a === 'xlsx') { var bt = bot(); download(fname('xlsx'), new Blob([W.toXLSX(sheet, { robot: bt ? bt.name : '', date: new Date().toISOString().slice(0, 10) })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); return; }
    if (a === 'json') {
      var out = { app: 'too-hot-to-handle-statistics-hub', kind: 'weight-budget', version: 1, exportedAt: new Date().toISOString(), robots: {} }, names = {};
      (window.BOTS || []).forEach(function (x) { names[x.id] = x.name; });
      for (var k = 0; k < localStorage.length; k++) { var key = localStorage.key(k); if (key && key.indexOf(KEY) === 0) { try { out.robots[key.slice(KEY.length)] = { name: names[key.slice(KEY.length)] || key.slice(KEY.length), sheet: JSON.parse(localStorage.getItem(key)) }; } catch (er) {} } }
      if (!out.robots[botId]) out.robots[botId] = { name: names[botId] || botId, sheet: sheet };
      download('too-hot-statistics-hub-weight-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(out, null, 1), 'application/json'); return;
    }
    if (a === 'clear') { if (!armClear) { armClear = true; render(); return; } armClear = false; sheet.parts = []; save(); render(); return; }
    if (a === 'impcancel') { pending = null; render(); return; }
    if (a === 'impappend' || a === 'impreplace') {
      var r = pending.res; if (a === 'impreplace') sheet.parts = []; r.newCats.forEach(function (c) { if (sheet.cats.indexOf(c) < 0) sheet.cats.push(c); });
      sheet.parts = sheet.parts.concat(r.parts); pending = null; save(); render(); return;
    }
    if (a === 'jsonok') { Object.keys(pending.robots).forEach(function (id) { try { localStorage.setItem(KEY + id, JSON.stringify(pending.robots[id].sheet)); } catch (er) {} }); pending = null; render(); return; }
  }
  function onFile(e) {
    var t = e.target; if (!t.dataset || !t.dataset.wf || !t.files || !t.files[0]) return;
    var f = t.files[0], kind = t.dataset.wf; t.value = '';
    var fail = function (msg) { pending = { kind: 'error', msg: msg }; render(); };
    if (kind === 'json') {
      f.text().then(function (txt) {
        var d = JSON.parse(txt);
        if (!d || d.kind !== 'weight-budget' || !d.robots || typeof d.robots !== 'object') throw new Error('This is not a Too Hot to Handle Statistics Hub weight backup.');
        var robots = {}, names = [];
        Object.keys(d.robots).forEach(function (id) { var r = d.robots[id]; if (r && r.sheet && Array.isArray(r.sheet.parts)) { robots[id] = r; names.push((r.name || id) + ' (' + r.sheet.parts.length + ' parts)'); } });
        if (!names.length) throw new Error('The backup has no robot sheets.');
        pending = { kind: 'json', file: f.name, robots: robots, names: names }; render();
      }).catch(function (er) { fail(er.message || 'Could not read the backup.'); });
      return;
    }
    var isX = /\.xlsx$/i.test(f.name);
    (isX ? f.arrayBuffer().then(W.readXLSX) : f.text().then(W.parseCSV)).then(function (rows) {
      var res = W.rowsToParts(rows, sheet.cats);
      if (!res.parts.length) throw new Error('No part rows found in ' + f.name + '. ' + res.warnings.join(' '));
      pending = { kind: 'sheet', file: f.name, res: res }; render();
    }).catch(function (er) { fail((er && er.message) || 'Could not read the file.' + (isX ? ' Try saving it as CSV.' : '')); });
  }
  // Mounted by calcs.js as the "weight" calculator (inside #view-calc). Listeners are bound once per host element; the
  // robot switcher calls Calcs.rerender() -> WeightView.rerender() so the sheet follows the current robot.
  var bound = [];
  function shown() { return !!(root && root.querySelector('.wbhead')); }
  window.WeightView = {
    mount: function (el) {
      if (bound.indexOf(el) < 0) {
        bound.push(el);
        el.addEventListener('input', function (e) { if (root === el && shown()) onInput(e); });
        el.addEventListener('change', function (e) { if (root !== el || !shown()) return; if (e.target.dataset && e.target.dataset.wf) onFile(e); else onInput(e); });
        el.addEventListener('click', function (e) { if (root === el && shown()) onClick(e); });
      }
      root = el; pending = pending && pending.kind !== 'error' ? pending : null; render();
    },
    rerender: function () { pending = null; openIds = {}; armClear = false; if (shown()) render(); }
  };
  window.matchMedia('(min-width:900px)').addEventListener('change', function () { if (shown()) render(); else lastWide = null; });
})();
