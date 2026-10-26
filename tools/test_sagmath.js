/* Unit tests for sagmath.js: worked examples from /workspace/calculator-data/sag-math-review.md + sanity checks.
   Run: node tools/test_sagmath.js */
const M = require('../sagmath.js');
let pass = 0, fail = 0;
function near(name, got, want, tol) { const ok = Math.abs(got - want) <= tol; ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + ': got ' + (+got).toFixed(4) + ', want ' + want + ' ±' + tol); }
function eq(name, got, want) { const ok = got === want; ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + ': got ' + got + ', want ' + want); }
function st(o) { const s = M.defaults(); s.loads = []; return Object.assign(s, o); }
const H8 = { hMode: 'direct', hMohm: 8 };

// --- review worked examples (quality class k, harness 8 mΩ, late = 3.75 V/cell rest) ---
let r = M.compute(st({ S: 4, mah: 1300, rMode: 'quality', k: 10, hMohm: 0 }));
near('4S 1300 avg k=10: R_pack mΩ', r.rPack * 1000, 30.77, 0.05);
r = M.compute(st({ S: 4, mah: 1300, k: 7 })); near('4S 1300 good k=7: R_pack mΩ', r.rPack * 1000, 21.54, 0.05);
r = M.compute(st({ S: 4, mah: 1300, k: 15 })); near('4S 1300 poor k=15: R_pack mΩ', r.rPack * 1000, 46.15, 0.05);
// 4S 1300 avg + 8 mΩ harness: 60 A late -> 3.17 V/cell; 100 A fresh(4.15) -> 3.18; max burst late to 3.30 -> 46 A
let b = { S: 4, rPackEff: 0.030769, rH: 0.008 }, base = st({});
near('4S 1300 avg+wiring 60 A late V/cell', M.point(60, 3.75, 1, b, base).vCell, 3.17, 0.01);
near('4S 1300 avg+wiring 100 A fresh(4.15) V/cell', M.point(100, 4.15, 1, b, base).vCell, 3.18, 0.01);
near('4S 1300 avg 40 A late V/cell (no wiring)', M.point(40, 3.75, 1, { S: 4, rPackEff: 0.030769, rH: 0 }, base).vCell, 3.44, 0.01);
near('4S 1300 avg+wiring max burst late to 3.30', M.maxAmps(3.75, 3.30, 4, 0.038769), 46.4, 0.3);
near('4S 1300 good max burst late to 3.30', M.maxAmps(3.75, 3.30, 4, 0.021538), 83.6, 0.3);
// 6S 1000 good k=7 -> 42 mΩ; avg late 60 A -> 3.15 V/cell; max late avg+wiring -> 40 A
r = M.compute(st({ S: 6, mah: 1000, k: 7 })); near('6S 1000 good: R_pack mΩ', r.rPack * 1000, 42.0, 0.05);
near('6S 1000 avg 60 A late V/cell', M.point(60, 3.75, 1, { S: 6, rPackEff: 0.060, rH: 0 }, base).vCell, 3.15, 0.01);
near('6S 1000 avg+wiring max late to 3.30', M.maxAmps(3.75, 3.30, 6, 0.068), 39.7, 0.3);
// 3S 2200 avg k=10 -> 13.6 mΩ; avg+wiring 100 A late -> 3.03 V/cell; max late avg+wiring -> 62 A
r = M.compute(st({ S: 3, mah: 2200, k: 10 })); near('3S 2200 avg: R_pack mΩ', r.rPack * 1000, 13.64, 0.05);
near('3S 2200 avg+wiring 100 A late V/cell', M.point(100, 3.75, 1, { S: 3, rPackEff: 0.013636, rH: 0.008 }, base).vCell, 3.03, 0.01);
near('3S 2200 avg+wiring max late to 3.30', M.maxAmps(3.75, 3.30, 3, 0.021636), 62.4, 0.3);
// 4S 850 good k=7 -> 32.9 mΩ, max late 55 A
r = M.compute(st({ S: 4, mah: 850, k: 7 })); near('4S 850 good: R_pack mΩ', r.rPack * 1000, 32.94, 0.05);
near('4S 850 good max late to 3.30', M.maxAmps(3.75, 3.30, 4, r.rPack), 54.6, 0.3);
// CNHL Ministar 6S 1300, measured 5.14 mΩ worst cell -> 30.8 mΩ pack, 165 A to 3.30 V/cell from 4.15 V/cell (Rotorama peak 165 A)
r = M.compute(st({ S: 6, mah: 1300, rMode: 'measured', measWhich: 'cell', rCell: 5.14 }));
near('Ministar measured: R_pack mΩ', r.rPack * 1000, 30.84, 0.02);
near('Ministar max from 4.15 to 3.30', M.maxAmps(4.15, 3.30, 6, r.rPack), 165.4, 0.5);
near('Ministar continuous estimate A (Rotorama 53 A)', 0.55 * 0.5 * 6 / r.rPack, 53.5, 0.5);
// app's old 0.4 V C-model, for reference: 6S 1300 120C -> 2.56 mΩ/cell. New C-mode (realism 0.5, 0.5 V at real peak) -> 6.41 mΩ/cell
r = M.compute(st({ S: 6, mah: 1300, rMode: 'crating', cRating: 120, realism: 0.5, dvPeak: 0.5 }));
near('C-mode 6S 1300 120C: R_cell mΩ', r.rCell * 1000, 6.41, 0.01); near('C-mode label max A', r.labelMaxA, 156, 0.01);

// --- sanity checks: series/parallel scaling ---
r = M.compute(st({ S: 4, P: 1, mah: 1300, rMode: 'measured', rCell: 5 })); near('4S1P 5 mΩ/cell -> 20 mΩ', r.rPack * 1000, 20, 1e-9);
let r2 = M.compute(st({ S: 4, P: 2, mah: 2600, rMode: 'measured', rCell: 5 })); near('4S2P same cells -> 10 mΩ (half)', r2.rPack * 1000, 10, 1e-9);
let r3 = M.compute(st({ S: 8, P: 1, mah: 1300, rMode: 'measured', rCell: 5 })); near('8S1P -> 40 mΩ (double)', r3.rPack * 1000, 40, 1e-9);
r = M.compute(st({ S: 4, P: 2, capMode: 'cell', mahCell: 650, k: 10 })); near('4S2P 650/cell: total Ah', r.ahPack, 1.3, 1e-9);
near('quality R_pack independent of P for same total Ah', r.rPack * 1000, 30.77, 0.05);
r = M.compute(st({ S: 6, P: 1, mah: 1300, rMode: 'measured', measWhich: 'pack', rPack: 30 })); near('whole-pack 30 mΩ -> per-cell 5', r.rCell * 1000, 5, 1e-9);
near('Wh 4S 1300 LiPo = 19.24', M.compute(st({ S: 4, mah: 1300 })).wh, 19.24, 1e-6);
near('Wh 6S 1000 LiHV (3.8 nom) = 22.8', M.compute(st({ S: 6, mah: 1000, vNom: 3.8 })).wh, 22.8, 1e-6);
near('Harness build 30 cm 16 AWG + 2×1.0 + 2 = 7.96 mΩ', M.harnessMohm({ hMode: 'build', hAwg: 16, hLenCm: 30, hConn: 2, hConnMohm: 1.0, hSwitch: 2 }), 7.96, 1e-6);
near('Doubling current doubles sag', M.point(80, 4, 1, b, base).sag / M.point(40, 4, 1, b, base).sag, 2, 1e-9);
near('Temp factor 1.5 scales pack R', M.compute(st({ S: 4, mah: 1300, k: 10, tempFactor: 1.5 })).rPackEff * 1000, 46.15, 0.05);

// --- scenarios, ESC limit, verdicts ---
let s = st({ S: 4, mah: 850, k: 10, ...H8 });
s.loads = [Object.assign(M.newLoad('weapon'), { qty: 1, spinA: 60, spinS: 2, steadyA: 8, respins: 10, duty: 80 }),
           Object.assign(M.newLoad('drive'), { qty: 2, cruiseA: 5, pushA: 15, pushS: 6, pushes: 5, duty: 70 })];
r = M.compute(s);
near('worst current = 60 + 2×15', r.worst.I, 90, 1e-9); eq('worst uses long multiplier (6 s push > 5 s)', r.worst.mult, 1.3);
near('opening current = 60 + 2×5', r.opening.I, 70, 1e-9); eq('opening uses short multiplier', r.opening.mult, 1.0);
near('average current', r.average.I, 8 * 0.8 + 60 * 20 / 180 + 2 * 5 * 0.7 + 30 * 30 / 180, 1e-9);
eq('worst verdict FAIL (deep sag)', r.worst.verdict.level, 'fail');
s.loads[0].limitA = 40; r = M.compute(s); near('ESC limit clamps weapon spin to 40 A', r.worst.I, 70, 1e-9);
const vb = (vCell, vPack) => M.point(0, vCell, 1, { S: 4, rPackEff: 0.03, rH: 0 }, Object.assign(st({}), { becMin: vPack })).verdict.level;
eq('3.6 V/cell -> pass', vb(3.6, 0), 'pass'); eq('3.4 V/cell -> warn', vb(3.4, 0), 'warn'); eq('3.2 V/cell -> fail', vb(3.2, 0), 'fail');
eq('3.6 V/cell but under BEC min 15 V -> fail', vb(3.6, 15), 'fail');
eq('missing S -> invalid', M.compute(st({ mah: 1000 })).valid, false);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
