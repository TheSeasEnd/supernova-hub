// node tools/test_ptr.js: pull-to-refresh must update data, never reload the page (a reload goes to the landing page).
const fs = require('fs'), path = require('path'); const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const app = R('app.js'), css = R('styles.css'), html = R('index.html');
ok(/html,body\{overscroll-behavior-y:contain\}/.test(css), 'native pull-to-refresh off on html and body');
ok(/window\.addEventListener\('touchmove', function \(e\) \{[\s\S]*?if \(e\.cancelable\) e\.preventDefault\(\);[\s\S]*?\}, \{ passive: false \}\);/.test(app), 'non-passive touchmove cancels the native pull');
ok(/if \(Math\.abs\(t\.clientX - startX\) > dy \|\| window\.scrollY > 0\) \{ startY = null;/.test(app), 'sideways drags and scrolled pages are left alone');
ok(/if \(landingOn\(\)\) return;\s*show\(/.test(app) && /var go = dy > PTR_GO && !landingOn\(\)/.test(app), 'no refresh from the landing page');
ok(/busy = true; show\(40, 'Updating…', 'busy'\)/.test(app) && /refresh\(true\)\.then/.test(app), 'Updating indicator + data refresh');
ok(!/v\.id !== 'view-calc'/.test(app), 'works on the Calcs tab too');
ok(!/location\.reload\(/.test(app), 'never reloads the page');
ok(/@media \(prefers-reduced-motion: no-preference\)\{ \.ptr\.busy \.ptr-ic\{animation/.test(css), 'spinner only animates without reduced motion');
ok(/id="ptr" class="ptr" role="status" aria-live="polite"/.test(html), 'indicator announced');
ok(/supernova-v(3[2-9]|[4-9]\d)/.test(R('sw.js')), 'sw v32+');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
