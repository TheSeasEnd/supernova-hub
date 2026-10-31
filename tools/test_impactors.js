// node tools/test_impactors.js: v37 "Number of impactors" input in the Weapon Speed Analyzer (source-level checks; the browser
// behaviour is covered by tools/e2e_wsa37.js).
const fs = require('fs'), path = require('path'); const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const v = R('freqview.js'), css = R('styles.css'), sw = R('sw.js'), rd = R('README.md');
ok(/Number of impactors <b class="sgtag">our addition<\/b>/.test(v), 'field is called "Number of impactors" and tagged as our addition');
ok(/Teeth, blades or bars that hit per revolution/.test(v), 'helper line');
ok(/\[1, 2, 3, 4\]\.map/.test(v) && /data-a="imp" data-v="/.test(v) && /aria-pressed="/.test(v), 'quick picks 1-4 with aria-pressed');
ok(/type="number" inputmode="numeric" min="1" step="1" data-c="imp"/.test(v), 'typed whole-number field');
ok(/must be a whole number, 1 or more/.test(v) && /aria-invalid/.test(v), 'validation message + aria-invalid');
ok(/function N\(\) \{ return F\.impactors\(cfg\.imp\); \}/.test(v), 'all audio/tone math uses the validated impactor count');
ok(/impHtml\('w'\)/.test(v) && /impHtml\('m'\)/.test(v), 'shown in the Weapon card and in the plain calculator (tone mode)');
ok(/Audio tone \/ impact frequency \(F = tone ÷ impactors\)/.test(v), 'plain calculator tone mode');
ok(/Tone ' \+ hz\(tone\) \+ ' ÷ ' \+ impTxt\(\) \+ ' = F '/.test(v) && /S = π × F × D ÷ 17\.6 = π × /.test(v), 'explicit math line: tone ÷ impactors = F, then S');
ok(/unevenly spaced, or only some of them hit the floor/.test(v) && /2 hits per revolution makes a tone at 2× the spin rate/.test(v), 'caution about spacing/contact and 2-hit drum/bar');
ok(/s\.imp == null && s\.n != null\) \{ s\.imp = String\(s\.n\); delete s\.n;/.test(v), 'old N value migrated to imp');
ok(!/cfg\.n\b/.test(v.replace(/\/\/.*$/mg, '')) && !/÷ N\b/.test(v) && !/at N = /.test(v), 'no leftover N wording');
ok(/\.wsa-impq \.btn\{display:inline-flex;align-items:center;min-width:44px;min-height:44px/.test(css), '44 px touch targets');
ok(/supernova-v(3[7-9]|[4-9]\d)/.test(sw), 'SW cache v37+');
ok(/## v37: Number of impactors/.test(rd), 'README section');
try { new Function(v); ok(true, ''); } catch (e) { ok(false, 'freqview.js syntax ' + e.message); }
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
