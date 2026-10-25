/* Archetypes / matchups. Mapping lives in data/archetypes.json (editable, with sources and confidence);
   the user's corrections are stored in localStorage and take priority. */
(function () {
  'use strict';
  var DATA = null, LS = 'sn_arch_overrides_v1';
  var SHORT = { 'vertical-spinner': 'Vert', 'drum': 'Drum', 'eggbeater': 'Eggbeater', 'horizontal-spinner': 'Horizontal', 'undercutter': 'Undercutter',
    'full-body-spinner': 'Full-body', 'meltybrain': 'Melty', 'flipper': 'Flipper', 'lifter': 'Lifter', 'grappler': 'Grappler', 'axe': 'Hammer/axe',
    'hammersaw': 'Hammersaw', 'rammer': 'Control', 'crusher': 'Crusher', 'multibot': 'Multibot', 'unique': 'Unique', 'unknown': 'Unknown' };
  var FAMILY = { vertical: 'Vertical-axis spinners (vert, drum, eggbeater)', horizontal: 'Horizontal spinners (incl. undercutters)', control: 'Control (wedge, flipper, lifter, grappler, crusher)', overhead: 'Overhead (hammer/axe, hammersaw)', 'full-body': 'Full-body spinners', multibot: 'Multibots', other: 'Other', unknown: 'Unknown' };

  function overrides() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function setOverride(clean, id) { var o = overrides(); if (id === null) delete o[clean]; else o[clean] = id; localStorage.setItem(LS, JSON.stringify(o)); }
  function arch(id) { return (DATA.archetypes.filter(function (a) { return a.id === id; })[0]) || DATA.archetypes.filter(function (a) { return a.id === 'unknown'; })[0]; }

  function forOpponent(clean) {
    var o = overrides(), m = DATA.bots[clean];
    var id = o[clean] || (m && m.archetype) || 'unknown', a = arch(id);
    return { id: a.id, name: a.name, short: SHORT[a.id] || a.name, family: a.family, edited: !!o[clean], map: m || null };
  }

  function load() {
    return fetch('data/archetypes.json').then(function (r) { return r.json(); }).then(function (d) { DATA = d; }).catch(function () { DATA = null; });
  }

  function render(el, ctx) {
    var esc = ctx.esc;
    if (!DATA) { el.innerHTML = ctx.status + '<div class="card">Loading archetype data…</div>'; return; }
    var F = ctx.F; if (!F.length) { el.innerHTML = ctx.status; return; }
    // group
    var groups = {}, fams = {}, opps = {};
    F.forEach(function (f) {
      var a = forOpponent(f.oppClean);
      var g = groups[a.id] || (groups[a.id] = { a: arch(a.id), fights: [], w: 0, l: 0, lossBy: {} });
      g.fights.push(f); f.won ? g.w++ : (g.l++, g.lossBy[f.method] = (g.lossBy[f.method] || 0) + 1);
      var fm = fams[a.family] || (fams[a.family] = { w: 0, l: 0 }); f.won ? fm.w++ : fm.l++;
      var o = opps[f.oppClean] || (opps[f.oppClean] = { clean: f.oppClean, name: f.opp, w: 0, l: 0 }); f.won ? o.w++ : o.l++;
    });
    var list = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (x, y) { return (x.a.id === 'unknown') - (y.a.id === 'unknown') || y.fights.length - x.fights.length || y.l - x.l; });
    var self = DATA.selfArchetypes && DATA.selfArchetypes[ctx.bot.id];
    var h = ctx.status;
    h += '<div class="card"><h2>' + esc(ctx.bot.name) + ' vs robot types</h2><div class="note">' +
      (self ? esc(ctx.bot.name) + ' itself is an <b>' + esc(arch(self.archetype).name.toLowerCase()) + '</b> (vertical-axis spinner) per the <a href="' + self.sources[0] + '" target="_blank" rel="noopener">NHRL wiki</a>. ' : '') +
      'Opponents are grouped by the NHRL wiki’s weapon-type categories.</div>' +
      '<div class="caveat">⚠ Small sample: ' + F.length + ' fights in total, so 1–2 fights per type. Treat these as hints, not trends. Driving, build quality and luck matter more than robot type.</div></div>';

    // watch-outs
    var flags = list.filter(function (g) { return g.a.id !== 'unknown' && g.l > 0 && g.l / g.fights.length >= 0.5; });
    var strong = list.filter(function (g) { return g.a.id !== 'unknown' && g.l === 0; });
    h += '<div class="card"><h2>Watch-outs</h2>' + (flags.length ? flags.map(function (g) {
      return '<div class="flag"><div class="ft">Lost to <b>' + esc(g.a.name.toLowerCase()) + 's</b> ' + g.l + ' of ' + g.fights.length + '</div><div class="note">' + methods(g.lossBy) + ' · vs ' + g.fights.filter(function (f) { return !f.won; }).map(function (f) { return esc(f.opp); }).join(', ') + '</div></div>';
    }).join('') : '<div class="note">No known type with a losing record yet.</div>') +
      (strong.length ? '<div class="good">Unbeaten so far vs: ' + strong.map(function (g) { return esc(g.a.name) + ' (' + g.w + '–0)'; }).join(', ') + '</div>' : '') +
      (groups.unknown ? '<div class="note" style="margin-top:8px">' + groups.unknown.fights.length + ' fights (' + groups.unknown.w + '–' + groups.unknown.l + ') are vs robots with no verified type. Set them below to sharpen this.</div>' : '') + '</div>';

    // families
    h += '<div class="card"><h2>By family</h2>' + Object.keys(fams).filter(function (k) { return k !== 'unknown'; }).map(function (k) {
      var fm = fams[k], n = fm.w + fm.l; return '<div class="kv famrow"><div>' + esc(FAMILY[k] || k) + '</div><div><b>' + fm.w + '–' + fm.l + '</b> <span class="note">' + Math.round(fm.w / n * 100) + '%</span></div></div>';
    }).join('') + '</div>';

    // per-archetype cards
    h += '<div class="sectiontitle pad">By archetype</div>';
    list.forEach(function (g) {
      var n = g.fights.length, a = g.a;
      h += '<div class="card acard"><div class="row"><div><h3>' + esc(a.name) + '</h3><div class="note">' + n + ' fight' + (n === 1 ? '' : 's') + ' · ' + Math.round(g.w / n * 100) + '% wins' + (g.l ? ' · losses: ' + methods(g.lossBy) : '') + '</div></div>' +
        '<div class="rec"><span class="win">' + g.w + '</span><span class="dash">–</span><span class="loss">' + g.l + '</span></div></div>' +
        '<div class="chips">' + g.fights.map(function (f) { return '<a class="chip ' + (f.won ? 'W' : 'L') + '" href="' + ctx.fightUrl(f) + '" target="_blank" rel="noopener">' + (f.won ? 'W' : 'L') + ' ' + esc(f.opp) + ' · ' + esc(f.method) + '</a>'; }).join('') + '</div>' +
        (a.id !== 'unknown' ? notes(a, esc) : '') + '</div>';
    });

    // opponents editor
    var ov = overrides();
    h += '<div class="sectiontitle pad">Opponents · tap to correct</div><div class="card">';
    Object.keys(opps).map(function (k) { return opps[k]; }).sort(function (x, y) { return x.name.localeCompare(y.name); }).forEach(function (o) {
      var a = forOpponent(o.clean), m = a.map;
      var conf = a.edited ? '<span class="cbadge you">Set by you</span>' : (m && m.confidence === 'high') ? '<span class="cbadge ok">NHRL wiki</span>' : '<span class="cbadge unk">Unverified</span>';
      h += '<div class="opprow"><div class="oname"><div><b>' + esc(o.name) + '</b> <span class="note">' + o.w + '–' + o.l + '</span></div>' + conf + '</div>' +
        '<select data-opp="' + esc(o.clean) + '" aria-label="Archetype for ' + esc(o.name) + '">' + DATA.archetypes.map(function (x) { return '<option value="' + x.id + '"' + (x.id === a.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' +
        '<div class="note src">' + (m ? esc(m.evidence) + (m.subtype ? ' Subtype: ' + esc(m.subtype) + '.' : '') + ' ' + (m.sources || []).map(function (u, i) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">source' + ((m.sources.length > 1) ? ' ' + (i + 1) : '') + '</a>'; }).join(' · ') : 'Not in the mapping yet (new opponent).') +
        (a.edited ? ' <button class="linkbtn" data-reset-opp="' + esc(o.clean) + '">Undo my change</button>' : '') + '</div></div>';
    });
    h += (Object.keys(ov).length ? '<button class="btn ghost sm" data-reset-all>Reset all my changes</button>' : '') + '<div class="note" style="margin-top:8px">Your changes are saved on this phone. Defaults come from <code>data/archetypes.json</code> (checked ' + esc(DATA.checkedAt) + ').</div></div>';

    // glossary
    h += '<details class="card gloss"><summary>All NHRL archetypes (definitions)</summary>' + DATA.archetypes.filter(function (a) { return a.id !== 'unknown'; }).map(function (a) {
      return '<div class="gitem"><b>' + esc(a.name) + '</b>' + (a.nhrlCategory ? ' <span class="note">· NHRL category “' + esc(a.nhrlCategory) + '”</span>' : '') + '<div class="note">' + esc(a.definition) + '</div></div>';
    }).join('') + '<div class="note" style="margin-top:8px">Taxonomy: <a href="' + DATA.taxonomySource + '" target="_blank" rel="noopener">NHRL wiki, Robots by weapon type</a>. Definitions summarised from <a href="https://robotcombatwiki.com/wiki/Weapons" target="_blank" rel="noopener">RobotCombatWiki</a> and <a href="https://wiki.combatrobots.org/weapons/spinner-types/" target="_blank" rel="noopener">Combat Robots Wiki</a>.</div></details>';
    h += ctx.footer.replace('</div>', ' · Archetypes from NHRL wiki, RobotCombatWiki and Combat Robots Wiki</div>');
    el.innerHTML = h;

    el.onchange = function (e) { var t = e.target; if (t.dataset.opp) { setOverride(t.dataset.opp, t.value); ctx.onChange(); } };
    el.onclick = function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.dataset.resetOpp) { setOverride(t.dataset.resetOpp, null); ctx.onChange(); }
      else if (t.hasAttribute('data-reset-all') && confirm('Reset all your archetype changes?')) { localStorage.removeItem(LS); ctx.onChange(); }
    };
  }

  function methods(by) { return Object.keys(by).map(function (k) { return by[k] + ' ' + k; }).join(', ') || '—'; }
  function notes(a, esc) {
    return '<details class="gen"><summary>General notes (wiki, general knowledge)</summary><div class="note">' + esc(a.definition) + '</div>' +
      (a.strengths.length ? '<div class="sw"><b class="win">Strengths</b><ul>' + a.strengths.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '') +
      (a.weaknesses.length ? '<div class="sw"><b class="loss">Weaknesses</b><ul>' + a.weaknesses.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '') +
      (a.matchupNote ? '<div class="note mu">' + esc(a.matchupNote) + '</div>' : '') +
      '<div class="note">General knowledge about the type, not about these specific robots. Sources: ' + a.sources.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\//, '').split('/')[0]) + '</a>'; }).join(' · ') + '</div></details>';
  }

  window.Archetypes = { load: load, render: render, forOpponent: forOpponent, ready: function () { return !!DATA; } };
})();
