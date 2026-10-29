// node tools/test_weightmath.js — checks for weightmath.js (limits from NHRL Open Rules 2026, totals, CSV/XLSX round trips)
const W = require('../weightmath.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('FAIL', m); } }
function near(a, b, m, t) { ok(Math.abs(a - b) <= (t || 1e-6), m + ' (got ' + a + ', want ' + b + ')'); }
(async () => {
  const LB = W.G_PER_LB;
  near(LB, 453.59237, 'lb'); near(W.G_PER_OZ, 28.349523125, 'oz'); near(W.toG(1, 'lb'), 453.59237, 'toG lb'); near(W.toG('2,5', 'oz'), 70.8738, 'toG comma', 1e-3);
  // limits
  const L = (cls, loco, multi, ov) => W.limitOf(Object.assign(W.newSheet(cls), { loco: loco || 'traditional', multi: multi || 1, override: ov || '' }));
  near(L(3).lb, 3, '3lb'); near(L(12).lb, 12, '12lb'); near(L(30).lb, 30, '30lb');
  near(L(3, 'shuffler').lb, 4.5, '3lb NTL'); near(L(12, 'jansen').lb, 18, '12lb NTL'); near(L(30, 'hover').lb, 45, '30lb NTL');
  near(L(3, 'walker').lb, 6, '3lb walker'); near(L(12, 'walker').lb, 24, '12lb walker'); near(L(30, 'walker').lb, 60, '30lb walker');
  near(L(12, 'traditional', 2).segLb, 8, '12lb 2-seg'); near(L(12, 'traditional', 3).segLb, 5.33, '12lb 3-seg'); near(L(3, 'traditional', 4).segLb, 1, '3lb 4-seg'); near(L(30, 'traditional', 2).lb, 40, '30lb 2-seg entry');
  ok(L(12, 'shuffler', 2).conflict && L(12, 'shuffler', 2).lb === 12, 'conflict NTL+multibot -> no bonus');
  ok(L(12, 'traditional', 1, 11.5).lb === 11.5 && L(12, 'traditional', 1, 11.5).overridden && !L(12, 'traditional', 1, 11.5).verified, 'override');
  ok(isNaN(L('').lb) && !L('').verified, 'no class -> no limit');
  // v25: 1lb class from SPARC v1.7 (NHRL defines no 1lb class)
  ok(!W.RULES.classes[1] && W.SPARC.classes[1].base === 1, '1lb not in NHRL table, in SPARC');
  near(L(1).lb, 1, '1lb rolling'); ok(L(1).ruleset === 'sparc' && L(1).verified && /sparc\.tools/.test(L(1).source.url), '1lb source SPARC');
  near(L(1, 'shuffler').lb, 1.25, '1lb shuffler 1.25x'); near(L(1, 'bristle').lb, 1.5, '1lb bristle 1.5x'); near(L(1, 'gyro').lb, 1.5, '1lb gyro'); near(L(1, 'hover').lb, 1.5, '1lb hover'); near(L(1, 'torque').lb, 1.5, '1lb torque');
  near(L(1, 'walker').lb, 2, '1lb walker 2x'); ok(L(1, 'walker').flags.length === 1, 'walker confirm flag');
  ok(L(1, 'flying').lb === 1.5 && L(1, 'flying').flags.length === 1, 'flying flagged');
  ok(L(1, 'jansen').lb === 1 && !L(1, 'jansen').verified && L(1, 'jansen').flags.length === 1, 'jansen unverified, no bonus');
  ok(L(1, 'ntl-other').lb === 1.5 && !L(1, 'ntl-other').verified, 'other ntl unverified');
  const m1 = L(1, 'traditional', 3); ok(m1.lb === 1 && m1.segs === 1 && !m1.verified && /multibot/.test(m1.flags[0]), '1lb multibot unverified, no bonus');
  ok(L(1, 'traditional', 1, 1.1).lb === 1.1 && L(1, 'traditional', 1, 1.1).overridden, '1lb override');
  ok(!/TKO/.test(W.summary(Object.assign(W.newSheet('1'), { parts: [Object.assign(W.newPart(), { unitG: 500 })] })).status.note), '1lb over: no NHRL TKO note');
  ok(/TKO/.test(W.summary(Object.assign(W.newSheet('3'), { parts: [Object.assign(W.newPart(), { unitG: 1400 })] })).status.note), '3lb over: NHRL TKO note');
  // totals + status
  const sh = W.newSheet('3');
  const a = Object.assign(W.newPart('Drive'), { name: 'motor', qty: 2, unitG: 30 });
  const b = Object.assign(W.newPart('Armor/Chassis'), { name: 'chassis', print: true, slicerG: 200, measuredG: 210, unitG: 999 });
  const c = Object.assign(W.newPart('Electronics'), { name: 'camera', unitG: 20, exempt: true });
  const d = Object.assign(W.newPart('Battery'), { name: 'pack', unitG: 0.25, qty: 1 });
  sh.parts = [a, b, c, d];
  let s = W.summary(sh);
  near(s.total, 60 + 210 + 0.25, 'total uses measured print, skips exempt'); near(s.exempt, 20, 'exempt'); near(s.byCat.Drive.g, 60, 'cat subtotal');
  ok(s.status.level === 'pass', 'pass'); b.measuredG = ''; near(W.partTotal(b), 200, 'slicer fallback'); b.slicerG = ''; near(W.partTotal(b), 999, 'unit fallback');
  near(W.printInfo(Object.assign(W.newPart(), { print: true, mat: 'pla', slicerG: 100, measuredG: 108, volCm3: 50 })).deltaPct, 8, 'print delta %');
  near(W.printInfo(Object.assign(W.newPart(), { print: true, mat: 'pla', volCm3: 50 })).solidG, 62, 'solid upper bound');
  ok(!W.printInfo(Object.assign(W.newPart(), { print: true, mat: 'other', density: 1.3 })).sourced, 'custom density flagged unsourced');
  const lim = 3 * LB;
  ok(W.status(lim * 0.96, lim, 3).level === 'pass', '4% under = pass'); ok(W.status(lim * 0.98, lim, 3).level === 'warn', '2% under = warn'); ok(W.status(lim, lim, 3).level === 'warn', 'exactly at limit = warn (allowed)');
  ok(W.status(lim + 10, lim, 3).level === 'over' && /1 TKO/.test(W.status(lim + 10, lim, 3).note), 'over <=2.5oz'); ok(/3 TKO/.test(W.status(lim + 80, lim, 3).note), 'over >2.5oz');
  // multibot segments
  const ms = Object.assign(W.newSheet('12'), { multi: 2 }); ms.parts = [Object.assign(W.newPart('Weapon'), { unitG: 4 * LB, seg: 1 }), Object.assign(W.newPart('Drive'), { unitG: 9 * LB, seg: 2 })];
  s = W.summary(ms); ok(s.segs.length === 2 && s.segs[0].status.level === 'pass' && s.segs[1].status.level === 'over', 'segment status');
  // v24: 5% default + migration of v23 sheets
  ok(W.newSheet('12').warnPct === 5 && W.WARN_DEFAULT === 5, 'default warn 5%');
  ok(W.status(lim * 0.96, lim).level === 'warn', 'no margin given -> 5% default');
  ok(W.migrate({ v: 1, warnPct: 3, parts: [] }).warnPct === 5, 'v1 at old default 3 -> 5'); ok(W.migrate({ v: 1, warnPct: '', parts: [] }).warnPct === 5, 'v1 blank -> 5');
  const cu = W.migrate({ v: 1, warnPct: 2, parts: [] }); ok(cu.warnPct === 2 && cu.warnCustom, 'v1 custom kept');
  ok(W.migrate({ v: 2, warnPct: 3, warnCustom: true, parts: [] }).warnPct === 3, 'v2 custom 3 kept');
  ok(W.material('pa6gf').name === 'GF nylon (PA6-GF)' && W.material('pa6gf').d === 1.14, 'GF nylon label'); ok(/^PAHT-CF/.test(W.material('pahtcf').name) && W.material('pahtcf').d === 1.06, 'PAHT-CF label');
  // CSV round trip
  b.slicerG = 200; b.measuredG = 210; b.mat = 'pa6cf'; b.infill = 40; b.notes = 'has, comma "quote"';
  const csv = W.toCSV(sh); ok(csv.charCodeAt(0) === 0xfeff, 'BOM'); ok(/\r\n/.test(csv), 'CRLF');
  let r = W.rowsToParts(W.parseCSV(csv)); ok(r.parts.length === 4, 'csv rows'); const rb = r.parts.find(p => p.name === 'chassis');
  ok(rb.print && rb.mat === 'pa6cf' && rb.measuredG === 210 && rb.notes === 'has, comma "quote"', 'csv print fields'); ok(r.parts.find(p => p.name === 'camera').exempt, 'csv exempt');
  near(W.summary(Object.assign(W.newSheet('3'), { parts: r.parts })).total, 270.25, 'csv round-trip total');
  // tolerant matching
  r = W.rowsToParts(W.parseCSV('Item;Count;Weight (oz);Category\nWheel;4;0,5;drive\nBolt;10;0.1;Screws\nTotal;;5;\n'));
  ok(r.parts.length === 2, 'skip total row'); near(r.parts[0].unitG, 14.175, 'oz header + comma decimal', 1e-3); ok(r.parts[0].cat === 'Drive', 'category case'); ok(r.newCats[0] === 'Screws', 'new category');
  r = W.rowsToParts(W.parseCSV('Part,Qty,Total lb\nArmor,2,1\n')); near(r.parts[0].unitG, LB / 2, 'total-only column -> unit', 1e-3);
  r = W.rowsToParts(W.parseCSV('Foo,Bar\n1,2\n')); ok(r.warnings.length === 2, 'warnings for unknown columns');
  ok(W.rowsToParts(W.parseCSV(W.templateCSV())).parts.length === 2, 'template parses');
  ok(W.headerKey('Unit weight (g)') === 'unitW' && W.headerKey('QTY') === 'qty' && W.headerKey('Mass [g]') === 'unitW' && W.headerKey('Measured after print (g)') === 'measuredG', 'header keys');
  // XLSX round trip (stored) + deflated zip read
  const x = W.toXLSX(sh, { robot: 'Test', date: '2026-10-28' }); ok(x[0] === 0x50 && x[1] === 0x4b, 'xlsx zip magic');
  const rows = await W.readXLSX(x); ok(rows[0][0] === 'Category' && rows.length === 5, 'xlsx read rows');
  r = W.rowsToParts(rows); near(W.summary(Object.assign(W.newSheet('3'), { parts: r.parts })).total, 270.25, 'xlsx round-trip total');
  const files = await W.unzip(x); ok(!!files['xl/worksheets/sheet2.xml'] && /SUMIFS/.test(new TextDecoder().decode(files['xl/worksheets/sheet2.xml'])), 'summary sheet formulas');
  ok(/<f>C2\*D2<\/f>/.test(new TextDecoder().decode(files['xl/worksheets/sheet1.xml'])), 'total formula');
  // deflated entry via CompressionStream
  const raw = new TextEncoder().encode('hello deflate'); const def = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  const z = W.zip([{ name: 'a.txt', data: def }]); const dv = new DataView(z.buffer); dv.setUint16(8, 8, true); // patch local method
  const cd = z.length - 22 - 46 - 5; dv.setUint16(cd + 10, 8, true); dv.setUint32(cd + 20, def.length, true);
  const uz = await W.unzip(z); ok(new TextDecoder().decode(uz['a.txt']) === 'hello deflate', 'deflate-raw entry');
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
