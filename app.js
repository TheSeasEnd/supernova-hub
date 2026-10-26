/* Too Hot to Handle Hub: combat robot stats PWA for every robot on team Too Hot to Handle (bots.js).
   All stats are computed client-side from the BrettZone fights list.
   Data: BrettZone public API (brettzone.nhrl.io) by NHRL. */
(function () {
  'use strict';
  var API = 'https://brettzone.nhrl.io/brettZone/api.php';
  var MIN_GAP_MS = 5000, AUTO_MS = 60000;
  var TZ = 'America/New_York';
  var TABS = ['overview', 'fights', 'team', 'archetypes', 'calc', 'more'];
  var DEEP_MS = 15 * 60000, DEEP_GAP_MS = 1500, DEEP_MAX = 6;

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
  function fightUrl(f) {
    if (f.src === 'w') return f.video || bot.wikiUrl || 'https://wiki.nhrl.io/';
    return 'https://brettzone.nhrl.io/brettZone/v2/f/' + encodeURIComponent(f.gameID) + '?tournamentID=' + encodeURIComponent(f.tournamentID);
  }
  function cleanName(n) { return String(n || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  var SRCTAG = { b: ['BZ', 'BrettZone'], w: ['WIKI', 'NHRL wiki'], x: ['BOTH', 'BrettZone + NHRL wiki'] };
  function teamAsOf() { return (window.TEAM_DATA && window.TEAM_DATA.asOf) || ''; }
  function botUrl(clean) { return 'https://brettzone.nhrl.io/brettZone/v2/b/' + encodeURIComponent(clean); }

  /* ---------- data & stats ---------- */
  // BrettZone's /bots/{bot}/fights misses some decided fights (forfeits, fights with no start time, unlisted events).
  // So the fight list is a union, keyed by tournamentID|gameID (later sources win):
  // bundled complete snapshot (every tournament fight list) < bundled bot-endpoint snapshot < live tournament re-scan < live bot endpoint.
  function completeList() {
    var c = window.COMPLETE_FIGHTS;
    if (c && c.bots && c.bots[bot.id]) return c.bots[bot.id];
    return teamList();
  }
  // Team snapshot fights (data/team.js) -> BrettZone-shaped rows. BrettZone-sourced rows keep their tournamentID|gameID key,
  // so live data merges onto them; wiki-only rows get a wiki:<date> key and are ordered by date.
  var teamCache = {};
  function teamList() {
    var c = bot.team, T = window.TEAM_DATA; if (!c || !T) return [];
    if (teamCache[bot.id]) return teamCache[bot.id];
    var me = bot.apiName;
    var out = c.fights.map(function (f, i) {
      // f = [date, opp, W/L, method, src, eventIdx, wikiRound|stage, flag, tournamentID, gameID, match, round, time, length, video]
      var wiki = f[4] === 'w', t = f[12] || (Date.parse(f[0] + 'T12:00:00-05:00') / 1000 + i);
      return {
        tournamentID: wiki ? 'wiki:' + f[0] : f[8], gameID: wiki ? 'w' + i : f[9], name: wiki ? '' : f[10], round: wiki ? (/^(q|qual|prelim|rival|last chance)/i.test(f[6]) ? -1 : 0) : f[11],
        player1: bot.name, player1clean: me, player2: f[1], player2clean: cleanName(f[1]),
        player1wins: f[2] === 'W' ? 1 : 0, player2wins: f[2] === 'L' ? 1 : 0, winAnnotation: f[3],
        startTime: f[12] && f[13] ? f[12] : 0, endTime: t, matchLength: f[13] || 0,
        tournamentName: wiki ? 'NHRL wiki · ' + fmtDate(t, { month: 'short', day: 'numeric', year: 'numeric' }) : (T.events[f[5]] || f[8]),
        isFreestyle: f[6] === 'e' ? 1 : 0, _src: f[4], _flag: f[7], _wround: wiki ? f[6] : '', _video: f[14] || ''
      };
    });
    teamCache[bot.id] = out; return out;
  }
  function mergedRaw() {
    var m = {}, keys = [], alias = {};
    // Key by tournamentID|gameID; BrettZone sometimes lists one match under two gameIDs, so also alias tournament|match|both robots.
    function add(list) { (list || []).forEach(function (f) {
      if (!f || !f.tournamentID) return;
      var k = f.tournamentID + '|' + f.gameID, a = f.name ? f.tournamentID + '|' + f.name + '|' + [String(f.player1clean || cleanName(f.player1)), String(f.player2clean || cleanName(f.player2))].sort().join('|') : '';
      if (!m[k] && a && alias[a]) k = alias[a];
      if (!m[k]) keys.push(k); if (a && !alias[a]) alias[a] = k;
      m[k] = Object.assign({}, m[k] || {}, f);
    }); }
    add(completeList());
    add(bot.snapshot && bot.snapshot.data && bot.snapshot.data.fights);
    var deep = state.deep && state.deep.extras; if (deep) Object.keys(deep).forEach(function (t) { add(deep[t]); });
    add(state.data && state.data.fights);
    return keys.map(function (k) { return m[k]; });
  }
  function isExhibition(f) { return +f.isFreestyle === 1 || /freestyle|\bxp\b/i.test(f.tournamentName || ''); }
  function normalise(list) {
    var me0 = bot.apiName;
    var F = list.map(function (f) {
      var me = String(f.player1clean).toLowerCase() === me0 ? 1 : 2, op = 3 - me;
      var w = +f['player' + me + 'wins'], l = +f['player' + op + 'wins'], method = f.winAnnotation || '';
      return {
        tournamentID: f.tournamentID, tournamentName: f.tournamentName, gameID: f.gameID, name: f.name, round: +f.round,
        opp: f['player' + op], oppClean: f['player' + op + 'clean'], w: w, l: l,
        won: w > l, method: method, forfeit: method === 'FF' || method === 'DQ', exhibition: isExhibition(f),
        src: f._src || 'b', flag: f._flag || '', wround: f._wround || '', video: f._video || '',
        start: +f.startTime || +f.endTime || 0, noTime: !(+f.startTime > 0),
        // BrettZone reports matchLength = stopTime - 0 for fights with no start time; only trust real lengths.
        length: ((+f.startTime > 0 || f._src === 'w') && +f.matchLength > 0 && +f.matchLength < 1200 && !(method === 'FF' || method === 'DQ')) ? +f.matchLength : 0
      };
    }).filter(function (f) { return f.w + f.l > 0 && f.method !== 'BY' && String(f.oppClean).toLowerCase() !== 'bye'; }); // drop unplayed 0-0 placeholders and byes
    // A fight with no time at all goes to the end of its event (bracket) or the start (qualifying).
    var tmin = {}, tmax = {};
    F.forEach(function (f) { if (f.start) { tmin[f.tournamentID] = Math.min(tmin[f.tournamentID] || Infinity, f.start); tmax[f.tournamentID] = Math.max(tmax[f.tournamentID] || 0, f.start); } });
    F.forEach(function (f) { if (!f.start) f.start = f.round >= 0 ? (tmax[f.tournamentID] || 0) + 1 : (tmin[f.tournamentID] || 0); });
    return F.sort(function (a, b) { return a.start - b.start || String(a.name).localeCompare(String(b.name)); });
  }
  function rec(list) { var w = 0, l = 0; list.forEach(function (f) { f.won ? w++ : l++; }); return { w: w, l: l }; }
  var Y2024 = Date.UTC(2024, 0, 1, 5) / 1000;

  function stageLabel(f) {
    if (f.wround) return f.wround;
    var rn = state.rounds[f.tournamentID + '/' + f.gameID];
    if (rn) return rn;
    var m = /^Q(\d+)([WL]?)/.exec(f.name || '');
    if (m) return 'Qualifier R' + m[1] + (m[2] === 'W' ? ' (winners)' : m[2] === 'L' ? ' (losers)' : '');
    if (/^W:/.test(f.name)) return 'Bracket R' + (f.round + 1);
    if (/^L:/.test(f.name)) return 'Losers bracket R' + (f.round + 1);
    return f.name ? 'Game ' + f.name : '';
  }

  function computeStats(F) {
    var s = { n: F.length, w: 0, l: 0, winBy: { KO: 0, TO: 0, JD: 0, FF: 0 }, lossBy: { KO: 0, TO: 0, JD: 0, FF: 0 }, total: 0, bestStreak: 0 };
    var run = 0;
    F.forEach(function (f) {
      var mk = f.forfeit ? 'FF' : f.method;
      if (f.won) { s.w++; if (mk in s.winBy) s.winBy[mk]++; run++; s.bestStreak = Math.max(s.bestStreak, run); }
      else { s.l++; if (mk in s.lossBy) s.lossBy[mk]++; run = 0; }
    });
    s.noFF = rec(F.filter(function (f) { return !f.forfeit; }));
    s.wikiRule = rec(F.filter(function (f) { return !(f.forfeit && f.start < Y2024) && !/freestyle/i.test(f.tournamentName || ''); }));
    s.nForfeit = F.filter(function (f) { return f.forfeit; }).length;
    s.nNoTime = F.filter(function (f) { return f.noTime; }).length;
    var T = F.filter(function (f) { return f.length > 0; }); // fight-time stats only use fights with a recorded length
    s.timed = T.length; T.forEach(function (f) { s.total += f.length; });
    s.rate = s.n ? s.w / s.n : 0;
    var cur = 0, type = null;
    for (var i = F.length - 1; i >= 0; i--) { var t = F[i].won ? 'W' : 'L'; if (type === null) type = t; if (t !== type) break; cur++; }
    s.streak = type ? { type: type, n: cur } : null;
    s.last5 = F.slice(-5).map(function (f) { return f.won ? 'W' : 'L'; });
    s.avg = s.timed ? s.total / s.timed : 0;
    var lens = T.map(function (f) { return f.length; }), minL = Math.min.apply(null, lens), maxL = Math.max.apply(null, lens);
    s.shortest = T.filter(function (f) { return f.length === minL; });
    s.longest = T.filter(function (f) { return f.length === maxL; });
    s.fastestKO = T.filter(function (f) { return f.won && f.method === 'KO'; }).sort(function (a, b) { return a.length - b.length; })[0] || null;
    var ev = {}, order = [];
    F.forEach(function (f) { if (!ev[f.tournamentID]) { ev[f.tournamentID] = { id: f.tournamentID, name: f.tournamentName, fights: [], w: 0, l: 0 }; order.push(f.tournamentID); } var e = ev[f.tournamentID]; e.fights.push(f); f.won ? e.w++ : e.l++; });
    s.events = order.map(function (id) { var e = ev[id], last = e.fights[e.fights.length - 1]; e.date = Math.min.apply(null, e.fights.map(function (f) { return f.start; })); e.lastStage = stageLabel(last); e.lastWon = last.won; return e; });
    var op = {}; F.forEach(function (f) { var o = op[f.oppClean] || (op[f.oppClean] = { name: f.opp, clean: f.oppClean, w: 0, l: 0 }); f.won ? o.w++ : o.l++; });
    s.opponents = Object.keys(op).map(function (k) { return op[k]; });
    var yr = {}; F.forEach(function (f) { var y = fmtDate(f.start, { year: 'numeric' }); var o = yr[y] || (yr[y] = { y: y, w: 0, l: 0, ev: {} }); f.won ? o.w++ : o.l++; o.ev[f.tournamentID] = 1; });
    s.years = Object.keys(yr).sort().map(function (k) { var o = yr[k]; o.events = Object.keys(o.ev).length; return o; });
    s.src = { b: 0, w: 0, x: 0 }; F.forEach(function (f) { s.src[f.src] = (s.src[f.src] || 0) + 1; });
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
    if (bot.planned) return '<div class="status"><span class="dot-live"></span>In progress · no fights yet</div>';
    if (!bot.live) return '<div class="status"><span class="dot-live"></span>Snapshot, not live · team snapshot ' + esc(teamAsOf()) + '<br><span class="snapline">BrettZone + NHRL wiki, combined. This robot hasn’t fought in 2026, so it isn’t refreshed live.</span></div>';
    var live = state.source === 'live' && !state.error;
    var label = state.source === 'live' ? 'Live' : state.source === 'cache' ? 'Saved' : 'Offline snapshot';
    return '<div class="status' + (state.error ? ' warn' : '') + '"><span class="dot-live' + (live ? ' on' : '') + '"></span>' + label +
      (state.fetchedAt ? ' · updated <span data-ago>' + ago(state.fetchedAt) + '</span> (' + fmtTime(state.fetchedAt) + ')' : '') +
      (state.error ? ' · BrettZone unreachable, showing saved data' : '') + (state.loading || state.deepLoading ? ' · refreshing…' : '') +
      '<br><span class="snapline">' + esc(completeLabel()) + (state.deep && state.deep.at ? ' · new events checked ' + fmtStamp(state.deep.at) : '') + '</span></div>';
  }
  function completeLabel() {
    var c = window.COMPLETE_FIGHTS;
    if (bot.group !== 'mine') return 'Team snapshot (BrettZone + NHRL wiki) ' + teamAsOf() + ' + live BrettZone';
    return c ? 'Complete list: bundled snapshot ' + fmtStamp(c.scannedAt) + ' + live' : 'Live BrettZone fight list';
  }
  function bzFooter() {
    return '<div class="foot">Fight data from <a href="https://brettzone.nhrl.io" target="_blank" rel="noopener">BrettZone (brettzone.nhrl.io)</a> by NHRL' + (bot.team && bot.group !== 'mine' ? ' and the <a href="https://wiki.nhrl.io/" target="_blank" rel="noopener">NHRL wiki</a>' : '') + '</div>';
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
      '<div class="note" style="margin-top:8px">KO-dex’s ' + rec.w + '–' + rec.l + ' includes forfeits. ' + esc(rec.note) + ' This app’s own record above is <b>' + s.w + '–' + s.l + '</b> (' + s.noFF.w + '–' + s.noFF.l + ' without forfeits), from BrettZone’s complete fight lists.</div>' +
      '<a class="btn kxbtn" href="' + esc(k.url) + '" target="_blank" rel="noopener">Open ' + esc(bot.name) + ' on KO-dex ↗</a>' +
      '<div class="note kxcredit">' + kxCredit() + '. Per-fight rating changes are shown in Fights.</div></div>';
  }
  function renderOverview() {
    var s = state.s, F = state.F, el = $('view-overview');
    if (bot.planned) { el.innerHTML = plannedCard(); return; }
    if (!F.length) { el.innerHTML = statusLine() + '<div class="card">No fight data yet.</div>'; return; }
    var hero = bot.snapshot && bot.snapshot.heroImage, r = bot.rank;
    var h = statusLine();
    var tid = bot.team ? bot.team.id : bot.id;
    if (!hero && !r) h += '<div class="card idcard">' + (window.TeamPhoto ? window.TeamPhoto(tid, bot.name, false) : '') + '<div class="idrow"><span class="tcls-chip">' + bot.weightClass + 'lb</span>' + '<span class="idn">' + s.events.length + ' events · ' + s.n + ' fights</span></div>' +
      '<div class="tc-kv" style="margin-top:8px"><span>Builder</span><span>' + esc((bot.team && bot.team.builder) || 'Unknown') + '</span><span>Weapon</span><span>' + esc((bot.team && bot.team.weapon) || 'Unknown') + '</span><span>Span</span><span>' + fmtDate(F[0].start) + ' – ' + fmtDate(F[F.length - 1].start) + '</span></div>' +
      (bot.team && bot.team.note ? '<div class="note" style="margin-top:8px">' + esc(bot.team.note) + '</div>' : '') + factsHtml(bot.team) + '</div>';
    else h += '<div class="card hero">' + (hero ? '<img src="' + esc(hero) + '" alt="' + esc(bot.name) + ' (BrettZone still)" onerror="this.remove()">' : '') +
      '<div class="ov"></div><div class="cap"><div>' + (r ? '<div class="rank">' + esc(r.label) + '</div><div class="rank"><b>#' + r.value + '</b> <span class="asof">as of ' + esc(r.asOf) + '</span></div>' : '') + '</div>' +
      '<div class="rank" style="text-align:right">' + s.events.length + ' events<br>' + s.n + ' fights</div></div></div>';
    h += '<div class="card"><div class="record"><div><div class="k2">Record</div><div class="big"><span class="w">' + s.w + '</span><span class="d">–</span><span class="l">' + s.l + '</span></div></div>' +
      '<div class="stat" style="margin-left:auto;text-align:right"><div class="v">' + (s.rate * 100).toFixed(1) + '%</div><div class="k">Win rate</div></div></div>' +
      '<div class="recnotes"><div><sup>1</sup> Without forfeits: <b>' + s.noFF.w + '–' + s.noFF.l + '</b>' + (s.nForfeit ? ' (' + s.nForfeit + ' forfeit' + (s.nForfeit > 1 ? 's' : '') + ' counted above)' : '') + '</div>' +
      '<div><sup>2</sup> NHRL wiki / BrettZone rankings convention: <b>' + s.wikiRule.w + '–' + s.wikiRule.l + '</b>. It leaves out forfeits from before 2024 and freestyle exhibitions.</div></div>' +
      (bot.recordFootnote ? '<details class="fn"><summary>' + esc(bot.footnoteTitle || 'About this record') + '</summary><div class="note">' + bot.recordFootnote + '</div></details>' : '') + '</div>';
    h += renderKodexCard(s);
    h += '<div class="grid2"><div class="card stat"><div class="v ' + (s.streak && s.streak.type === 'W' ? 'win' : 'loss') + '">' + (s.streak ? s.streak.type + s.streak.n : '—') + '</div><div class="k">Current streak</div></div>' +
      '<div class="card stat"><div class="v win">W' + s.bestStreak + '</div><div class="k">Best win streak</div></div></div>';
    h += '<div class="card"><h2>Last 5</h2><div class="form">' + s.last5.map(function (x) { return '<div class="pill ' + x + '">' + x + '</div>'; }).join('') + '<span class="arrow">← latest</span></div></div>';
    var tw = s.w || 1;
    h += '<div class="card"><h2>How the wins came</h2><div class="grid4">' +
      ['KO', 'TO', 'JD', 'FF'].map(function (m) { return '<div class="mini stat"><div class="v" style="color:var(--' + m.toLowerCase() + ')">' + s.winBy[m] + '</div><div class="k">' + m + '</div></div>'; }).join('') + '</div>' +
      '<div class="bar">' + ['KO', 'TO', 'JD', 'FF'].map(function (m) { return '<span class="' + m.toLowerCase() + '" style="width:' + (s.winBy[m] / tw * 100) + '%"></span>'; }).join('') + '</div>' +
      '<div class="note">KO knockout · TO tap-out · JD judges’ decision · FF forfeit</div></div>';
    h += '<div class="card"><h2>Losses</h2><div class="grid2"><div class="stat"><div class="v loss">' + s.lossBy.KO + '</div><div class="k">KO losses</div></div>' +
      '<div class="stat"><div class="v">' + (s.lossBy.JD + s.lossBy.TO + s.lossBy.FF) + '</div><div class="k">JD / TO / FF losses</div><div class="s">' + s.lossBy.JD + ' JD · ' + s.lossBy.TO + ' TO · ' + s.lossBy.FF + ' FF</div></div></div></div>';
    function who(arr) { return arr.map(function (f) { return 'vs ' + esc(f.opp); }).join(', '); }
    if (s.timed) h += '<div class="card"><h2>Fight time</h2><div class="grid3">' +
      '<div class="stat"><div class="v">' + secs(s.avg) + '</div><div class="k">Average</div><div class="s">' + mmss(s.avg) + '</div></div>' +
      '<div class="stat"><div class="v">' + secs(s.shortest[0].length) + '</div><div class="k">Shortest</div><div class="s">' + who(s.shortest) + '</div></div>' +
      '<div class="stat"><div class="v">' + secs(s.longest[0].length) + '</div><div class="k">Longest</div><div class="s">' + who(s.longest) + '</div></div></div>' +
      (s.fastestKO ? '<div class="note" style="margin-top:10px">Fastest KO win: ' + secs(s.fastestKO.length) + ' vs ' + esc(s.fastestKO.opp) + '.</div>' : '') +
      (s.timed < s.n ? '<div class="note" style="margin-top:6px">From the ' + s.timed + ' fights with a recorded length. ' + (s.n - s.timed) + ' (mostly forfeits) have none.</div>' : '') + '</div>';
    if (s.years.length > 1 || bot.team) h += '<div class="card"><h2>By year</h2>' + s.years.slice().reverse().map(function (y) { var n = y.w + y.l; return '<div class="kv"><div>' + esc(y.y) + ' <span class="note">' + y.events + ' event' + (y.events === 1 ? '' : 's') + '</span></div><div><b>' + y.w + '–' + y.l + '</b> <span class="note">' + Math.round(y.w / n * 100) + '%</span></div></div>'; }).join('') + '</div>';
    if (bot.team && bot.group !== 'mine') h += '<div class="card"><h2>Sources</h2><div class="tc-foot" style="margin-top:0">' + ['x', 'b', 'w'].filter(function (k) { return s.src[k]; }).map(function (k) { return '<span class="tsrc ' + k + '">' + SRCTAG[k][0] + ' ' + s.src[k] + '</span>'; }).join('') + '</div>' +
      '<div class="note" style="margin-top:8px">BOTH = in BrettZone and the NHRL wiki (counted once, BrettZone’s result) · BZ = BrettZone only · WIKI = NHRL wiki only (before 2024).</div>' +
      '<a class="card linkcard" style="margin:10px 0 0" href="#team/' + esc(bot.team.id) + '" data-nav="team/' + esc(bot.team.id) + '"><span>Source detail and conflict notes</span><span class="chev">›</span></a></div>';
    if (bot.team && bot.team.history) { var hh = bot.team.history; h += '<a class="card linkcard' + (window.BOT_PHOTOS && window.BOT_PHOTOS[hh.id] ? ' withthumb' : '') + '" href="#team/' + esc(bot.team.id) + '" data-nav="team/' + esc(bot.team.id) + '">' + (window.BOT_PHOTOS && window.BOT_PHOTOS[hh.id] ? '<img class="lthumb" src="' + esc(window.BOT_PHOTOS[hh.id].src) + '" alt="' + esc(hh.name) + '" loading="lazy">' : '') + '<span>History: ' + esc(hh.name) + ' ' + hh.rec[0] + '–' + hh.rec[1] + ' (' + esc(hh.builder) + ')</span><span class="chev">›</span></a>'; }
    var rep = s.opponents.filter(function (o) { return o.w + o.l > 1; }).sort(function (a, b) { return (b.w + b.l) - (a.w + a.l); });
    var repMore = rep.length > 10 ? rep.length - 10 : 0; rep = rep.slice(0, 10);
    if (rep.length) h += '<div class="card"><h2>Rematches' + (repMore ? ' · top 10' : '') + '</h2>' + rep.map(function (o) { return '<div class="kv"><div>' + esc(o.name) + '</div><div><b>' + o.w + '–' + o.l + '</b></div></div>'; }).join('') + (repMore ? '<div class="note">+ ' + repMore + ' more opponents fought more than once.</div>' : '') + '</div>';
    h += '<a class="card linkcard" href="#archetypes" data-nav="archetypes"><span>Archetype matchups: who is ' + esc(bot.name) + ' weak against?</span><span class="chev">›</span></a>';
    h += bzFooter();
    el.innerHTML = h;
  }

  // Per-field source credit for builder / weapon (data/team.js "facts") plus the robot's source links.
  function factsHtml(c) {
    if (!c || !c.facts) return '';
    var f = c.facts, h = '<div class="tfacts">' + (f.builder ? '<div><b>Builder:</b> ' + esc(f.builder) + '</div>' : '') + (f.weapon ? '<div><b>Weapon:</b> ' + esc(f.weapon) + '</div>' : '') + '</div>';
    var links = (c.sources || []).filter(function (s) { return !/^BrettZone$|^NHRL wiki$/.test(s[0]); });
    if (links.length) h += '<div class="links tlinks">' + links.map(function (s) { return '<a class="btn ghost sm" href="' + esc(s[1]) + '" target="_blank" rel="noopener">' + esc(s[0]) + ' ↗</a>'; }).join('') + '</div>';
    return h;
  }
  function plannedCard() {
    return statusLine() + '<div class="card tbuildcard"><div class="tphoto none"><span>No robot yet</span></div><span class="tbuild">IN PROGRESS</span><div class="tc-name big2" style="margin-top:10px">' + esc(bot.name) + '</div>' +
      '<div class="note" style="margin-top:6px">A planned Too Hot to Handle robot. No fights yet, so there are no stats.</div>' +
      '<a class="btn ghost sm" style="margin-top:12px" href="#team" data-nav="team">Back to the team</a></div>';
  }
  function fightRow(f) {
    var r = f.won ? 'W' : 'L', kx = kxFight(f);
    var tag = bot.team && bot.group !== 'mine' ? '<span class="tsrc ' + f.src + '" title="' + SRCTAG[f.src][1] + '">' + SRCTAG[f.src][0] + '</span>' : '';
    return '<a class="fight ' + r + (tag ? ' tf' : '') + '" href="' + fightUrl(f) + '" target="_blank" rel="noopener">' +
      '<div class="res ' + (f.won ? 'win' : 'loss') + '">' + r + '</div>' +
      '<div class="mid"><div class="opp">' + esc(f.opp) + '</div><div class="rd">' + esc(stageLabel(f)) + (f.exhibition ? ' · exhibition' : '') + ' · ' + archChip(f.oppClean) + '</div>' + (kx ? '<div class="kxrow">KO-dex ' + kxDelta(kx.d) + ' → ' + kx.after + '</div>' : '') + (f.flag ? '<div class="tflag' + (/conflict/.test(f.flag) ? ' bad' : '') + '">' + esc(f.flag) + '</div>' : '') + '</div>' +
      '<div class="right"><span class="method ' + esc(f.method) + '">' + esc(f.method || '—') + '</span><span class="len">' + (f.length ? secs(f.length) : (f.forfeit ? 'forfeit' : 'no time')) + '</span>' + tag + '</div><span class="ext">↗</span></a>';
  }

  var fightsSeg = 'list';
  function renderFights() {
    var s = state.s, el = $('view-fights');
    if (bot.planned) { el.innerHTML = plannedCard(); return; }
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
      if (bot.team && bot.group !== 'mine') h += '<div class="note pad">Newest first. Tap a BrettZone fight to open it there, or a wiki fight for its video or wiki page. Tags: BOTH, BZ (BrettZone only), WIKI (NHRL wiki only).</div>';
      else h += '<div class="note pad">Newest first. Tap a fight to open it on BrettZone. Forfeits and fights with no start time are counted (BrettZone’s per-bot list leaves some out; this list comes from every tournament fight list).</div>';
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
    if (!bot.live) h += '<div class="card"><h2>Data</h2>' + statusLine().replace('class="status', 'class="status left') + '<div class="note">' + (bot.planned ? 'No fights yet.' : 'Bundled team snapshot (' + esc(teamAsOf()) + '): BrettZone tournament fight lists plus the NHRL wiki’s fight history, reconciled. Live refresh is only on for robots that fought in 2026.') + '</div></div>';
    else h += '<div class="card"><h2>Data</h2>' + statusLine().replace('class="status', 'class="status left') +
      '<div class="setrow"><div><div class="st">Auto-refresh</div><div class="note">Every 60 s while the app is open, plus when you return to it.</div></div><label class="switch"><input type="checkbox" id="autoToggle"' + (auto ? ' checked' : '') + '><span></span></label></div>' +
      '<div class="setrow"><div><div class="st">Refresh now</div><div class="note">Or pull down on any data screen. At most one request every 5 s.</div></div><button class="btn sm" data-refresh>Refresh</button></div>' +
      '<div class="note">Bundled complete fight list (every BrettZone tournament scanned): ' + (window.COMPLETE_FIGHTS ? esc(fmtStamp(window.COMPLETE_FIGHTS.scannedAt)) : 'none') + '. Bot-endpoint snapshot: ' + (snap ? esc(fmtStamp(snap.fetchedAt)) : 'none') + '. Live refresh reads <code>/bots/' + esc(bot.apiName) + '/fights</code>. Every 15 min (or when you refresh by hand) it also re-scans any BrettZone tournaments updated since the snapshot, so new forfeits and fights with no start time aren’t missed. ' +
      (bot.rank ? 'Rank #' + bot.rank.value + ' is from <a href="' + bot.rank.url + '" target="_blank" rel="noopener">BrettZone rankings</a> as of ' + esc(bot.rank.asOf) + '. It isn’t live: the API has no rankings endpoint, and its wins leaderboard counts fights differently.' : '') + '</div></div>';
    h += '<div class="sectiontitle pad">Credits</div>';
    h += '<div class="card credit"><h3>Fight data · BrettZone</h3><p>Fight data from <b>BrettZone (brettzone.nhrl.io)</b> by <b>NHRL</b>. Every stat here is computed from BrettZone’s public fight lists (the bot’s list plus every tournament fight list, because the per-bot list leaves out some forfeits and fights with no start time).</p>' +
      '<div class="links"><a class="btn" href="https://brettzone.nhrl.io" target="_blank" rel="noopener">brettzone.nhrl.io ↗</a>' + (bot.apiName && !bot.planned ? '<a class="btn ghost" href="' + botUrl(bot.apiName) + '" target="_blank" rel="noopener">' + esc(bot.name) + ' on BrettZone ↗</a>' : '') + '</div></div>';
    if (bot.team && bot.group !== 'mine') h += '<div class="card credit"><h3>Fight history · NHRL wiki</h3><p>Fights from before BrettZone’s records, plus builders and specs, come from each robot’s <b>NHRL wiki</b> page (Full Fight History).</p><div class="links">' + (bot.wikiUrl ? '<a class="btn" href="' + esc(bot.wikiUrl) + '" target="_blank" rel="noopener">' + esc(bot.name) + ' on the NHRL wiki ↗</a>' : '<a class="btn" href="https://wiki.nhrl.io/" target="_blank" rel="noopener">wiki.nhrl.io ↗</a>') + '</div></div>';
    if (bot.kodex) h += '<div class="card credit"><h3>Ratings · KO-dex</h3><p>' + kxCredit() + '.</p><p class="note">' + kxLabel() + '. Values are bundled in the app; it never calls kodex.bot.</p>' +
      '<div class="links"><a class="btn" href="' + esc(bot.kodex.url) + '" target="_blank" rel="noopener">' + esc(bot.name) + ' on KO-dex ↗</a><a class="btn ghost" href="https://kodex.bot" target="_blank" rel="noopener">kodex.bot ↗</a></div></div>';
    h += '<div class="card credit"><h3>ROBO CALC</h3><p><b>ROBO CALC — Combat Robotics Calculator Tool</b> by <b>Brian Boxell, Too Hot Robotics</b>. Embedded live from his site; no code copied. This app’s look is inspired by ROBO CALC (our own CSS).</p>' +
      '<div class="links"><a class="btn" href="https://github.com/bdboxell/robocalc" target="_blank" rel="noopener">github.com/bdboxell/robocalc ↗</a></div></div>';
    h += '<div class="card"><h2>More credits</h2><div class="note credits">' +
      '<b>Archetypes &amp; robot info</b>: <a href="https://wiki.nhrl.io/" target="_blank" rel="noopener">NHRL wiki</a> (weapon-type categories, robot pages), <a href="https://robotcombatwiki.com/wiki/Weapons" target="_blank" rel="noopener">RobotCombatWiki</a>, and <a href="https://wiki.combatrobots.org/" target="_blank" rel="noopener">Combat Robots Wiki</a> (definitions and general strengths and weaknesses).<br>' +
      '<b>Ember</b> calculators by <a href="https://level5robotics.com" target="_blank" rel="noopener">Level 5 Robotics</a> with the SCAR community.<br>' +
      '<b>Pulley &amp; Belt Calculator</b> by <a href="https://www.fingertechrobotics.com/how-to_pulley_belt.php" target="_blank" rel="noopener">FingerTech Robotics</a> · <b>Center Distance Designer</b> by <a href="https://sdp-si.com/tools/center-distance-designer.php" target="_blank" rel="noopener">SDP/SI</a> · <b>Belt Tension</b> by <a href="https://calculators.gates.com/BeltTension" target="_blank" rel="noopener">Gates</a>.<br>' +
      '<b>Battery Sag &amp; Wh</b>: built into this app (resistive model; resistance bands and burst/continuous data from the <a href="https://batt.rotorama.cz/en/p/methodology" target="_blank" rel="noopener">Rotorama Battery Benchmark</a>; sources listed in the calculator).<br>' +
      '<b>Ratings &amp; fight types</b>: ' + kxCredit() + ' (<a href="https://kodex.bot" target="_blank" rel="noopener">kodex.bot</a>). ' + kxLabel() + '.<br>' +
      '<b>Font</b>: Chakra Petch (SIL Open Font License), self-hosted.</div></div>';
    if (bot.specs && bot.wikiUrl) h += '<div class="card"><h2>' + esc(bot.name) + '</h2><div class="kv">' + bot.specs.map(function (kv) { return '<div>' + esc(kv[0]) + '</div><div>' + esc(kv[1]) + '</div>'; }).join('') + '</div>' +
      '<div class="note" style="margin-top:8px">' + (bot.team && bot.team.facts ? '' : 'Specs from the <a href="' + bot.wikiUrl + '" target="_blank" rel="noopener">NHRL wiki</a>.') + (bot.snapshot && bot.snapshot.heroImage ? ' Hero photo: BrettZone still.' : '') + '</div>' + factsHtml(bot.team) + '</div>';
    else if (bot.specs) h += '<div class="card"><h2>' + esc(bot.name) + '</h2><div class="kv">' + bot.specs.map(function (kv) { return '<div>' + esc(kv[0]) + '</div><div>' + esc(kv[1]) + '</div>'; }).join('') + '</div><div class="note" style="margin-top:8px">' + (bot.planned ? (bot.channel ? 'From the team’s Discord channel list.' : 'Planned per the team. Class, builder and weapon not known yet.') : 'No NHRL wiki page yet.') + '</div>' + factsHtml(bot.team) + '</div>';
    h += '<div class="card"><h2>About</h2><div class="note"><b>Too Hot to Handle Hub</b>: an unofficial stats app for team Too Hot to Handle (Too Hot Robotics), not affiliated with NHRL. Add it to your home screen: Safari → Share → “Add to Home Screen”, or Chrome → ⋮ → “Install app”.</div></div>';
    el.innerHTML = h;
  }

  function renderArchetypes() {
    if (bot.planned) { $('view-archetypes').innerHTML = plannedCard(); return; }
    if (window.Archetypes) window.Archetypes.render($('view-archetypes'), { bot: bot, F: state.F.filter(function (f) { return !f.forfeit; }), status: statusLine(), footer: bzFooter(), esc: esc, fmtDate: fmtDate, fightUrl: fightUrl, onChange: renderAll });
  }

  function renderAll() {
    state.F = normalise(mergedRaw()); state.ff = [];
    state.s = state.F.length ? computeStats(state.F) : null;
    window.__stats = state.s; window.__fights = state.F;
    renderOverview(); renderFights(); renderArchetypes(); renderMore(); updateSide();
    if (window.TeamView) window.TeamView.render();
  }

  /* ---------- fetching / live updates ---------- */
  function getJSON(path) {
    // BrettZone asks apps to send an X-API-Key header, but its CORS preflight only allows Content-Type,
    // so browsers block that header. We send a plain CORS GET (open CORS, no auth needed).
    return fetch(API + path, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  var lastReq = 0;
  function refresh(manual) {
    if (!bot || state.loading || !bot.live) return Promise.resolve(false);
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
      .then(function () { state.loading = false; $('refreshBtn').classList.remove('spin'); renderAll(); return deepCheck(manual).then(fillMissingRounds); });
  }

  // Re-scan BrettZone tournaments updated since the bundled complete snapshot (usually 0-3 lists, ~40-110 KB each),
  // at most every 15 min (60 s for a manual refresh). Results are cached per bot in localStorage.
  var lastDeep = 0;
  function deepCheck(manual) {
    var b = bot, c = window.COMPLETE_FIGHTS;
    if (!b || !c || state.deepLoading) return Promise.resolve();
    var d = state.deep || { at: null, extras: {}, seen: {} };
    var since = Math.max(lastDeep, d.at ? Date.parse(d.at) : 0);
    if (Date.now() - since < (manual ? 60000 : DEEP_MS)) return Promise.resolve();
    lastDeep = Date.now(); state.deepLoading = true;
    var snapT = Date.parse(c.scannedAt) - 86400000; // 1-day margin
    return getJSON('/tournaments').then(function (r) {
      var list = ((r && r.tournaments) || []).filter(function (t) {
        var upd = Date.parse(String(t.updateTime || '').replace(' ', 'T') + 'Z');
        return (+t.WeightClass === +b.weightClass || +t.WeightClass === 0) && +t.isTest !== 1 && upd >= snapT && d.seen[t.tournamentID] !== t.updateTime;
      }).sort(function (x, y) { return String(y.updateTime).localeCompare(String(x.updateTime)); }).slice(0, DEEP_MAX);
      var chain = Promise.resolve();
      list.forEach(function (t, i) {
        chain = chain.then(function () { return i ? new Promise(function (res) { setTimeout(res, DEEP_GAP_MS); }) : null; })
          .then(function () { return getJSON('/tournaments/' + encodeURIComponent(t.tournamentID) + '/fights'); })
          .then(function (fr) {
            d.extras[t.tournamentID] = ((fr && fr.fights) || []).filter(function (x) { return x.player1clean === b.apiName || x.player2clean === b.apiName; }).map(function (x) {
              return { tournamentID: x.tournamentID, gameID: x.id, name: x.name, round: x.round, cage: x.cage, player1: x.player1, player1clean: x.player1clean, player2: x.player2, player2clean: x.player2clean,
                player1wins: x.player1wins, player2wins: x.player2wins, winAnnotation: x.winAnnotation || '', startTime: x.startTime || 0, endTime: x.endTime ? Math.floor(x.endTime / 1000) : 0,
                matchLength: x.matchLength || 0, tournamentName: x.tournamentName || t.tournamentName, WeightClass: x.weightClass || t.WeightClass, isFreestyle: t.isFreestyle };
            });
            d.seen[t.tournamentID] = t.updateTime;
          }).catch(function () {});
      });
      return chain;
    }).then(function () {
      d.at = new Date().toISOString();
      if (b === bot) { state.deep = d; lsSet(key('deep'), d); }
    }).catch(function () {}).then(function () { state.deepLoading = false; if (b === bot) renderAll(); });
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
    if (window.RobotProfile && b.group === 'mine') window.RobotProfile.use(b.id, b.profileDefaults); // Calcs stay on your own robot's profile
    if (window.Calcs) window.Calcs.rerender();
    state = { data: null, fetchedAt: null, source: 'snapshot', rounds: {}, error: null, loading: false, F: [], ff: [], s: null, deep: lsGet('sn_' + b.id + '_deep'), deepLoading: false };
    lastDeep = 0;
    var snap = b.snapshot;
    if (snap && snap.roundNames) Object.keys(snap.roundNames).forEach(function (k) { if (snap.roundNames[k]) state.rounds[k] = snap.roundNames[k]; });
    var saved = lsGet(key('rounds')) || {}; Object.keys(saved).forEach(function (k) { state.rounds[k] = saved[k]; });
    var cached = b.live ? lsGet(key('fights')) : null;
    if (cached && cached.data && cached.data.fights) { state.data = cached.data; state.fetchedAt = cached.fetchedAt; state.source = 'cache'; }
    else if (window.COMPLETE_FIGHTS) { state.data = null; state.fetchedAt = b.group === 'mine' ? window.COMPLETE_FIGHTS.scannedAt : null; state.source = 'snapshot'; }
    else if (snap) { state.data = snap.data; state.fetchedAt = snap.fetchedAt; state.source = 'snapshot'; }
    $('botName').innerHTML = esc(b.name.slice(0, Math.ceil(b.name.length / 2))) + '<span>' + esc(b.name.slice(Math.ceil(b.name.length / 2))) + '</span>';
    $('botSub').textContent = b.subtitle || '';
    $('refreshBtn').classList.toggle('off', !b.live); $('refreshBtn').title = b.live ? 'Refresh data' : 'Snapshot, not live';
    document.title = b.name + ' · Too Hot to Handle Hub';
    renderAll();
    lastReq = 0; refresh();
  }

  /* ---------- desktop sidebar: current robot card (hidden on phones by CSS) ---------- */
  var DESK = window.matchMedia ? window.matchMedia('(min-width: 900px)') : { matches: false };
  function updateSide() {
    var el = $('sideBot'); if (!el || !bot) return;
    var tid = bot.team ? bot.team.id : bot.id, p = window.BOT_PHOTOS && window.BOT_PHOTOS[tid], s = state.s;
    var rec = s && state.F && state.F.length ? '<span class="w">' + s.w + '</span>–<span class="l">' + s.l + '</span>' : (bot.planned ? 'In progress' : '');
    el.innerHTML = (p ? '<div class="sb-photo' + (p.cut ? ' cut' : '') + '"><img src="' + esc(p.src) + '" alt="' + esc(bot.name) + '"></div>' : (bot.planned ? '<div class="sb-photo none"><span>No robot yet</span></div>' : '')) +
      '<div class="sb-meta"><div class="sb-rec">' + rec + '</div><div class="sb-tag">' + (bot.planned ? 'Planned' : bot.live ? '' : 'Snapshot') + '</div></div>' +
      '<button class="sb-switch" data-sw>Switch robot <kbd>/</kbd></button>';
  }
  // Background scroll lock while the switcher is open (wheel + touch). position:fixed keeps iOS Safari from scrolling the page.
  var lockY = 0;
  function lockScroll() {
    if (document.body.classList.contains('scroll-locked')) return;
    lockY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = -lockY + 'px'; document.body.classList.add('scroll-locked'); document.documentElement.classList.add('scroll-locked');
  }
  function unlockScroll() {
    if (!document.body.classList.contains('scroll-locked')) return;
    document.body.classList.remove('scroll-locked'); document.documentElement.classList.remove('scroll-locked'); document.body.style.top = '';
    window.scrollTo(0, lockY);
  }
  function openSheet() {
    $('sheetBody').innerHTML = '<div class="sheettitle">Switch robot</div><input id="botSearch" class="botsearch" type="search" placeholder="Search ' + BOTS.length + ' robots" autocomplete="off" aria-label="Search robots"><div id="sheetList" class="sheetlist"></div><button class="sheetitem cancel" data-close>Close</button>';
    renderSheetList('');
    lockScroll();
    $('sheet').hidden = false; requestAnimationFrame(function () { $('sheet').classList.add('open'); });
    if (DESK.matches) setTimeout(function () { var i = $('botSearch'); if (i) i.focus(); }, 30);
  }
  function recOf(b) { var c = b.team; return c ? c.rec[0] + '–' + c.rec[1] : ''; }
  function renderSheetList(q) {
    var cur = bot.id; q = cleanName(q);
    // Grouped by weight class only; your own robots sit in their class (marked live like other 2026-active bots).
    var groups = [['3lb', function (b) { return !b.planned && b.weightClass === 3; }], ['12lb', function (b) { return !b.planned && b.weightClass === 12; }], ['30lb', function (b) { return !b.planned && b.weightClass === 30; }],
      ['In progress', function (b) { return b.group === 'build'; }]];
    var h = '';
    groups.forEach(function (g) {
      var list = BOTS.filter(g[1]).filter(function (b) { return !q || cleanName(b.name).indexOf(q) >= 0; });
      if (!list.length) return;
      h += '<div class="sgroup"><div class="sheetgroup">' + g[0] + '</div><div class="sgitems">' + list.map(function (b) {
        var meta = b.id === cur ? 'Current' : b.planned ? 'In progress' : (recOf(b) ? recOf(b) + ' · ' : '') + (b.weightClass ? b.weightClass + 'lb' : '');
        return '<button class="sheetitem' + (b.id === cur ? ' on' : '') + (b.planned ? ' planned' : '') + '" data-bot="' + b.id + '"><span>' + esc(b.name) + '</span><span class="note">' + esc(meta) + '</span></button>';
      }).join('') + '</div></div>';
    });
    $('sheetList').innerHTML = h || '<div class="note pad">No robot matches.</div>';
  }
  function closeSheet() { $('sheet').classList.remove('open'); unlockScroll(); setTimeout(function () { $('sheet').hidden = true; }, 180); }

  /* ---------- router (hash: #tab or #tab/sub) ---------- */
  function parse(hash) { var p = (hash || '').replace(/^#/, '').split('/'); var tab = TABS.indexOf(p[0]) >= 0 ? p[0] : 'overview'; return { tab: tab, sub: p[1] || '' }; }
  function route() {
    var r = parse(location.hash);
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === r.tab); b.setAttribute('aria-selected', b.dataset.tab === r.tab); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + r.tab); });
    if (r.tab === 'calc' && window.Calcs) window.Calcs.open(r.sub || 'list');
    if (r.tab === 'team' && window.TeamView) window.TeamView.open(r.sub || '');
    window.scrollTo(0, 0);
  }
  // Tab switches replace history (no long back stacks); sub-pages push so the phone's back gesture returns.
  function navigate(hash, push) {
    if (location.hash === hash) { route(); return; }
    if (push) history.pushState({ sub: true }, '', hash); else history.replaceState(null, '', hash);
    route();
  }
  function back(fallback) { if (history.state && history.state.sub) history.back(); else navigate(fallback, false); }
  window.App = { navigate: navigate, back: back, switchBot: function (id) { if (!bot || id !== bot.id) loadBot(id); navigate('#overview', false); }, esc: esc, currentBot: function () { return bot; } };

  /* ---------- wiring ---------- */
  function setupPTR() {
    var startY = null, dy = 0, ptr = $('ptr');
    window.addEventListener('touchstart', function (e) { var v = document.querySelector('.view.active'); if (window.scrollY <= 0 && v && v.id !== 'view-calc' && !$('sheet').classList.contains('open')) { startY = e.touches[0].clientY; dy = 0; } }, { passive: true });
    window.addEventListener('touchmove', function (e) { if (startY === null) return; dy = e.touches[0].clientY - startY; if (dy > 0) { ptr.style.height = Math.min(dy / 2, 44) + 'px'; ptr.textContent = dy > 90 ? 'Release to refresh' : 'Pull to refresh'; } }, { passive: true });
    window.addEventListener('touchend', function () { if (startY === null) return; var go = dy > 90; startY = null; ptr.style.height = '0'; if (go) refresh(true); });
  }

  function init() {
    if (window.Calcs) window.Calcs.init($('view-calc'));
    if (window.TeamView) window.TeamView.init($('view-team'));
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { var r = parse(location.hash); navigate('#' + b.dataset.tab, false); if (r.tab === b.dataset.tab) window.scrollTo({ top: 0, behavior: 'smooth' }); });
    });
    document.addEventListener('click', function (e) {
      var n = e.target.closest('[data-nav]'); if (n) { e.preventDefault(); navigate('#' + n.dataset.nav, n.dataset.nav.indexOf('/') > 0); return; }
      var sg = e.target.closest('[data-seg]'); if (sg) { fightsSeg = sg.dataset.seg; renderFights(); return; }
      if (e.target.closest('[data-refresh]')) { refresh(true); return; }
      var bb = e.target.closest('[data-bot]'); if (bb) { closeSheet(); if (bb.dataset.bot !== bot.id) loadBot(bb.dataset.bot); return; }
      if (e.target.closest('[data-sw]')) { openSheet(); return; }
      if (e.target.closest('[data-close]') || e.target.id === 'sheet') { closeSheet(); return; }
    });
    // Keyboard: "/" opens the switcher (search focused), Esc closes it, ↑/↓ move through robots or the sidebar tabs.
    document.addEventListener('keydown', function (e) {
      var sheetOpen = !$('sheet').hidden, t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); if (!sheetOpen) openSheet(); else { var i = $('botSearch'); if (i) i.focus(); } return; }
      if (e.key === 'Escape' && sheetOpen) { e.preventDefault(); closeSheet(); var b = $('botSwitch'); if (b) b.focus(); return; }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && sheetOpen) {
        var items = [].slice.call(document.querySelectorAll('#sheetList .sheetitem')); if (!items.length) return;
        var k = items.indexOf(document.activeElement); e.preventDefault();
        k = e.key === 'ArrowDown' ? (k < 0 ? 0 : Math.min(items.length - 1, k + 1)) : (k <= 0 ? -1 : k - 1);
        if (k < 0) $('botSearch').focus(); else items[k].focus(); return;
      }
      if (e.key === 'Enter' && sheetOpen && t && t.id === 'botSearch') { var first = document.querySelector('#sheetList .sheetitem'); if (first) { e.preventDefault(); first.click(); } return; }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && t && t.closest && t.closest('.tabs')) {
        var tabs = [].slice.call(document.querySelectorAll('.tabs button')).sort(function (a, b) { return (+getComputedStyle(a).order) - (+getComputedStyle(b).order); });
        var j = tabs.indexOf(t); if (j < 0) return; e.preventDefault();
        var n = tabs[(j + (e.key === 'ArrowDown' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); n.click();
      }
    });
    document.addEventListener('input', function (e) { if (e.target.id === 'botSearch') renderSheetList(e.target.value); });
    document.addEventListener('change', function (e) { if (e.target.id === 'autoToggle') { lsSet('sn_auto_refresh', e.target.checked); } });
    $('refreshBtn').addEventListener('click', function () { refresh(true); });
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
