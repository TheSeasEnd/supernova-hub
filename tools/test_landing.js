// node tools/test_landing.js: landing / title screen config (index.html, app.js, styles.css).
const fs = require('fs'), path = require('path'); const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const html = R('index.html'), app = R('app.js'), css = R('styles.css');
ok(/<section id="landing" class="landing"/.test(html) && !/data-tab="landing"/.test(html), 'landing exists and is not a tab');
ok((html.match(/data-tab="/g) || []).length === 6, 'still 6 tabs');
ok(/!location\.hash\.replace\(\/\^#\/, ''\) && !sessionStorage\.getItem\('th2h_landing_left'\)/.test(html), 'early check: bare URL + not left this session');
ok(/Too Hot to Handle<\/span> <span class="ld-l2">Statistics Hub/.test(html) && /id="landingGo"/.test(html) && /icons\/icon\.svg/.test(html), 'title, flame, button');
ok(/landingGo'\)\.addEventListener\('click', function \(\) \{ navigate\('#team', false\)/.test(app), 'button goes to #team (replace)');
ok(/if \(landingOn\(\)\) push = false;/.test(app), 'never pushes over the landing');
ok(/ssSet\(LANDING_KEY, '1'\)/.test(app) && /history\.replaceState\(null, '', ssGet\(LAST_KEY\) \|\| '#overview'\)/.test(app), 'left flag + bare URL goes to last tab');
ok(/@media \(prefers-reduced-motion: no-preference\)\{\s*html\.landing-on \.ld-in > \*\{animation/.test(css) && !/\.ld-[a-z]+[^{]*\{[^}]*animation:/.test(css.replace(/@media \(prefers-reduced-motion: no-preference\)\{[\s\S]*?\n\}/, '')), 'animation only without reduced motion');
ok(/html\.landing-on main > \.view,html\.landing-on \.top/.test(css), 'views + header hidden on landing');
ok(/supernova-v(29|[3-9]\d)/.test(R('sw.js')), 'sw v29+');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
