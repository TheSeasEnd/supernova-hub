// node tools/test_branding.js: app name "Too Hot to Handle Statistics Hub" everywhere user-visible; old name gone.
const fs = require('fs'), path = require('path'); const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const N = 'Too Hot to Handle Statistics Hub', html = R('index.html'), man = JSON.parse(R('manifest.webmanifest')), app = R('app.js'), wv = R('weightview.js');
ok(html.includes('<title>' + N + '</title>'), 'page title');
ok(html.includes('class="appname" title="' + N + '"') && /<span class="an-a">Too Hot to Handle<\/span> <span class="an-b"><span class="an-full">Statistics<\/span><span class="an-short" aria-hidden="true">Stats<\/span> Hub<\/span>/.test(html), 'header name (full + short)');
ok(html.includes('apple-mobile-web-app-title" content="TH2H Stats"') && html.includes('application-name" content="TH2H Stats"'), 'home-screen titles');
ok(man.name === N && man.short_name === 'TH2H Stats' && man.short_name.length <= 12, 'manifest name/short_name');
ok(app.includes("' · " + N + "'") && app.includes('<b>' + N + '</b>'), 'document.title + About card');
ok(wv.includes("app: 'too-hot-to-handle-statistics-hub'") && wv.includes('too-hot-statistics-hub-weight-backup-') && wv.includes(N + ' weight backup'), 'weight backup export');
for (const f of ['index.html', 'manifest.webmanifest', 'app.js', 'weightview.js', 'teamview.js', 'calcs.js', 'sagcalc.js', 'weightmath.js']) ok(!/Too Hot to Handle Hub|Too Hot Hub|too-hot-to-handle-hub/.test(R(f)), 'old name gone from ' + f);
ok(/supernova-v(2[89]|[3-9]\d)/.test(R('sw.js')), 'sw v28+');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
