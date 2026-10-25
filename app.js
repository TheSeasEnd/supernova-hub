/* Combat robot stats PWA (Supernova first; multi-bot ready via bots.js).
   All stats are computed client-side from the BrettZone fights list.
   Data: BrettZone public API (brettzone.nhrl.io) by NHRL. */
(function () {
  'use strict';
  var API = 'https://brettzone.nhrl.io/brettZone/api.php';
  var MIN_GAP_MS = 5000, AUTO_MS = 60000;
  var TZ = 'America/New_York';
  var TABS = ['overview', 'fights', 'archetypes', 'calc', 'more'];

  var BOTS = window.BOTS || [];
  var bot = null; // current bot config
  var state = { data: null, fetchedAt: null, source: 'snapshot', rounds: {}, error: null, loading: false, F: [], ff: [], s: null };

  /* ---------- utils ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function $(id) { return document.getElementById(id); }
  function key(k) { return 'sn_' + bot.id + '_' + k; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fmtDate(ts, opts) { return new Date(ts * 1000).toLocaleDateString('en-US', Object.assign({ timeZone: TZ }, opts || { month: 'short', day: 'numeric', year: 'numeric' })); }
  function fmtTime(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) + ' ET'; }
  function fmtStamp(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET'; }
  function ago(iso) { var s = Math.round((Date.now() - new Date(iso)) / 1000); if (!isFinite(s)) return ''; if (s < 10) return 'just now'; if (s < 60) return s + 's ago'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; }
  function secs(n) { return Math.round(n) + 's'; }
  function mmss(n) { n = Math.round(n); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); }
  function fightUrl(f) { return 'https://brettzone.nhrl.io/brettZone/v2/f/' + encodeURIComponent(f.gameID) + '?tournamentID=' + encodeURIComponent(f.tournamentID); }
  function botUrl(clean) { return 'https://brettzone.nhrl.io/brettZone/v2/b/' + encodeURIComponent(clean); }

  /* ---------- data & stats ---------- */
  function normalise(raw) {
    var me0 = bot.apiName;
    return ((raw && raw.fights) || []).map(function (f) {
      var me = String(f.player1clean).toLowerCase() === me0 ? 1 : 2, op = 3 - me;
      return {
        tournamentID: f.tournamentID, tournamentName: f.tournamentName, gameID: f.gameID, name: f.name, round: +f.round,
        opp: f['player' + op], oppClean: f['player' + op + 'clean'],
        won: +f['player' + me + 'wins'] > +f['player' + op + 'wins'], method: f.winAnnotation || '',
        start: +f.startTime, length: +f.matchLength
      };
    }).filter(function (f) { return f.start > 0 && f.method !== 'FF'; }).sort(function (a, b) { return a.start - b.start; });
  }
  // Forfeits: BrettZone lists some with no start time / matchLength; never counted in stats.
  function forfeits(raw) {
    var me0 = bot.apiName;
    return ((raw && raw.fights) || []).filter(function (f) { return !(+f.startTime > 0) || f.winAnnotation === 'FF'; }).map(function (f) {
      var me = String(f.player1clean).toLowerCase() === me0 ? 1 : 2, op = 3 - me;
      return { tournamentID: f.tournamentID, gameID: f.gameID, opp: f['player' + op], won: +f['player' + me + 'wins'] > +f['player' + op + 'wins'] };
    });
  }

  function stageLabel(f) {
    var rn = state.rounds[f.tournamentID + '/' + f.gameID];
    if (rn) return rn;
    var m = /^Q(\d+)([WL]?)/.exec(f.name || '');
    if (m) return 'Qualifier R' + m[1] + (m[2] === 'W' ? ' (winners)' : m[2] === 'L' ? ' (losers)' : '');
    if (/^W:/.test(f.name)) return 'Bracket R' + (f.round + 1);
    if (/^L:/.test(f.name)) return 'Losers bracket R' + (f.round + 1);
    return f.name ? 'Game ' + f.name : '';
  }

  function computeStats(F) {
    var s = { n: F.length, w: 0, l: 0, winBy: { KO: 0, TO: 0, JD: 0 }, lossBy: { KO: 0, TO: 0, JD: 0 }, total: 0, bestStreak: 0 };
    var run = 0;
    F.forEach(function (f) {
      if (f.won) { s.w++; if (f.method in s.winBy) s.winBy[f.method]++; run++; s.bestStreak = Math.max(s.bestStreak, run); }
      else { s.l++; if (f.method in s.lossBy) s.lossBy[f.method]++; run = 0; }
      s.total += f.length;
    });
    s.rate = s.n ? s.w / s.n : 0;
    var cur = 0, type = null;
    for (var i = F.length - 1; i >= 0; i--) { var t = F[i].won ? 'W' : 'L'; if (type === null) type = t; if (t !== type) break; cur++; }
    s.streak = type ? { type: type, n: cur } : null;
    s.last5 = F.slice(-5).map(function (f) { return f.won ? 'W' : 'L'; });
    s.avg = s.n ? s.total / s.n : 0;
    var lens = F.map(function (f) { return f.length; }), minL = Math.min.apply(null, lens), maxL = Math.max.apply(null, lens);
    s.shortest = F.filter(function (f) { return f.length === minL; });
    s.longest = F.filter(function (f) { return f.length === maxL; });
    s.fastestKO = F.filter(function (f) { return f.won && f.method === 'KO'; }).sort(function (a, b) { return a.length - b.length; })[0] || null;
    var ev = {}, order = [];
    F.forEach(function (f) { if (!ev[f.tournamentID]) { ev[f.tournamentID] = { id: f.tournamentID, name: f.tournamentName, fights: [], w: 0, l: 0 }; order.push(f.tournamentID); } var e = ev[f.tournamentID]; e.fights.push(f); f.won ? e.w++ : e.l++; });
    s.events = order.map(function (id) { var e = ev[id], last = e.fights[e.fights.length - 1]; e.date = e.fights[0].start; e.lastStage = stageLabel(last); e.lastWon = last.won; return e; });
    var op = {}; F.forEach(function (f) { var o = op[f.oppClean] || (op[f.oppClean] = { name: f.opp, clean: f.oppClean, w: 0, l: 0 }); f.won ? o.w++ : o.l++; });
    s.opponents = Object.keys(op).map(function (k) { return op[k]; });
    return s;
  }

  function placement(e) {
    var st = e.lastStage || '';
    if (/^Final/i.test(st)) return e.lastWon ? { text: 'Champion', cls: 'gold' } : { text: 'Runner-up', cls: 'silver' };
    if (/^Qualifier/i.test(st)) return { text: 'Out in qualifying (' + st.replace('Qualifier ', '') + ')', cls: '' };
    return { text: (e.lastWon ? 'Last fight: ' : 'Out in ') + st, cls: '' };
  }

  /* ---------- shared bits ---------- */
  function statusLine() {
    var live = state.source === 'live' && !state.error;
    var label = state.source === 'live' ? 'Live' : state.source === 'cache' ? 'Saved' : 'Offline snapshot';
    return '<div class="status' + (state.error ? ' warn' : '') + '"><span class="dot-live' + (live ? ' on' : '') + '"></span>' + label +
      (state.fetchedAt ? ' · updated <span data-ago>' + ago(state.fetchedAt) + '</span> (' + fmtTime(state.fetchedAt) + ')' : '') +
      (state.error ? ' · BrettZone unreachable, showing saved data' : '') + (state.loading ? ' · refreshing…' : '') + '</div>';
  }
  function bzFooter() {
    return '<div class="foot">Fight data from <a href="https://brettzone.nhrl.io" target="_blank" rel="noopener">BrettZone (brettzone.nhrl.io)</a> by NHRL</div>';
  }
  function archChip(clean) {
    if (!window.Archetypes || !window.Archetypes.ready()) return '';
    var a = window.Archetypes.forOpponent(clean);
    return '<span class="achip' + (a.id === 'unknown' ? ' unk' : '') + '">' + esc(a.short) + '</span>';
  }

  /* ---------- screens ---------- */

  // ---- KO-dex (bundled snapshot from data/kodex.js; the app never calls kodex.bot) ----
  function kxFight(f) { var k = bot.kodex; return k && k.fights ? k.fights[f.tournamentID + '|' + f.gameID] : null; }
  function kxDelta(d) { return '<span class="kxd ' + (d >= 0 ? 'up' : 'dn') + '">' + (d >= 0 ? '▲ +' : '▼ ') + d + '</span>'; }
  function kxLabel() { return esc((window.KODEX && window.KODEX.label) || 'KO-dex snapshot — not live'); }
  function kxCredit() { return esc((window.KODEX && window.KODEX.credit) || ''); }
  function renderKodexCard(s) {
    var k = bot.kodex; if (!k) return '';
    var rec = k.record;
    return '<div class="card kodex"><div class="kxhead"><h2>KO-dex rating</h2><span class="kxtag">' + kxLabel() + '</span></div>' +
      '<div class="grid2"><div class="stat"><div class="v">' + k.current.rating + '<small> ±' + k.current.rd + '</small></div><div class="k">Current rating</div><div class="s">#' + k.current.rank + ' of ' + k.current.of + ' in ' + esc(k.weightLabel) + ' · ' + esc(k.current.status) + '</div></div>' +
      '<div class="stat"><div class="v">' + k.alltime.rating + '<small> ±' + k.alltime.rd + '</small></div><div class="k">All-time rating</div><div class="s">#' + k.alltime.rank + ' of ' + k.alltime.of + ' in ' + esc(k.weightLabel) + ' · ' + esc(k.alltime.status) + '</div></div></div>' +
      '<div class="kv kxkv"><div>Peak (all-time)</div><div><b>' + k.peak.rating + '</b> · ' + esc(k.peak.date) + '</div>' +
      '<div>KO-dex type</div><div><b>' + esc(k.type.name) + '</b><br><span class="note">' + esc(k.type.desc) + '</span></div>' +
      '<div>Badges</div><div>' + k.badges.map(function (b) { return '<span class="kxbadge">' + esc(b.name) + (b.count > 1 ? ' ×' + b.count : '') + '</span> <span class="note">earned ' + esc(b.earned) + '</span>'; }).join('<br>') + '</div>' +
      '<div>Best win</div><div>' + kxDelta(k.bestWin.delta) + ' vs ' + esc(k.bestWin.opp) + '</div>' +
      '<div>KO-dex’s record</div><div><b>' + rec.w + '–' + rec.l + '</b> <span class="note">(KO-dex’s number)</span></div></div>' +
      '<div class="note" style="margin-top:8px">KO-dex’s ' + rec.w + '–' + rec.l + ' includes forfeits. ' + esc(rec.note) + ' This app’s own record above is <b>' + s.w + '–' + s.l + '</b>, computed from BrettZone fights with a fight time.</div>' +
      '<a class="btn kxbtn" href="' + esc(k.url) + '" target="_blank" rel="noopener">Open ' + esc(bot.name) + ' on KO-dex ↗</a>' +
      '<div class="note kxcredit">' + kxCredit() + '. Per-fight rating changes are shown in Fights.</div></div>';
  }
  function renderOverview() {
    var s = state.s, F = state.F, el = $('view-overview');
    if (!F.length) { el.innerHTML = statusLine() + '<div class="card">No fight data yet.</div>'; return; }
    var hero = bot.snapshot && bot.snapshot.heroImage, r = bot.rank;
    var h = statusLine();
    h += '<div class="card hero">' + (hero ? '<img src="' + esc(hero) + '" alt="' + esc(bot.name) + ' (BrettZone still)" onerror="this.remove()">' : '') +
      '<div class="ov"></div><div class="cap"><div>' + (r ? '<div class="rank">' + esc(r.label) + '</div><div class="rank"><b>#' + r.value + '</b> <span class="asof">as of ' + esc(r.asOf) + '</span></div>' : '') + '</div>' +
      '<div class="rank" style="text-align:right">' + s.events.length + ' events<br>' + s.n + ' fights</div></div></div>';
    h += '<div class="card"><div class="record"><div><div class="k2">Record</div><div class="big"><span class="w">' + s.w + '</span><span class="d">–</span><span class="l">' + s.l + '</span></div></div>' +
      '<div class="stat" style="margin-left:auto;text-align:right"><div class="v">' + (s.rate * 100).toFixed(1) + '%</div><div class="k">Win rate</div></div></div>' +
      (bot.recordFootnote ? '<details class="fn"><summary>' + esc(bot.footnoteTitle || 'About this record') + '</summary><div class="note">' + bot.recordFootnote + '</div></details>' : '') + '</div>';
    h += renderKodexCard(s);
    h += '<div class="grid2"><div class="card stat"><div class="v ' + (s.streak && s.streak.type === 'W' ? 'win' : 'loss') + '">' + (s.streak ? s.streak.type + s.streak.n : '—') + '</div><div class="k">Current streak</div></div>' +
      '<div class="card stat"><div class="v win">W' + s.bestStreak + '</div><div class="k">Best win streak</div></div></div>';
    h += '<div class="card"><h2>Last 5</h2><div class="form">' + s.last5.map(function (x) { return '<div class="pill ' + x + '">' + x + '</div>'; }).join('') + '<span class="arrow">← latest</span></div></div>';
    var tw = s.w || 1;
    h += '<div class="card"><h2>How the wins came</h2><div class="grid3">' +
      ['KO', 'TO', 'JD'].map(function (m) { return '<div class="mini stat"><div class="v" style="color:var(--' + m.toLowerCase() + ')">' + s.winBy[m] + '</div><div class="k">' + m + '</div></div>'; }).join('') + '</div>' +
      '<div class="bar">' + ['KO', 'TO', 'JD'].map(function (m) { return '<span class="' + m.toLowerCase() + '" style="width:' + (s.winBy[m] / tw * 100) + '%"></span>'; }).join('') + '</div>' +
      '<div class="note">KO knockout · TO tap-out · JD judges’ decision</div></div>';
    h += '<div class="card"><h2>Losses</h2><div class="grid2"><div class="stat"><div class="v loss">' + s.lossBy.KO + '</div><div class="k">KO losses</div></div>' +
      '<div class="stat"><div class="v">' + (s.lossBy.JD + s.lossBy.TO) + '</div><div class="k">JD / TO losses</div><div class="s">' + s.lossBy.JD + ' JD · ' + s.lossBy.TO + ' TO</div></div></div></div>';
    function who(arr) { return arr.map(function (f) { return 'vs ' + esc(f.opp); }).join(', '); }
    h += '<div class="card"><h2>Fight time</h2><div class="grid3">' +
      '<div class="stat"><div class="v">' + secs(s.avg) + '</div><div class="k">Average</div><div class="s">' + mmss(s.avg) + '</div></div>' +
      '<div class="stat"><div class="v">' + secs(s.shortest[0].length) + '</div><div class="k">Shortest</div><div class="s">' + who(s.shortest) + '</div></div>' +
      '<div class="stat"><div class="v">' + secs(s.longest[0].length) + '</div><div class="k">Longest</div><div class="s">' + who(s.longest) + '</div></div></div>' +
      (s.fastestKO ? '<div class="note" style="margin-top:10px">Fastest KO win: ' + secs(s.fastestKO.length) + ' vs ' + esc(s.fastestKO.opp) + '.</div>' : '') + '</div>';
    var rep = s.opponents.filter(function (o) { return o.w + o.l > 1; });
    if (rep.length) h += '<div class="card"><h2>Rematches</h2>' + rep.map(function (o) { return '<div class="kv"><div>' + esc(o.name) + '</div><div><b>' + o.w + '–' + o.l + '</b></div></div>'; }).join('') + '</div>';
    h += '<a class="card linkcard" href="#archetypes" data-nav="archetypes"><span>Archetype matchups: who is ' + esc(bot.name) + ' weak against?</span><span class="chev">›</span></a>';
    h += bzFooter();
    el.innerHTML = h;
  }

  function fightRow(f) {
    var r = f.won ? 'W' : 'L', kx = kxFight(f);
    return '<a class="fight ' + r + '" href="' + fightUrl(f) + '" target="_blank" rel="noopener">' +
      '<div class="res ' + (f.won ? 'win' : 'loss') + '">' + r + '</div>' +
      '<div class="mid"><div class="opp">' + esc(f.opp) + '</div><div class="rd">' + esc(stageLabel(f)) + ' · ' + archChip(f.oppClean) + '</div>' + (kx ? '<div class="kxrow">KO-dex ' + kxDelta(kx.d) + ' → ' + kx.after + '</div>' : '') + '</div>' +
      '<div class="right"><span class="method ' + esc(f.method) + '">' + esc(f.method || '—') + '</span><span class="len">' + secs(f.length) + '</span></div><span class="ext">↗</span></a>';
  }

  var fightsSeg = 'list';
  function renderFights() {
    var s = state.s, el = $('view-fights');
    if (!state.F.length) { el.innerHTML = statusLine(); return; }
    var h = statusLine() + '<div class="seg big" role="tablist"><button data-seg="list" class="' + (fightsSeg === 'list' ? 'on' : '') + '">All fights</button><button data-seg="events" class="' + (fightsSeg === 'events' ? 'on' : '') + '">Events</button></div>';
    if (fightsSeg === 'list') {
      if (bot.kodex) h += '<div class="note kxlistnote">KO-dex ▲/▼ = change in KO-dex’s all-time rating after each fight → new rating. ' + kxLabel() + '. <a href="' + esc(bot.kodex.url) + '" target="_blank" rel="noopener">KO-dex ↗</a></div>';
      s.events.slice().reverse().forEach(function (e) {
        var ff = state.ff.filter(function (x) { return x.tournamentID === e.id; });
        var known = {}; e.fights.concat(ff).forEach(function (x) { if (x.gameID) known[e.id + '|' + x.gameID] = 1; });
        var kxOnly = bot.kodex ? Object.keys(bot.kodex.fights).filter(function (k2) { return k2.indexOf(e.id + '|') === 0 && !known[k2]; }).map(function (k2) { return bot.kodex.fights[k2]; }) : [];
        h += '<div class="event"><div class="eventhead"><h3>' + esc(e.name.replace(/^NHRL /, '')) + '</h3><span class="meta">' + fmtDate(e.date) + ' · ' + e.w + '–' + e.l + '</span></div>' + e.fights.slice().reverse().map(fightRow).join('') +
          (ff.length ? '<div class="note ffnote">Forfeit' + (ff.length > 1 ? 's' : '') + ' (not counted): ' + ff.map(function (x) { var k3 = kxFight(x); return (x.won ? 'W' : 'L') + ' vs ' + esc(x.opp) + (k3 ? ' (KO-dex ' + kxDelta(k3.d) + ')' : ''); }).join(', ') + '</div>' : '') +
          (kxOnly.length ? '<div class="note ffnote">Only on KO-dex (not in BrettZone’s fight list, not counted): ' + kxOnly.map(function (x) { return x.r + ' ' + esc(x.m) + ' vs ' + esc(x.opp) + ' (' + kxDelta(x.d) + ')'; }).join(', ') + '</div>' : '') + '</div>';
      });
      h += '<div class="note pad">Newest first. Tap a fight to watch it on BrettZone.</div>';
    } else {
      s.events.slice().reverse().forEach(function (e) {
        var p = placement(e), ko = e.fights.filter(function (f) { return f.won && f.method === 'KO'; }).length, kod = e.fights.filter(function (f) { return !f.won && f.method === 'KO'; }).length;
        var seed = bot.snapshot && bot.snapshot.seeds && bot.snapshot.seeds[e.id];
        h += '<div class="card evcard"><div class="row"><div><h3>' + esc(e.name.replace(/^NHRL /, '')) + '</h3><div class="date">' + fmtDate(e.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + '</div></div>' +
          '<div class="rec"><span class="win">' + e.w + '</span><span class="dash">–</span><span class="loss">' + e.l + '</span></div></div>' +
          '<span class="badge ' + p.cls + '">' + esc(p.text) + '</span>' +
          '<div class="note" style="margin-top:8px">' + e.fights.length + ' fights · ' + ko + ' KO win' + (ko === 1 ? '' : 's') + ' · ' + kod + ' KO loss' + (kod === 1 ? '' : 'es') + (seed ? ' · seed ' + seed : '') + '</div>' +
          '<div class="chips">' + e.fights.map(function (f) { return '<span class="chip ' + (f.won ? 'W' : 'L') + '">' + (f.won ? 'W' : 'L') + ' ' + esc(f.opp) + '</span>'; }).join('') + '</div>' +
          (bot.eventNotes && bot.eventNotes[e.id] ? '<div class="note" style="margin-top:8px">' + esc(bot.eventNotes[e.id]) + '</div>' : '') + '</div>';
      });
    }
    h += bzFooter();
    el.innerHTML = h;
  }

  function renderMore() {
    var el = $('view-more'), snap = bot.snapshot, auto = lsGet('sn_auto_refresh') !== false;
    var h = '';
    h += '<div class="card"><h2>Data</h2>' + statusLine().replace('class="status', 'class="status left') +
      '<div class="setrow"><div><div class="st">Auto-refresh</div><div class="note">Every 60 s while the app is open, plus when you return to it.</div></div><label class="switch"><input type="checkbox" id="autoToggle"' + (auto ? ' checked' : '') + '><span></span></label></div>' +
      '<div class="setrow"><div><div class="st">Refresh now</div><div class="note">Or pull down on any data screen. At most one request every 5 s.</div></div><button class="btn sm" data-refresh>Refresh</button></div>' +
      '<div class="note">Bundled offline snapshot: ' + (snap ? esc(fmtStamp(snap.fetchedAt)) : 'none') + '. ' +
      (bot.rank ? 'Rank #' + bot.rank.value + ' is from <a href="' + bot.rank.url + '" target="_blank" rel="noopener">BrettZone rankings</a> as of ' + esc(bot.rank.asOf) + '. It isn’t live: the API has no rankings endpoint, and its wins leaderboard counts fights differently.' : '') + '</div></div>';
    h += '<div class="sectiontitle pad">Credits</div>';
    h += '<div class="card credit"><h3>Fight data · BrettZone</h3><p>Fight data from <b>BrettZone (brettzone.nhrl.io)</b> by <b>NHRL</b>. Every stat here is computed from BrettZone’s public fight list.</p>' +
      '<div class="links"><a class="btn" href="https://brettzone.nhrl.io" target="_blank" rel="noopener">brettzone.nhrl.io ↗</a><a class="btn ghost" href="' + botUrl(bot.apiName) + '" target="_blank" rel="noopener">' + esc(bot.name) + ' on BrettZone ↗</a></div></div>';
    if (bot.kodex) h += '<div class="card credit"><h3>Ratings · KO-dex</h3><p>' + kxCredit() + '.</p><p class="note">' + kxLabel() + '. Values are bundled in the app; it never calls kodex.bot.</p>' +
      '<div class="links"><a class="btn" href="' + esc(bot.kodex.url) + '" target="_blank" rel="noopener">' + esc(bot.name) + ' on KO-dex ↗</a><a class="btn ghost" href="https://kodex.bot" target="_blank" rel="noopener">kodex.bot ↗</a></div></div>';
    h += '<div class="card credit"><h3>ROBO CALC</h3><p><b>ROBO CALC — Combat Robotics Calculator Tool</b> by <b>Brian Boxell, Too Hot Robotics</b>. Embedded live from his site; no code copied. This app’s look is inspired by ROBO CALC (our own CSS).</p>' +
      '<div class="links"><a class="btn" href="https://github.com/bdboxell/robocalc" target="_blank" rel="noopener">github.com/bdboxell/robocalc ↗</a></div></div>';
    h += '<div class="card"><h2>More credits</h2><div class="note credits">' +
      '<b>Archetypes &amp; robot info</b>: <a href="https://wiki.nhrl.io/" target="_blank" rel="noopener">NHRL wiki</a> (weapon-type categories, robot pages), <a href="https://robotcombatwiki.com/wiki/Weapons" target="_blank" rel="noopener">RobotCombatWiki</a>, and <a href="https://wiki.combatrobots.org/" target="_blank" rel="noopener">Combat Robots Wiki</a> (definitions and general strengths and weaknesses).<br>' +
      '<b>Ember</b> calculators by <a href="https://level5robotics.com" target="_blank" rel="noopener">Level 5 Robotics</a> with the SCAR community.<br>' +
      '<b>Pulley &amp; Belt Calculator</b> by <a href="https://www.fingertechrobotics.com/how-to_pulley_belt.php" target="_blank" rel="noopener">FingerTech Robotics</a> · <b>Center Distance Designer</b> by <a href="https://sdp-si.com/tools/center-distance-designer.php" target="_blank" rel="noopener">SDP/SI</a> · <b>Belt Tension</b> by <a href="https://calculators.gates.com/BeltTension" target="_blank" rel="noopener">Gates</a>.<br>' +
      '<b>Battery Sag / Max Amps</b>: built into this app with our own simple Ohm’s-law estimate.<br>' +
      '<b>Ratings &amp; fight types</b>: ' + kxCredit() + ' (<a href="https://kodex.bot" target="_blank" rel="noopener">kodex.bot</a>). ' + kxLabel() + '.<br>' +
      '<b>Font</b>: Chakra Petch (SIL Open Font License), self-hosted.</div></div>';
    if (bot.specs) h += '<div class="card"><h2>' + esc(bot.name) + '</h2><div class="kv">' + bot.specs.map(function (kv) { return '<div>' + esc(kv[0]) + '</div><div>' + esc(kv[1]) + '</div>'; }).join('') + '</div>' +
      '<div class="note" style="margin-top:8px">Specs from the <a href="' + bot.wikiUrl + '" target="_blank" rel="noopener">NHRL wiki</a>. Hero photo: BrettZone still.</div></div>';
    h += '<div class="card"><h2>About</h2><div class="note">A personal, unofficial stats app, not affiliated with NHRL. Add it to your home screen: Safari → Share → “Add to Home Screen”, or Chrome → ⋮ → “Install app”.</div></div>';
    el.innerHTML = h;
  }

  function renderArchetypes() {
    if (window.Archetypes) window.Archetypes.render($('view-archetypes'), { bot: bot, F: state.F, status: statusLine(), footer: bzFooter(), esc: esc, fmtDate: fmtDate, fightUrl: fightUrl, onChange: renderAll });
  }

  function renderAll() {
    state.F = normalise(state.data); state.ff = forfeits(state.data);
    state.s = state.F.length ? computeStats(state.F) : null;
    window.__stats = state.s; window.__fights = state.F;
    renderOverview(); renderFights(); renderArchetypes(); renderMore();
  }

  /* ---------- fetching / live updates ---------- */
  function getJSON(path) {
    // BrettZone asks apps to send an X-API-Key header, but its CORS preflight only allows Content-Type,
    // so browsers block that header. We send a plain CORS GET (open CORS, no auth needed).
    return fetch(API + path, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  var lastReq = 0;
  function refresh() {
    if (!bot || state.loading) return Promise.resolve(false);
    if (Date.now() - lastReq < MIN_GAP_MS) return Promise.resolve(false);
    lastReq = Date.now();
    state.loading = true; $('refreshBtn').classList.add('spin'); updateStatus();
    var b = bot;
    return getJSON('/bots/' + encodeURIComponent(b.apiName) + '/fights').then(function (d) {
      if (b !== bot) return;
      if (!d || !Array.isArray(d.fights)) throw new Error('bad payload');
      state.data = d; state.fetchedAt = new Date().toISOString(); state.source = 'live'; state.error = null;
      lsSet(key('fights'), { fetchedAt: state.fetchedAt, data: d });
    }).catch(function (e) { state.error = String(e); })
      .then(function () { state.loading = false; $('refreshBtn').classList.remove('spin'); renderAll(); return fillMissingRounds(); });
  }

  // Round names (e.g. "Semifinals") come from /stats/fight. Fetch only unseen bracket fights, spaced ≥5 s apart.
  function fillMissingRounds() {
    var todo = state.F.filter(function (f) { return /^[WL]:/.test(f.name) && !state.rounds[f.tournamentID + '/' + f.gameID]; }).slice(0, 4);
    var chain = Promise.resolve(), changed = false;
    todo.forEach(function (f) {
      chain = chain.then(function () { return new Promise(function (res) { setTimeout(res, MIN_GAP_MS); }); })
        .then(function () { return getJSON('/stats/fight/' + encodeURIComponent(f.tournamentID) + '/' + encodeURIComponent(f.gameID)); })
        .then(function (d) { var rn = d && d.fightStats && d.fightStats.roundName; if (rn) { state.rounds[f.tournamentID + '/' + f.gameID] = rn; changed = true; } })
        .catch(function () {});
    });
    return chain.then(function () { if (changed) { lsSet(key('rounds'), state.rounds); renderAll(); } });
  }

  function updateStatus() { document.querySelectorAll('[data-ago]').forEach(function (n) { if (state.fetchedAt) n.textContent = ago(state.fetchedAt); }); }

  var timer = null;
  function startAuto() {
    clearInterval(timer);
    timer = setInterval(function () {
      updateStatus();
      if (document.visibilityState === 'visible' && lsGet('sn_auto_refresh') !== false && Date.now() - lastReq >= AUTO_MS) refresh();
    }, 10000);
  }

  /* ---------- bots ---------- */
  function loadBot(id) {
    var b = BOTS.filter(function (x) { return x.id === id && x.enabled; })[0] || BOTS.filter(function (x) { return x.enabled; })[0];
    bot = b; localStorage.setItem('sn_current_bot', b.id);
    if (window.Archetypes) window.Archetypes.setBot(b.id);
    if (window.RobotProfile) window.RobotProfile.use(b.id, b.profileDefaults);
    if (window.Calcs) window.Calcs.rerender();
    state = { data: null, fetchedAt: null, source: 'snapshot', rounds: {}, error: null, loading: false, F: [], ff: [], s: null };
    var snap = b.snapshot;
    if (snap && snap.roundNames) Object.keys(snap.roundNames).forEach(function (k) { if (snap.roundNames[k]) state.rounds[k] = snap.roundNames[k]; });
    var saved = lsGet(key('rounds')) || {}; Object.keys(saved).forEach(function (k) { state.rounds[k] = saved[k]; });
    var cached = lsGet(key('fights'));
    if (cached && cached.data && cached.data.fights) { state.data = cached.data; state.fetchedAt = cached.fetchedAt; state.source = 'cache'; }
    else if (snap) { state.data = snap.data; state.fetchedAt = snap.fetchedAt; state.source = 'snapshot'; }
    $('botName').innerHTML = esc(b.name.slice(0, Math.ceil(b.name.length / 2))) + '<span>' + esc(b.name.slice(Math.ceil(b.name.length / 2))) + '</span>';
    $('botSub').textContent = b.subtitle || '';
    document.title = b.name + ' · NHRL ' + (b.weightClass || '') + 'lb';
    renderAll();
    lastReq = 0; refresh();
  }

  function openSheet() {
    var cur = bot.id;
    $('sheetBody').innerHTML = '<div class="sheettitle">Switch robot</div>' + BOTS.map(function (b) {
      return '<button class="sheetitem' + (b.id === cur ? ' on' : '') + '"' + (b.enabled ? ' data-bot="' + b.id + '"' : ' disabled') + '><span>' + esc(b.name) + '</span><span class="note">' + (b.enabled ? (b.id === cur ? 'Current' : esc(b.subtitle || '')) : 'Coming soon') + '</span></button>';
    }).join('') + '<button class="sheetitem cancel" data-close>Close</button>';
    $('sheet').hidden = false; requestAnimationFrame(function () { $('sheet').classList.add('open'); });
  }
  function closeSheet() { $('sheet').classList.remove('open'); setTimeout(function () { $('sheet').hidden = true; }, 180); }

  /* ---------- router (hash: #tab or #tab/sub) ---------- */
  function parse(hash) { var p = (hash || '').replace(/^#/, '').split('/'); var tab = TABS.indexOf(p[0]) >= 0 ? p[0] : 'overview'; return { tab: tab, sub: p[1] || '' }; }
  function route() {
    var r = parse(location.hash);
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === r.tab); b.setAttribute('aria-selected', b.dataset.tab === r.tab); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + r.tab); });
    if (r.tab === 'calc' && window.Calcs) window.Calcs.open(r.sub || 'list');
    window.scrollTo(0, 0);
  }
  // Tab switches replace history (no long back stacks); sub-pages push so the phone's back gesture returns.
  function navigate(hash, push) {
    if (location.hash === hash) { route(); return; }
    if (push) history.pushState({ sub: true }, '', hash); else history.replaceState(null, '', hash);
    route();
  }
  function back(fallback) { if (history.state && history.state.sub) history.back(); else navigate(fallback, false); }
  window.App = { navigate: navigate, back: back };

  /* ---------- wiring ---------- */
  function setupPTR() {
    var startY = null, dy = 0, ptr = $('ptr');
    window.addEventListener('touchstart', function (e) { var v = document.querySelector('.view.active'); if (window.scrollY <= 0 && v && v.id !== 'view-calc' && !$('sheet').classList.contains('open')) { startY = e.touches[0].clientY; dy = 0; } }, { passive: true });
    window.addEventListener('touchmove', function (e) { if (startY === null) return; dy = e.touches[0].clientY - startY; if (dy > 0) { ptr.style.height = Math.min(dy / 2, 44) + 'px'; ptr.textContent = dy > 90 ? 'Release to refresh' : 'Pull to refresh'; } }, { passive: true });
    window.addEventListener('touchend', function () { if (startY === null) return; var go = dy > 90; startY = null; ptr.style.height = '0'; if (go) refresh(); });
  }

  function init() {
    if (window.Calcs) window.Calcs.init($('view-calc'));
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { var r = parse(location.hash); navigate('#' + b.dataset.tab, false); if (r.tab === b.dataset.tab) window.scrollTo({ top: 0, behavior: 'smooth' }); });
    });
    document.addEventListener('click', function (e) {
      var n = e.target.closest('[data-nav]'); if (n) { e.preventDefault(); navigate('#' + n.dataset.nav, false); return; }
      var sg = e.target.closest('[data-seg]'); if (sg) { fightsSeg = sg.dataset.seg; renderFights(); return; }
      if (e.target.closest('[data-refresh]')) { refresh(); return; }
      var bb = e.target.closest('[data-bot]'); if (bb) { closeSheet(); if (bb.dataset.bot !== bot.id) loadBot(bb.dataset.bot); return; }
      if (e.target.closest('[data-close]') || e.target.id === 'sheet') { closeSheet(); return; }
    });
    document.addEventListener('change', function (e) { if (e.target.id === 'autoToggle') { lsSet('sn_auto_refresh', e.target.checked); } });
    $('refreshBtn').addEventListener('click', function () { refresh(); });
    $('botSwitch').addEventListener('click', openSheet);
    window.addEventListener('popstate', route);
    setupPTR();
    if (window.Archetypes) window.Archetypes.load().then(function () { renderAll(); });
    loadBot(localStorage.getItem('sn_current_bot') || 'supernova');
    route();
    startAuto();
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { updateStatus(); refresh(); } });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  init();
})();
