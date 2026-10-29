// node tools/test_logo.js: bare flame mark (no tile/ring) in the header, sidebar and landing; app icons keep their tile.
const fs = require('fs'), path = require('path'); const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const svg = R('icons/flame.svg'), html = R('index.html'), css = R('styles.css'), sw = R('sw.js');
ok(!/<rect[^>]*fill="#121212"/.test(svg) && !/<circle/.test(svg), 'flame.svg has no tile or baked-in glow');
ok(/mask="url\(#cut\)"/.test(svg), 'inner tongue is cut out (background shows through)');
ok(/<img src="icons\/flame\.svg" alt="" class="logo">/.test(html) && /<div class="ld-mark"><img src="icons\/flame\.svg"/.test(html), 'header/sidebar and landing use the bare flame');
ok(!/border-radius:22px;box-shadow:0 0 0 2px var\(--hot\)/.test(css) && !/\.logo\{[^}]*border-radius/.test(css), 'no ring or rounded tile in CSS');
ok(/\.ld-mark::before\{[^}]*radial-gradient\(circle,rgba\(255,166,33,\.30\)/.test(css), 'soft glow behind the landing flame');
ok(/@media \(prefers-reduced-motion: no-preference\)\{[\s\S]*?html\.landing-on \.ld-mark::before\{animation:ldGlow/.test(css), 'glow pulse only without reduced motion');
ok(/<rect width="512" height="512" rx="96" fill="#121212"\/>/.test(R('icons/icon.svg')) && /href="icons\/icon\.svg"/.test(html), 'app icon / favicon keep their tile');
ok(/'icons\/flame\.svg'/.test(sw) && /supernova-v(3[3-9]|[4-9]\d)/.test(sw), 'flame cached, sw v33+');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
