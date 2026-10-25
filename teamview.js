/* Team tab: Too Hot to Handle dashboard. Data: bundled snapshot (data/team.js), which combines BrettZone
   tournament fight lists (by NHRL) with NHRL wiki fight histories. Hash routes: #team, #team/<botId>. */
(function () {
  'use strict';
  var el = null, filter = 'all', cur = '';
  var SRC = { b: ['BZ', 'BrettZone only'], w: ['WIKI', 'NHRL wiki only'], x: ['BOTH', 'BrettZone + wiki'] };
  var STAGE = { q: 'Qualifying', b: 'Bracket', e: 'Exhibition' };
  function D() { return window.TEAM_DATA; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function fmtD(iso) { if (!iso) return ''; var p = iso.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }); }
  function pct(r) { var n = r[0] + r[1]; return n ? Math.round(r[0] / n * 1000) / 10 + '%' : '—'; }
  function recHtml(r, cls) { return '<span class="' + (cls || 'trec') + '"><span class="w">' + r[0] + '</span><span class="d">–</span><span class="l">' + r[1] + '</span></span>'; }
  function streakPill(s) { if (!s) return ''; return '<span class="tstreak ' + (s[0] === 'W' ? 'W' : 'L') + '">' + esc(s) + '</span>'; }
  function byId(id) { var d = D(); return d.bots.filter(function (b) { return b.id === id; })[0] || null; }
  function active(b) { return b.lastDate && b.lastDate >= '2026-01-01'; }

  function totals() {
    var d = D(), w = 0, l = 0, w2 = 0, l2 = 0, n = 0, cls = {}, act = 0;
    d.bots.forEach(function (b) {
      w += b.rec[0]; l += b.rec[1]; w2 += b.recNoFF[0]; l2 += b.recNoFF[1]; n += b.fights.length; if (active(b)) act++;
      var c = cls[b.cls] || (cls[b.cls] = [0, 0, 0]); c[0] += b.rec[0]; c[1] += b.rec[1]; c[2]++;
    });
    return { rec: [w, l], noFF: [w2, l2], n: n, cls: cls, bots: d.bots.length, act: act };
  }

  function renderList() {
    var d = D(), t = totals();
    var h = '<div class="tbanner"><div class="flames"></div><div class="tb-in"><div class="tb-k">NHRL team</div><div class="tb-name">TOO HOT<span> TO HANDLE</span></div>' +
      '<div class="tb-sub">aka ' + esc(d.alt) + ' · ' + t.bots + ' robots with fights · ' + d.planned.length + ' in build</div></div></div>';
    h += '<div class="status">Team snapshot · ' + esc(d.asOf) + ' · not live</div>';
    h += '<div class="card ttot"><div class="record"><div><div class="k2">Team record</div><div class="big">' + recHtml(t.rec, 'tr') + '</div></div>' +
      '<div class="stat" style="margin-left:auto;text-align:right"><div class="v">' + pct(t.rec) + '</div><div class="k">Win rate</div></div></div>' +
      '<div class="recnotes"><div>Without forfeits: <b>' + t.noFF[0] + '–' + t.noFF[1] + '</b> · ' + t.n + ' fights · ' + t.act + ' robots fought in 2026</div></div>' +
      '<div class="grid3 tcls">' + [3, 12, 30].map(function (c) { var x = t.cls[c] || [0, 0, 0]; return '<div class="mini stat"><div class="v">' + x[0] + '–' + x[1] + '</div><div class="k">' + c + 'lb · ' + x[2] + ' bots</div></div>'; }).join('') + '</div>' +
      '<div class="note" style="margin-top:8px">Totals add up each robot’s combined record (BrettZone + NHRL wiki). Phantom III is history only and isn’t in the totals.</div></div>';
    h += '<div class="seg" role="tablist">' + [['all', 'All'], ['3', '3lb'], ['12', '12lb'], ['30', '30lb'], ['build', 'In build']].map(function (f) { return '<button data-tfilter="' + f[0] + '" class="' + (filter === f[0] ? 'on' : '') + '">' + f[1] + '</button>'; }).join('') + '</div>';
    var list = d.bots.filter(function (b) { return filter === 'all' || String(b.cls) === filter; });
    if (filter !== 'build') h += list.map(cardHtml).join('');
    if (filter === 'all' || filter === 'build') h += '<div class="sectiontitle pad">In build</div>' + d.planned.map(function (p) {
      return '<div class="card tcard planned" data-plan="' + esc(p.id) + '" role="button"><div class="tc-top"><div class="tc-name">' + esc(p.name) + '</div><span class="tbuild">IN BUILD</span></div>' +
        '<div class="note">Planned, no fights yet.' + (p.channel ? ' Team channel <span class="tchan">#' + esc(p.channel) + '</span>' : '') + '</div></div>';
    }).join('');
    h += '<div class="note pad">Tap a robot to open its hub (Overview, Fights, Archetypes). The hub’s Overview links to source detail. Each fight is tagged by source: <b>BZ</b> BrettZone, <b>WIKI</b> NHRL wiki, <b>BOTH</b> found in both and counted once.</div>';
    h += creditsHtml();
    el.innerHTML = h;
  }

  function cardHtml(b) {
    var c = b.counts || {};
    return '<a class="card tcard' + (b.appBot ? ' mine' : '') + '" href="#team/' + esc(b.id) + '" data-team="' + esc(b.id) + '">' +
      '<div class="tc-top"><div class="tc-name">' + esc(b.name) + '</div><span class="tcls-chip">' + b.cls + 'lb</span>' + streakPill(b.streak) + '</div>' +
      '<div class="tc-rec">' + recHtml(b.rec) + '<span class="tc-noff">no FF ' + b.recNoFF[0] + '–' + b.recNoFF[1] + '</span><span class="chev">›</span></div>' +
      '<div class="tc-kv"><span>Last</span><span>' + esc((b.lastEvent || '').replace(/^NHRL /, '') || '—') + (b.lastDate ? ' · ' + fmtD(b.lastDate) : '') + '</span>' +
      '<span>Builder</span><span>' + esc(b.builder || 'Unknown') + '</span><span>Weapon</span><span>' + esc(b.weapon || 'Unknown') + '</span></div>' +
      '<div class="tc-foot">' + (b.channel ? '<span class="tchan">#' + esc(b.channel) + '</span>' : '') +
      ['x', 'b', 'w'].filter(function (k) { return c[{ x: 'both', b: 'brettzone', w: 'wiki' }[k]]; }).map(function (k) { return '<span class="tsrc ' + k + '">' + SRC[k][0] + ' ' + c[{ x: 'both', b: 'brettzone', w: 'wiki' }[k]] + '</span>'; }).join('') +
      (b.appBot ? '<span class="tmine">★ yours · live</span>' : '') + '</div></a>';
  }

  function fightsHtml(b) {
    var d = D(), byYear = {}, years = [];
    b.fights.slice().reverse().forEach(function (f) { var y = (f[0] || '????').slice(0, 4); if (!byYear[y]) { byYear[y] = []; years.push(y); } byYear[y].push(f); });
    return years.map(function (y) {
      var w = byYear[y].filter(function (f) { return f[2] === 'W'; }).length, l = byYear[y].length - w;
      return '<div class="event"><div class="eventhead"><h3>' + esc(y) + '</h3><span class="meta">' + w + '–' + l + '</span></div>' + byYear[y].map(function (f) {
        var ev = f[5] >= 0 ? d.events[f[5]].replace(/^NHRL /, '') : '';
        var sub = [fmtD(f[0]), ev, f[4] === 'w' ? f[6] : STAGE[f[6]]].filter(Boolean).join(' · ');
        var flag = f[7] ? '<div class="tflag' + (/conflict/.test(f[7]) ? ' bad' : '') + '">' + esc(f[7]) + '</div>' : '';
        return '<div class="fight tf ' + f[2] + '"><div class="res ' + (f[2] === 'W' ? 'win' : 'loss') + '">' + f[2] + '</div>' +
          '<div class="mid"><div class="opp">' + esc(f[1]) + '</div><div class="rd">' + esc(sub) + '</div>' + flag + '</div>' +
          '<div class="right"><span class="method ' + esc(f[3]) + '">' + esc(f[3] || '—') + '</span><span class="tsrc ' + f[4] + '" title="' + SRC[f[4]][1] + '">' + SRC[f[4]][0] + '</span></div></div>';
      }).join('') + '</div>';
    }).join('');
  }

  function detailBlock(b, isHistory) {
    var c = b.counts || {}, d = D();
    var conf = d.conflicts.filter(function (x) { return x[0] === b.name; });
    var h = '<div class="card"><div class="record"><div><div class="k2">' + (isHistory ? 'Record (history)' : 'Combined record') + '</div><div class="big">' + recHtml(b.rec, 'tr') + '</div></div>' +
      '<div class="stat" style="margin-left:auto;text-align:right"><div class="v ' + (b.streak && b.streak[0] === 'W' ? 'win' : 'loss') + '">' + esc(b.streak || '—') + '</div><div class="k">Current streak</div></div></div>' +
      '<div class="recnotes"><div>Without forfeits: <b>' + b.recNoFF[0] + '–' + b.recNoFF[1] + '</b> · BrettZone only: <b>' + b.recBZ[0] + '–' + b.recBZ[1] + '</b></div>' +
      '<div>' + b.fights.length + ' fights: ' + (c.both || 0) + ' in both, ' + (c.brettzone || 0) + ' BrettZone only, ' + (c.wiki || 0) + ' wiki only' + (b.firstDate ? ' · ' + fmtD(b.firstDate) + ' – ' + fmtD(b.lastDate) : '') + '</div>' +
      (b.wikiDupesDropped ? '<div>' + b.wikiDupesDropped + ' duplicate wiki rows (2024+, results conflict) not counted.</div>' : '') + '</div></div>';
    h += '<div class="card"><div class="kv">' +
      '<div>Class</div><div>' + b.cls + 'lb (NHRL)</div><div>Builder / driver</div><div>' + esc(b.builder || 'Unknown') + '</div><div>Weapon</div><div>' + esc(b.weapon || 'Unknown') + '</div>' +
      '<div>Last event</div><div>' + esc(b.lastEvent || '—') + (b.lastDate ? '<br><span class="note">' + fmtD(b.lastDate) + '</span>' : '') + '</div>' +
      (b.channel ? '<div>Team channel</div><div><span class="tchan">#' + esc(b.channel) + '</span></div>' : '') + '</div>' +
      (b.note ? '<div class="note" style="margin-top:8px">' + esc(b.note) + '</div>' : '') +
      (conf.length ? conf.map(function (x) { return '<div class="tflag bad" style="margin-top:8px">⚠ ' + esc(x[0]) + ' vs ' + esc(x[2]) + ' (' + esc(x[1]) + '): ' + esc(x[3]) + '</div>'; }).join('') : '') +
      (b.facts ? '<div class="tfacts">' + (b.facts.builder ? '<div><b>Builder:</b> ' + esc(b.facts.builder) + '</div>' : '') + (b.facts.weapon ? '<div><b>Weapon:</b> ' + esc(b.facts.weapon) + '</div>' : '') + '</div>' : '') +
      '<div class="links tlinks">' + (b.sources || []).map(function (s) { return '<a class="btn ghost sm" href="' + esc(s[1]) + '" target="_blank" rel="noopener">' + esc(s[0]) + ' ↗</a>'; }).join('') + '</div>' +
      (isHistory ? '' : '<button class="btn" data-openbot="' + esc(b.appBot || b.id) + '" style="margin-top:10px">Open ' + esc(b.name) + ' hub</button>') + '</div>';
    return h;
  }

  function renderDetail(id) {
    var b = byId(id);
    if (!b) { cur = ''; renderList(); return; }
    var h = '<button class="back" data-tback>‹ Team</button>';
    h += '<div class="tdhead"><div class="tc-name big2">' + esc(b.name) + '</div><span class="tcls-chip">' + b.cls + 'lb</span></div>';
    h += '<div class="status">Team snapshot · ' + esc(D().asOf) + (b.appBot ? ' · live numbers are in the ' + esc(b.name) + ' tabs' : '') + '</div>';
    h += detailBlock(b);
    h += '<div class="sectiontitle pad">Fights · newest first</div>' + fightsHtml(b);
    if (b.history) {
      h += '<div class="sectiontitle pad">History · ' + esc(b.history.name) + '</div><div class="note pad" style="margin-bottom:8px">An earlier Phantom, kept as history and not counted in the team totals.</div>' +
        detailBlock(b.history, true) + fightsHtml(b.history);
    }
    h += '<div class="note pad">' + esc(D().method) + '</div>' + creditsHtml();
    el.innerHTML = h;
  }

  function creditsHtml() {
    return '<div class="card credit tcredit"><h3>Credits</h3><div class="note credits">' +
      '<b>Fight data</b>: <a href="https://brettzone.nhrl.io" target="_blank" rel="noopener">BrettZone (brettzone.nhrl.io)</a> by <b>NHRL</b>.<br>' +
      '<b>Older fights, specs and builders</b>: <a href="https://wiki.nhrl.io/" target="_blank" rel="noopener">NHRL wiki</a> (each bot’s Full Fight History). Team lineup: <a href="https://www.nhrl.io/meet-the-teams" target="_blank" rel="noopener">nhrl.io/meet-the-teams</a>. Some builders and weapons come from the <a href="https://brettzone.nhrl.io/brettZone/v2/heros" target="_blank" rel="noopener">BrettZone Hero’s Gallery</a>, <a href="https://www.robotcombatevents.com/" target="_blank" rel="noopener">Robot Combat Events</a>, the <a href="https://www.buildersdb.com/" target="_blank" rel="noopener">Builders Database</a> and builders’ own pages (credited on each robot).<br>' +
      '<b>Team</b>: Too Hot to Handle / Too Hot Robotics, captained by <b>Brian Boxell</b>. The look follows his <a href="https://github.com/bdboxell/robocalc" target="_blank" rel="noopener">ROBO CALC</a> (our own CSS).<br>' +
      '<b>Ratings</b>: <a href="https://kodex.bot" target="_blank" rel="noopener">KO-dex</a>, an independent fan project (Supernova and Blink, snapshot).<br>' +
      '<b>Ember calculators</b>: <a href="https://level5robotics.com" target="_blank" rel="noopener">Level 5 Robotics</a>.</div></div>';
  }

  function render() { if (!el || !D()) return; cur ? renderDetail(cur) : renderList(); }
  window.TeamView = {
    init: function (node) {
      el = node;
      el.addEventListener('click', function (e) {
        var f = e.target.closest('[data-tfilter]'); if (f) { filter = f.dataset.tfilter; renderList(); return; }
        var c = e.target.closest('[data-team]'); if (c) { e.preventDefault(); var b = byId(c.dataset.team); window.App.switchBot(b && b.appBot ? b.appBot : c.dataset.team); return; }
        var pl = e.target.closest('[data-plan]'); if (pl) { window.App.switchBot('plan-' + pl.dataset.plan); return; }
        var sd = e.target.closest('[data-tdetail]'); if (sd) { e.preventDefault(); window.App.navigate('#team/' + sd.dataset.tdetail, true); return; }
        if (e.target.closest('[data-tback]')) { window.App.back('#team'); return; }
        var o = e.target.closest('[data-openbot]'); if (o) { window.App.switchBot(o.dataset.openbot); return; }
      });
      render();
    },
    open: function (sub) { cur = sub || ''; render(); },
    render: render
  };
})();
