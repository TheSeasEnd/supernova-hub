/* Weight budget math + file formats (no UI). Browser: window.WeightMath. Node: module.exports (tests in tools/test_weightmath.js).
   Weights are stored in grams. Class rules: NHRL Open Rules 2026 (sources in RULES below). Filament densities: manufacturer data sheets. */
(function (root) {
  'use strict';
  var G_PER_LB = 453.59237, G_PER_OZ = 28.349523125; // exact definitions (international avoirdupois pound/ounce)
  var RULES_URL = 'https://wiki.nhrl.io/wiki/index.php?title=NHRL_Open_Rules_-_2026';
  var RULES = {
    source: 'NHRL Open Rules 2026 (NHRL wiki), "Weight Requirements", "Multibot Weight Bonuses", "Weight Exemptions" and "Pre-Fight Weight Checks"',
    url: RULES_URL, checked: 'Oct 28, 2026 (page last edited Sep 28, 2026)',
    classes: { 3: { base: 3, ntl: 1.5, walker: 3, multi: { 2: 2, 3: 1.33, 4: 1 } },
               12: { base: 12, ntl: 6, walker: 12, multi: { 2: 8, 3: 5.33, 4: 4 } },
               30: { base: 30, ntl: 15, walker: 30, multi: { 2: 20, 3: 13.33, 4: 10 } } },
    overweightOz: 2.5 // up to 2.5 oz over: 1 TKO point (fight allowed if weight is fixed quickly); more than 2.5 oz over: 3 TKO points, immediate TKO
  };
  // Locomotion categories and examples, word for word from the 2026 rules ("Non-Traditional Locomotion Definition", "True Walker Definition").
  var LOCO = [
    { id: 'traditional', kind: 'traditional', name: 'Traditional (wheels, treads/tracks, belts)', rule: 'Traditional Motion Systems use rotational motion of ground-contact components: all wheel forms (round, non-circular, spoked, offset axis), continuous treads, tracks, belt-driven systems, and vertical or near-vertical spinning shafts. No bonus.' },
    { id: 'shuffler', kind: 'ntl', name: 'Shuffler (non-traditional)' },
    { id: 'bristle', kind: 'ntl', name: 'Bristle bot (non-traditional)' },
    { id: 'flying', kind: 'ntl', name: 'Flying system (non-traditional)' },
    { id: 'gyro', kind: 'ntl', name: 'Gyroscopic precession (non-traditional)' },
    { id: 'torque', kind: 'ntl', name: 'Torque reaction (non-traditional)' },
    { id: 'jansen', kind: 'ntl', name: 'Jansen linkage (non-traditional)' },
    { id: 'hover', kind: 'ntl', name: 'Hovercraft (non-traditional)' },
    { id: 'ntl-other', kind: 'ntl', name: 'Other non-traditional locomotion' },
    { id: 'walker', kind: 'walker', name: 'True walker (legs; NHRL pre-approval)' }
  ];
  var MULTI = [[1, 'Single robot / no multibot bonus'], [2, 'Multibot bonus, 2 segments'], [3, 'Multibot bonus, 3 segments'], [4, 'Multibot bonus, 4 segments']];
  function loco(id) { for (var i = 0; i < LOCO.length; i++) if (LOCO[i].id === id) return LOCO[i]; return LOCO[0]; }

  // Densities (g/cm³) from the manufacturers' technical data sheets (ISO 1183). Other brands of the same polymer differ.
  var MATERIALS = [
    { id: 'pla', name: 'PLA', d: 1.24, src: 'Bambu Lab PLA Basic TDS', url: 'https://files.bbystatic.com/G8TU2klvsR6MVeDE4zgPkw%3D%3D/Bambu%2BFilament%2B-Technical%2BData%2BSheet' },
    { id: 'petg', name: 'PETG', d: 1.25, src: 'Bambu Lab PETG Basic TDS', url: 'https://c.cdnmp.net/712781591/content/Bambu_PETG_Basic_Technical_Data_Sheet.pdf' },
    { id: 'abs', name: 'ABS', d: 1.05, src: 'Bambu Lab ABS TDS', url: 'https://wiki.bambulab.com/filament-acc/abs-asa-pc/bambu_abs_technical_data_sheet_v3.pdf' },
    { id: 'asa', name: 'ASA', d: 1.05, src: 'Bambu Lab ASA TDS', url: 'https://wiki.bambulab.com/filament-acc/abs-asa-pc/6eaf4c432d1d4014a1975e55a55ed00b.pdf' },
    { id: 'nylon', name: 'Nylon (CoPA)', d: 1.12, src: 'Polymaker PolyMide CoPA TDS v5.5', url: 'https://polymaker.com/wp-content/uploads/lana-downloads/TDS_Polymaker_PolyMide-CoPA_V5.5_2026-01-06_EN.pdf' },
    { id: 'pa6cf', name: 'CF-nylon (PA6-CF)', d: 1.09, src: 'Bambu Lab PA6-CF TDS', url: 'https://store.bblcdn.eu/s8/default/a64af9edb0f64095ad18bc4ad4faf1ec/Bambu_PA6-CF_Technical_Data_Sheet-v2.pdf' },
    { id: 'pahtcf', name: 'PAHT-CF (CF nylon)', d: 1.06, src: 'Bambu Lab PAHT-CF TDS', url: 'https://store.bblcdn.eu/s8/default/91dea87af3414d878a0696d2c51b98f7/Bambu_PAHT-CF_Technical_Data_Sheet_V2.pdf' },
    { id: 'pa6gf', name: 'GF nylon (PA6-GF)', d: 1.14, src: 'Bambu Lab PA6-GF TDS', url: 'https://wiki.bambulab.com/filament-acc/absgf-pa6gf/bambu_pa6-gf_technical_data_sheet.pdf' },
    { id: 'tpu', name: 'TPU 95A', d: 1.22, src: 'Bambu Lab TPU 95A HF TDS', url: 'https://store.bblcdn.eu/s8/default/16df21baf482453999b3dbb61cc110e7/Bambu_TPU_95A_HF_Technical_Data_Sheet.pdf' },
    { id: 'other', name: 'Other (enter density)', d: null, src: null, url: null }
  ];
  var CATS = ['Weapon', 'Drive', 'Electronics', 'Battery', 'Armor/Chassis', 'Fasteners/Hardware', 'Other'];
  var SOURCES = ['measured', 'estimated', 'CAD', 'datasheet'];

  function num(v) { if (v === '' || v == null) return NaN; var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '.').replace(/[^0-9.+\-eE]/g, '')); return isFinite(n) ? n : NaN; }
  function toG(v, unit) { var n = num(v); if (!isFinite(n)) return NaN; return unit === 'lb' ? n * G_PER_LB : unit === 'oz' ? n * G_PER_OZ : unit === 'kg' ? n * 1000 : n; }
  function fromG(g, unit) { return unit === 'lb' ? g / G_PER_LB : unit === 'oz' ? g / G_PER_OZ : unit === 'kg' ? g / 1000 : g; }
  function fmtW(g, unit) { if (!isFinite(g)) return '—'; var v = fromG(g, unit); var d = unit === 'g' ? (Math.abs(v) < 100 ? 1 : 0) : unit === 'oz' ? 2 : 3; return v.toFixed(d) + ' ' + unit; }
  function material(id) { for (var i = 0; i < MATERIALS.length; i++) if (MATERIALS[i].id === id) return MATERIALS[i]; return null; }
  var uid = 0;
  function newId() { uid++; return 'p' + Date.now().toString(36) + uid.toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function newPart(cat) {
    return { id: newId(), name: '', cat: cat || 'Other', qty: 1, unitG: '', source: 'estimated', notes: '', seg: 1, exempt: false, exemptWhy: '',
      print: false, mat: 'pla', density: '', infill: '', walls: '', layer: '', slicerG: '', measuredG: '', volCm3: '' };
  }
  var WARN_DEFAULT = 5;
  function newSheet(cls) { return { v: 2, cls: cls ? String(cls) : '', loco: 'traditional', multi: 1, override: '', warnPct: WARN_DEFAULT, warnCustom: false, unit: 'g', cats: CATS.slice(), parts: [] }; }

  // Saved sheets from v23 (v:1) stored the old 3% default with no way to tell it apart from a typed 3, so v1 sheets at 3 (or blank) move to the new default;
  // any other value counts as customized. From v2 on, editing the field sets warnCustom.
  function migrate(s) {
    if (!s || typeof s !== 'object') return s;
    if (!(s.v >= 2)) { var w = num(s.warnPct); if (!isFinite(w) || w === 3) { s.warnPct = WARN_DEFAULT; s.warnCustom = false; } else s.warnCustom = true; s.v = 2; }
    else if (!s.warnCustom) s.warnPct = WARN_DEFAULT;
    return s;
  }
  // Weight of ONE unit of a part, in grams: printed parts use measured grams, then the slicer estimate, then the typed unit weight.
  function unitWeight(p) {
    if (p.print) { var m = num(p.measuredG), s = num(p.slicerG); if (isFinite(m)) return { g: m, from: 'measured print' }; if (isFinite(s)) return { g: s, from: 'slicer estimate' }; }
    var u = num(p.unitG); return { g: isFinite(u) ? u : NaN, from: 'unit weight' };
  }
  function qtyOf(p) { var q = num(p.qty); return isFinite(q) && q >= 0 ? q : 1; }
  function partTotal(p) { var u = unitWeight(p).g; return isFinite(u) ? u * qtyOf(p) : 0; }
  function printInfo(p) {
    var m = material(p.mat), d = p.mat === 'other' || !m ? num(p.density) : m.d, s = num(p.slicerG), me = num(p.measuredG), vol = num(p.volCm3);
    var r = { density: isFinite(d) ? d : NaN, sourced: !!(m && m.d && p.mat !== 'other'), solidG: isFinite(vol) && isFinite(d) ? vol * d : NaN, deltaG: NaN, deltaPct: NaN };
    if (isFinite(s) && isFinite(me)) { r.deltaG = me - s; r.deltaPct = s ? (me - s) / s * 100 : NaN; }
    return r;
  }

  // Class limit in grams for one sheet (whole entry, or per segment for multibots using the bonus).
  // The rules: locomotion and multibot bonuses cannot be combined (choose one); when both are picked we flag it and apply neither until fixed.
  function limitOf(sheet) {
    var ov = num(sheet.override), c = RULES.classes[sheet.cls], L = loco(sheet.loco), segs = Math.min(4, Math.max(1, parseInt(sheet.multi, 10) || 1));
    var r = { lb: NaN, segLb: NaN, segs: segs, label: '', overridden: false, verified: false, loco: L, conflict: false, bonusLb: 0 };
    if (c) {
      r.verified = true;
      if (L.kind !== 'traditional' && segs > 1) { r.conflict = true; r.segs = 1; r.lb = c.base; r.label = sheet.cls + 'lb class limit (bonus not applied: locomotion and multibot bonuses cannot be combined)'; }
      else if (L.kind === 'ntl') { r.bonusLb = c.ntl; r.lb = c.base + c.ntl; r.label = sheet.cls + 'lb + ' + c.ntl + 'lb non-traditional locomotion bonus'; }
      else if (L.kind === 'walker') { r.bonusLb = c.walker; r.lb = c.base + c.walker; r.label = sheet.cls + 'lb + ' + c.walker + 'lb true walker bonus'; }
      else if (segs > 1) { r.segLb = c.multi[segs]; r.lb = c.multi[segs] * segs; r.label = sheet.cls + 'lb multibot bonus: ' + segs + ' segments, ' + c.multi[segs] + 'lb max each'; }
      else { r.lb = c.base; r.label = sheet.cls + 'lb class limit'; }
    }
    if (isFinite(ov) && ov > 0) { r.lb = ov; r.overridden = true; r.verified = false; r.label = 'Custom limit (override)'; r.segLb = r.segs > 1 ? ov / r.segs : NaN; }
    r.g = r.lb * G_PER_LB; r.segG = r.segLb * G_PER_LB;
    return r;
  }
  function status(totalG, limitG, warnPct) {
    if (!isFinite(limitG) || limitG <= 0) return { level: 'unk', label: 'No limit set' };
    var w = num(warnPct); if (!isFinite(w) || w < 0) w = WARN_DEFAULT;
    var over = totalG - limitG;
    if (over > 0) { var tko = over <= RULES.overweightOz * G_PER_OZ + 1e-9 ? 'up to 2.5 oz over: 1 TKO point at the pre-fight weigh-in' : 'more than 2.5 oz over: 3 TKO points, immediate TKO'; return { level: 'over', label: 'OVER', note: tko }; }
    if (totalG >= limitG * (1 - w / 100)) return { level: 'warn', label: 'CLOSE', note: 'within ' + w + '% of the limit' };
    return { level: 'pass', label: 'OK' };
  }
  function summary(sheet) {
    var lim = limitOf(sheet), byCat = {}, order = [], total = 0, exempt = 0, segs = {}, printed = { est: 0, meas: 0, both: 0, n: 0 }, unweighed = 0;
    (sheet.cats || CATS).forEach(function (c) { byCat[c] = { g: 0, n: 0 }; order.push(c); });
    sheet.parts.forEach(function (p) {
      var c = p.cat || 'Other'; if (!byCat[c]) { byCat[c] = { g: 0, n: 0 }; order.push(c); }
      var t = partTotal(p); byCat[c].n++;
      if (!isFinite(unitWeight(p).g)) unweighed++;
      if (p.exempt) { exempt += t; return; }
      byCat[c].g += t; total += t;
      var s = lim.segs > 1 ? Math.min(Math.max(1, parseInt(p.seg, 10) || 1), lim.segs) : 1; segs[s] = (segs[s] || 0) + t;
      if (p.print) { var pi = printInfo(p); printed.n++; if (isFinite(pi.deltaG)) { printed.both++; printed.est += num(p.slicerG) * qtyOf(p); printed.meas += num(p.measuredG) * qtyOf(p); } }
    });
    var st = status(total, lim.g, sheet.warnPct), segSt = [];
    if (lim.segs > 1) for (var i = 1; i <= lim.segs; i++) segSt.push({ seg: i, g: segs[i] || 0, status: status(segs[i] || 0, lim.segG, sheet.warnPct) });
    var weapon = byCat.Weapon ? byCat.Weapon.g : 0;
    return { total: total, exempt: exempt, limit: lim, remaining: lim.g - total, pct: lim.g > 0 ? total / lim.g * 100 : NaN, status: st, byCat: byCat, order: order, segs: segSt,
      printed: printed, unweighed: unweighed, weaponPct: lim.g > 0 ? weapon / lim.g * 100 : NaN };
  }

  /* ---------- CSV ---------- */
  var COLS = [
    ['cat', 'Category'], ['name', 'Part'], ['qty', 'Qty'], ['unitG', 'Unit weight (g)'], ['totalG', 'Total (g)'], ['source', 'Weight source'], ['notes', 'Notes'],
    ['print', '3D print'], ['mat', 'Material'], ['density', 'Density (g/cm3)'], ['infill', 'Infill %'], ['walls', 'Walls'], ['layer', 'Layer height (mm)'],
    ['slicerG', 'Slicer estimate (g)'], ['measuredG', 'Measured after print (g)'], ['volCm3', 'Model volume (cm3)'], ['exempt', 'Exempt from weigh-in'], ['exemptWhy', 'Exempt reason'], ['seg', 'Segment']];
  function csvCell(v) { v = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(v) && !/^-?\d/.test(v)) v = "'" + v; return /[",\r\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function round(n, d) { return isFinite(n) ? +n.toFixed(d) : ''; }
  function partRow(p) {
    var m = material(p.mat), u = unitWeight(p).g;
    return { cat: p.cat, name: p.name, qty: qtyOf(p), unitG: round(u, 2), totalG: round(isFinite(u) ? u * qtyOf(p) : NaN, 2), source: p.source, notes: p.notes,
      print: p.print ? 'yes' : '', mat: p.print ? (m && m.id !== 'other' ? m.name : 'Other') : '', density: p.print ? round(printInfo(p).density, 3) : '',
      infill: p.print ? p.infill : '', walls: p.print ? p.walls : '', layer: p.print ? p.layer : '', slicerG: p.print ? p.slicerG : '', measuredG: p.print ? p.measuredG : '', volCm3: p.print ? p.volCm3 : '',
      exempt: p.exempt ? 'yes' : '', exemptWhy: p.exempt ? p.exemptWhy : '', seg: p.seg && +p.seg > 1 ? p.seg : '' };
  }
  function sortedParts(sheet) {
    var order = (sheet.cats || CATS).slice();
    sheet.parts.forEach(function (p) { if (order.indexOf(p.cat) < 0) order.push(p.cat); });
    return sheet.parts.map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) { return order.indexOf(a.p.cat) - order.indexOf(b.p.cat) || a.i - b.i; }).map(function (x) { return x.p; });
  }
  function toCSV(sheet) {
    var lines = [COLS.map(function (c) { return csvCell(c[1]); }).join(',')];
    sortedParts(sheet).forEach(function (p) { var r = partRow(p); lines.push(COLS.map(function (c) { return csvCell(r[c[0]]); }).join(',')); });
    return '\ufeff' + lines.join('\r\n') + '\r\n';
  }
  function templateCSV() {
    var s = newSheet(''), a = newPart('Drive'); a.name = 'Example: drive motor'; a.qty = 2; a.unitG = 30; a.source = 'datasheet'; a.notes = 'delete these example rows';
    var b = newPart('Armor/Chassis'); b.name = 'Example: printed chassis'; b.print = true; b.mat = 'pahtcf'; b.infill = 40; b.walls = 4; b.layer = 0.2; b.slicerG = 210; b.source = 'estimated';
    s.parts = [a, b]; return toCSV(s);
  }
  function parseCSV(text) {
    text = String(text).replace(/^\ufeff/, '');
    var first = text.split(/\r?\n/)[0] || '', cand = [',', ';', '\t'], delim = ',', best = -1;
    cand.forEach(function (d) { var n = first.split(d).length; if (n > best) { best = n; delim = d; } });
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }
  // Tolerant header matching: lower-case, drop punctuation, accept common synonyms; unit weight columns may be g, oz, lb or kg.
  function norm(h) { return String(h || '').toLowerCase().replace(/\u00b3/g, '3').replace(/[^a-z0-9%]+/g, ' ').trim(); }
  function unitIn(h) { var n = ' ' + norm(h) + ' '; return / (lbs?|pounds?) /.test(n) ? 'lb' : / (oz|ounces?) /.test(n) ? 'oz' : / (kg|kilograms?) /.test(n) ? 'kg' : / (g|grams?|gr) /.test(n) ? 'g' : null; }
  var SYN = {
    name: /^(part|parts|name|part name|item|component|description|desc|thing)$/,
    cat: /^(category|cat|group|type|system|subsystem|section)$/,
    qty: /^(qty|quantity|count|number|num|no|n|pcs|pieces|x|units|amount)$/,
    unitW: /^(unit weight|unit mass|weight each|mass each|each|weight per unit|weight per part|unit|weight|mass|per unit|weight per)$/,
    totalW: /^(total|total weight|total mass|line total|subtotal|weight total|extended weight|sum)$/,
    source: /^(weight source|source|basis|how measured|method|confidence)$/,
    notes: /^(notes|note|comments|comment|remarks)$/,
    print: /^(3d print|3d printed|printed|print|is printed|3dp)$/,
    mat: /^(material|filament|mat)$/,
    density: /^(density|density g cm3|g cm3)$/,
    infill: /^(infill|infill %|infill percent|infill pct)$/,
    walls: /^(walls|wall count|wall loops|perimeters|shells|wall)$/,
    layer: /^(layer height|layer|layer mm|layer height mm)$/,
    slicerG: /^(slicer estimate|slicer|slicer weight|estimated print weight|slicer est|print estimate|estimated g|est)$/,
    measuredG: /^(measured after print|measured|actual|actual weight|measured weight|printed weight|actual print weight)$/,
    volCm3: /^(model volume|volume|volume cm3|vol)$/,
    exempt: /^(exempt from weigh in|exempt|excluded|not weighed|exempt weight)$/,
    exemptWhy: /^(exempt reason|exemption|exemption reason|reason)$/,
    seg: /^(segment|seg|multibot segment)$/
  };
  function headerKey(h) {
    var n = norm(h).replace(/\b(in )?(g|grams?|gr|oz|ounces?|lbs?|pounds?|kg|kilograms?)\b/g, ' ').replace(/\s+/g, ' ').trim();
    for (var k in SYN) if (SYN[k].test(n)) return k;
    return null;
  }
  function yes(v) { return /^(y|yes|true|1|x|✓|✔)$/i.test(String(v == null ? '' : v).trim()); }
  function matchMaterial(v) {
    var n = norm(v); if (!n) return null;
    if (/paht/.test(n)) return 'pahtcf'; if (/(pa|nylon).*(gf|glass)|gf.*(pa|nylon)/.test(n)) return 'pa6gf'; if (/(pa|nylon).*(cf|carbon)|cf.*(pa|nylon)|onyx/.test(n)) return 'pa6cf';
    if (/nylon|^pa|copa|polyamide/.test(n)) return 'nylon'; if (/petg|pet g/.test(n)) return 'petg'; if (/^asa/.test(n)) return 'asa'; if (/^abs/.test(n)) return 'abs'; if (/tpu|flex/.test(n)) return 'tpu'; if (/^pla/.test(n)) return 'pla';
    return 'other';
  }
  function rowsToParts(rows, cats) {
    var res = { parts: [], warnings: [], newCats: [], mapped: {} };
    if (!rows.length) { res.warnings.push('The file is empty.'); return res; }
    var head = rows[0], map = {}, unitOf = {};
    head.forEach(function (h, i) { var k = headerKey(h); if (k && map[k] == null) { map[k] = i; unitOf[k] = unitIn(h); } });
    if (map.unitW == null && map.totalW == null) res.warnings.push('No weight column found (looked for "Unit weight", "Weight", "Each", "Mass" or "Total"). Parts were imported without weights.');
    if (map.name == null) res.warnings.push('No part-name column found (looked for "Part", "Name", "Item", "Component"). Rows were named "Part N".');
    Object.keys(map).forEach(function (k) { res.mapped[k] = head[map[k]]; });
    var known = (cats || CATS).map(function (c) { return c.toLowerCase(); });
    function get(r, k) { return map[k] == null ? '' : (r[map[k]] == null ? '' : String(r[map[k]]).trim()); }
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i], p = newPart('Other'), name = get(r, 'name');
      if (/^(total|grand total|sum|subtotal)/i.test(name) && !get(r, 'qty')) continue; // skip total rows from other spreadsheets
      p.name = name || 'Part ' + i;
      var cat = get(r, 'cat');
      if (cat) { var ci = known.indexOf(cat.toLowerCase()); if (ci >= 0) p.cat = (cats || CATS)[ci]; else { p.cat = cat; if (res.newCats.indexOf(cat) < 0) res.newCats.push(cat); } }
      var q = num(get(r, 'qty')); p.qty = isFinite(q) && q >= 0 ? q : 1;
      var uw = toG(get(r, 'unitW'), unitOf.unitW || 'g'), tw = toG(get(r, 'totalW'), unitOf.totalW || unitOf.unitW || 'g');
      if (isFinite(uw)) p.unitG = +uw.toFixed(3); else if (isFinite(tw) && p.qty > 0) p.unitG = +(tw / p.qty).toFixed(3);
      var s = get(r, 'source').toLowerCase(); p.source = /meas|scale|weigh/.test(s) ? 'measured' : /cad|model/.test(s) ? 'CAD' : /data|spec|sheet|vendor|listing/.test(s) ? 'datasheet' : 'estimated';
      p.notes = get(r, 'notes');
      p.print = yes(get(r, 'print'));
      var mat = matchMaterial(get(r, 'mat')); if (mat) { p.mat = mat; if (map.print == null) p.print = true; }
      if (mat === 'other') p.density = get(r, 'density');
      ['infill', 'walls', 'layer', 'slicerG', 'measuredG', 'volCm3'].forEach(function (k) { var v = num(get(r, k)); if (isFinite(v)) p[k] = v; });
      if (p.print && !isFinite(num(p.unitG)) === false && !isFinite(num(p.slicerG)) && !isFinite(num(p.measuredG))) { /* keep typed unit weight */ }
      p.exempt = yes(get(r, 'exempt')); p.exemptWhy = get(r, 'exemptWhy');
      var sg = parseInt(get(r, 'seg'), 10); p.seg = sg > 0 ? sg : 1;
      res.parts.push(p);
    }
    return res;
  }

  /* ---------- XLSX (minimal writer + reader; stored zip, no dependencies) ---------- */
  var CRC = null;
  function crc32(b) { if (!CRC) { CRC = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } } var x = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) x = CRC[(x ^ b[i]) & 255] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { return new TextEncoder().encode(s); }
  function zip(files) { // files: [{name, data:Uint8Array}] -> Uint8Array (STORE method)
    var parts = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; } function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var nm = utf8(f.name), c = crc32(f.data), sz = f.data.length;
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(sz), u32(sz), u16(nm.length), u16(0));
      parts.push(new Uint8Array(lh), nm, f.data);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(sz), u32(sz), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), nm);
      off += lh.length + nm.length + sz;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(off), u16(0)));
    var all = parts.concat(central, [end]), len = all.reduce(function (a, b) { return a + b.length; }, 0), out = new Uint8Array(len), p = 0;
    all.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }
  function xesc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''); }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function sheetXml(rows, widths) { // rows: arrays of {v, f?, s?}
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    if (widths) x += '<cols>' + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    x += '<sheetData>';
    rows.forEach(function (r, ri) {
      x += '<row r="' + (ri + 1) + '">';
      r.forEach(function (c, ci) {
        if (c == null || (c.v === '' && !c.f)) return; var ref = colName(ci) + (ri + 1), st = c.s ? ' s="' + c.s + '"' : '';
        if (c.f) x += '<c r="' + ref + '"' + st + '><f>' + xesc(c.f) + '</f>' + (isFinite(c.v) && c.v !== '' ? '<v>' + c.v + '</v>' : '') + '</c>';
        else if (typeof c.v === 'number' && isFinite(c.v)) x += '<c r="' + ref + '"' + st + '><v>' + c.v + '</v></c>';
        else x += '<c r="' + ref + '" t="inlineStr"' + st + '><is><t xml:space="preserve">' + xesc(c.v) + '</t></is></c>';
      });
      x += '</row>';
    });
    return x + '</sheetData></worksheet>';
  }
  function toXLSX(sheet, meta) {
    meta = meta || {};
    var parts = sortedParts(sheet), H = COLS.map(function (c) { return { v: c[1], s: 1 }; }), rows = [H];
    var iQ = 2, iU = 3; // columns C (qty) and D (unit weight)
    parts.forEach(function (p, k) {
      var r = partRow(p), rn = k + 2;
      rows.push(COLS.map(function (c, ci) {
        var v = r[c[0]]; if (c[0] === 'totalG') return { v: v, f: colName(iQ) + rn + '*' + colName(iU) + rn, s: 2 };
        if (typeof v === 'number') return { v: v, s: ci === iU ? 2 : 0 };
        var n = num(v); return /^(qty|density|infill|walls|layer|slicerG|measuredG|volCm3|seg)$/.test(c[0]) && isFinite(n) ? { v: n } : { v: v == null ? '' : String(v) };
      }));
    });
    var s = summary(sheet), lastRow = parts.length + 1;
    var S = [[{ v: 'Robot', s: 1 }, { v: meta.robot || '' }], [{ v: 'Exported', s: 1 }, { v: meta.date || '' }], [{ v: 'Limit', s: 1 }, { v: s.limit.label || 'No limit set' }],
      [{ v: 'Limit (g)', s: 1 }, isFinite(s.limit.g) ? { v: +s.limit.g.toFixed(2), s: 2 } : { v: '' }], [{ v: 'Limit (lb)', s: 1 }, isFinite(s.limit.lb) ? { v: s.limit.lb } : { v: '' }],
      [{ v: 'Counted total (g)', s: 1 }, { v: +s.total.toFixed(2), f: 'SUMIFS(Parts!E2:E' + Math.max(2, lastRow) + ',Parts!Q2:Q' + Math.max(2, lastRow) + ',"<>yes")', s: 2 }],
      [{ v: 'Remaining (g)', s: 1 }, isFinite(s.limit.g) ? { v: +(s.limit.g - s.total).toFixed(2), f: 'B4-B6', s: 2 } : { v: '' }],
      [{ v: 'Exempt, not counted (g)', s: 1 }, { v: +s.exempt.toFixed(2), s: 2 }], [{ v: 'Warn within %', s: 1 }, { v: num(sheet.warnPct) }], [{ v: 'Rules source', s: 1 }, { v: RULES.url }], [{ v: 'Locomotion', s: 1 }, { v: s.limit.loco.name }], [{ v: 'Multibot segments', s: 1 }, { v: s.limit.segs }], [], [{ v: 'Category', s: 1 }, { v: 'Subtotal (g)', s: 1 }]];
    s.order.forEach(function (c) { if (s.byCat[c].n) S.push([{ v: c }, { v: +s.byCat[c].g.toFixed(2), s: 2 }]); });
    var enc = function (t) { return utf8(t); };
    var files = [
      { name: '[Content_Types].xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>') },
      { name: '_rels/.rels', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
      { name: 'xl/workbook.xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Parts" sheetId="1" r:id="rId1"/><sheet name="Summary" sheetId="2" r:id="rId2"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>') },
      { name: 'xl/_rels/workbook.xml.rels', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
      { name: 'xl/styles.xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>') },
      { name: 'xl/worksheets/sheet1.xml', data: enc(sheetXml(rows, [18, 28, 6, 15, 11, 14, 28, 8, 18, 14, 8, 7, 16, 18, 22, 18, 18, 18, 9])) },
      { name: 'xl/worksheets/sheet2.xml', data: enc(sheetXml(S, [24, 48])) }
    ];
    return zip(files);
  }
  function unzip(buf) { // -> Promise<{name: Uint8Array}>; handles stored and deflated entries (deflate via DecompressionStream)
    var b = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength), e = -1;
    for (var i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) return Promise.reject(new Error('Not a zip/xlsx file'));
    var n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true), out = {}, jobs = [], dec = new TextDecoder();
    for (var k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      var name = dec.decode(b.subarray(p + 46, p + 46 + nl));
      var ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), data = b.subarray(ds, ds + csize);
      (function (name, method, data) {
        if (method === 0) out[name] = data;
        else if (method === 8) {
          if (typeof DecompressionStream === 'undefined') { jobs.push(Promise.reject(new Error('This browser cannot open compressed .xlsx files. Save as CSV and import that.'))); return; }
          jobs.push(new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then(function (ab) { out[name] = new Uint8Array(ab); }));
        }
      })(name, method, data);
      p += 46 + nl + xl + cl;
    }
    return Promise.all(jobs).then(function () { return out; });
  }
  function xmlText(s) { return s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(+d); }).replace(/&amp;/g, '&'); }
  function colIndex(ref) { var m = /^([A-Z]+)/.exec(ref), n = 0; if (!m) return -1; for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64); return n - 1; }
  function readXLSX(buf) { // -> Promise<rows (first worksheet)>
    return unzip(buf).then(function (f) {
      var dec = new TextDecoder(), txt = function (n) { return f[n] ? dec.decode(f[n]) : ''; };
      var wb = txt('xl/workbook.xml'), rels = txt('xl/_rels/workbook.xml.rels'), target = 'xl/worksheets/sheet1.xml';
      var m = /<sheet\b[^>]*r:id="([^"]+)"/.exec(wb);
      if (m) { var re = new RegExp('<Relationship\\b[^>]*Id="' + m[1] + '"[^>]*>'), rm = re.exec(rels); if (rm) { var t = /Target="([^"]+)"/.exec(rm[0]); if (t) target = t[1].charAt(0) === '/' ? t[1].slice(1) : 'xl/' + t[1].replace(/^\.\//, ''); } }
      var ss = [], sst = txt('xl/sharedStrings.xml');
      (sst.match(/<si>[\s\S]*?<\/si>/g) || []).forEach(function (si) { ss.push(xmlText((si.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || []).join(''))); });
      var sx = txt(target); if (!sx) throw new Error('No worksheet found in the file.');
      var rows = [];
      (sx.match(/<row\b[\s\S]*?<\/row>|<row\b[^>]*\/>/g) || []).forEach(function (rx) {
        var r = [];
        (rx.match(/<c\b[^>]*\/>|<c\b[\s\S]*?<\/c>/g) || []).forEach(function (cx) {
          var ref = (/\br="([A-Z]+\d+)"/.exec(cx) || [])[1], t = (/\bt="([^"]+)"/.exec(cx) || [])[1], v = (/<v>([\s\S]*?)<\/v>/.exec(cx) || [])[1], val = '';
          if (t === 's') val = ss[+v] || ''; else if (t === 'inlineStr') val = xmlText((cx.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || []).join('')); else if (v != null) val = xmlText(v);
          var ci = ref ? colIndex(ref) : r.length; while (r.length < ci) r.push(''); r[ci] = val;
        });
        rows.push(r);
      });
      return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
    });
  }

  var api = { G_PER_LB: G_PER_LB, G_PER_OZ: G_PER_OZ, RULES: RULES, WARN_DEFAULT: WARN_DEFAULT, migrate: migrate, LOCO: LOCO, MULTI: MULTI, loco: loco, MATERIALS: MATERIALS, CATS: CATS, SOURCES: SOURCES, COLS: COLS,
    num: num, toG: toG, fromG: fromG, fmtW: fmtW, material: material, newPart: newPart, newSheet: newSheet, unitWeight: unitWeight, qtyOf: qtyOf, partTotal: partTotal, printInfo: printInfo,
    limitOf: limitOf, status: status, summary: summary, sortedParts: sortedParts, toCSV: toCSV, templateCSV: templateCSV, parseCSV: parseCSV, headerKey: headerKey, rowsToParts: rowsToParts,
    crc32: crc32, zip: zip, unzip: unzip, toXLSX: toXLSX, readXLSX: readXLSX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WeightMath = api;
})(typeof window !== 'undefined' ? window : this);
