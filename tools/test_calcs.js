// node tools/test_calcs.js: checks the Calcs list config (calcs.js) and the app tab list (app.js).
const fs = require('fs'), vm = require('vm'), path = require('path');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const win = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../calcs.js'), 'utf8'), { window: win, document: {}, history: {}, location: { hash: '' } });
const L = win.Calcs.list, by = id => L.find(c => c.id === id);
ok(by('battery') && by('battery').disabled === true && by('battery').disabledLabel === 'Coming soon', 'battery greyed out (Coming soon)');
ok(by('battery').kind === 'native' && by('battery').render === 'sag', 'battery code kept (native sag)');
const w = by('weight'); ok(w && w.kind === 'native' && w.render === 'weight' && !w.disabled, 'weight is an in-app calc');
ok(w.badge === 'Work in progress', 'weight keeps WIP badge');
ok(/c\.badge \? ' <span class="tbuild">'/.test(fs.readFileSync(path.join(__dirname, '../calcs.js'), 'utf8')), 'badge rendered on card');
ok(L.filter(c => /ember\.level5robotics\.com/.test(c.url || '')).length === 5, 'Ember links unchanged');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
ok(/var TABS = \['overview', 'fights', 'team', 'archetypes', 'calc', 'more'\];/.test(app), '6 tabs, no weight tab');
ok(/#weight\(\\\/\|\$\)/.test(app) && /#calc\/weight/.test(app), '#weight redirects to #calc/weight');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
ok(!/data-tab="weight"/.test(html) && !/view-weight/.test(html) && (html.match(/data-tab="/g) || []).length === 6, 'index has 6 tabs');
ok(/supernova-v26/.test(fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8')), 'sw v26');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
