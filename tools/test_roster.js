// node tools/test_roster.js: team roster data (data/team.js, data/photos.js, data/opptypes.js, sw.js).
const fs = require('fs'), path = require('path'); const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const ld = (f, k) => { const w = {}; new Function('window', R(f))(w); return w[k]; };
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const T = ld('data/team.js', 'TEAM_DATA'), P = ld('data/photos.js', 'BOT_PHOTOS'), O = ld('data/opptypes.js', 'OPP_TYPES');
const ids = T.bots.map(b => b.id); ok(new Set(ids).size === ids.length, 'unique bot ids');
const m = T.bots.find(b => b.id === 'morningstar');
ok(m && m.name === 'Morningstar' && m.cls === 3 && m.bz === 'morningstar' && m.wiki === 'Morningstar', 'Morningstar: one word, 3lb, BrettZone + wiki');
ok(m.builder === 'Nick Grumski' && /Per the user/.test(m.facts.builder) && /TBA/.test(m.facts.builder), 'builder from the user, flagged (wiki TBA)');
ok(m.weapon === 'Vertical disk thwack bot' && /Unique Weapons/.test(m.facts.weapon), 'weapon from the wiki');
ok(m.rec.join('-') === '2-2' && m.recNoFF.join('-') === '2-2' && m.recBZ.join('-') === '2-2' && m.streak === 'L1', 'record 2-2, L1');
ok(m.fights.length === 4 && m.fights.every(f => f[4] === 'x' && f[0] === '2024-10-26') && T.events[m.fights[0][5]] === 'NHRL October 2024 3lb', '4 fights, all in both sources, Oct 2024');
ok(m.fights.map(f => f[1] + ':' + f[2] + ':' + f[3]).join(',') === 'Chippy:L:JD,Fang Tooth:W:JD,Black Beans:W:KO,Name TBD:L:JD', 'fight list in order');
ok(P.morningstar && P.morningstar.src === 'img/bots/morningstar.webp' && P.morningstar.credit === 'NHRL wiki' && /File:Morningstar-Oct24\.png/.test(P.morningstar.url), 'photo credited to the wiki file');
ok(fs.existsSync(path.join(__dirname, '../img/bots/morningstar.webp')) && /img\/bots\/morningstar\.webp/.test(R('sw.js')), 'photo file cached by SW');
ok(O.morningstar && O.morningstar[0] === 'unique', 'archetype unique (wiki category)');
ok(ids.indexOf('morningstar') > ids.indexOf('comet') && ids.indexOf('morningstar') < ids.indexOf('fireball'), 'listed with the 3lb bots');
ok(/supernova-v(3\d)/.test(R('sw.js')), 'sw v30+');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
