/* Bot registry. Add a new bot (e.g. Blink) by adding an entry here (+ optional snapshot file).
   Everything else (data, caches, archetype edits) is keyed by bot id. */
window.BOTS = [
  {
    id: 'supernova',
    name: 'Supernova',
    apiName: 'supernova',          // BrettZone clean name for /bots/{apiName}/fights
    weightClass: 12,
    subtitle: '12lb · NHRL',
    enabled: true,
    // KO-dex: bundled snapshot only (data/kodex.js); never fetched from kodex.bot.
    kodex: (window.KODEX && window.KODEX.bots.supernova) || null,
    snapshot: window.SUPERNOVA_SNAPSHOT || null,
    // Rank isn't in the fights endpoint and BrettZone's /stats/leaderboard is a wins table with
    // different counting (it lists Supernova at 5W-2L), so the official rank is a dated snapshot.
    rank: { value: 9, label: 'BrettZone 12lb rank', asOf: 'Oct 24, 2026', url: 'https://brettzone.nhrl.io/brettZone/v2/rankings' },
    wikiUrl: 'https://wiki.nhrl.io/wiki/index.php?title=Supernova',
    specs: [
      ['Builder / driver', 'Ezequiel Gonzalez Solano'], ['Weight class', '12lb (NHRL)'],
      ['Weapon', 'Vertical spinner / eggbeater'], ['Body', '6061 aluminum, TPU, alloy steel'], ['Power', '6S LiPo']
    ],
    footnoteTitle: 'Which fights are counted',
    recordFootnote: 'Counted: every decided fight in BrettZone’s tournament fight lists, forfeits included. That adds the April 2026 forfeit win vs BONK, which BrettZone’s per-bot list leaves out. KO-dex and the NHRL wiki also have <b>10–4</b>. Without the forfeit it’s <b>9–4</b>.',
    eventNotes: {}
  },
  {
    id: 'blink',
    name: 'Blink',
    apiName: 'blink',
    weightClass: 3,
    subtitle: '3lb · NHRL',
    enabled: true,
    // This Blink is the 3lb bot, so KO-dex's blink-3 page applies.
    kodex: (window.KODEX && window.KODEX.bots.blink) || null,
    snapshot: window.BLINK_SNAPSHOT || null,
    rank: { value: 167, label: 'BrettZone 3lb rank', asOf: 'Oct 25, 2026', url: 'https://brettzone.nhrl.io/brettZone/v2/rankings?w=3&season=Active' },
    wikiUrl: 'https://wiki.nhrl.io/wiki/index.php?title=Blink',
    specs: [
      ['Builder / driver', 'Ezequiel Gonzalez Solano'], ['Weight class', '3lb (NHRL)'],
      ['Weapon', 'Single disk (vertical spinner)'], ['Weapon drive', 'Badass 2315'], ['Drive', 'Rectified Robotics brushless'],
      ['Body', 'UHMW, TPU'], ['Power', 'LiHV 4S 1100 mAh']
    ],
    footnoteTitle: 'Which fights are counted',
    recordFootnote: 'Counted: every decided fight in BrettZone’s tournament fight lists (31), forfeits included. That adds 4 fights BrettZone’s per-bot list leaves out: the two March 2023 qualifier forfeits (L vs IDKWTFID, L vs Spectroscope), the Sept 2023 freestyle exhibition (W JD vs Something) and the March 1, 2025 forfeit win vs The Trundler. It also keeps the two March 2026 forfeits that have no fight time (W vs Stormsurge, L vs Project LiftOff-3). Without forfeits it’s <b>12–14</b>. The NHRL wiki and BrettZone rankings show <b>13–15</b> because they leave out forfeits from before 2024 and freestyle exhibitions.',
    eventNotes: {},
    profileDefaults: {
      name: 'Blink', weightClassLb: 3,
      battery: { chemistry: 'LiHV', cellsSeries: 4, cellsParallel: 1, packCapacityMah: 1100, resistanceMode: 'ir', cellResistanceMohm: 10, packResistanceMohm: 40, cRating: 75, cellFullV: 4.35, cellNominalV: 3.8, allowedSagPct: 10 },
      components: [
        { id: 'c1', name: 'Drive motor (left)', qty: 1, peakA: 15, typicalA: 5 },
        { id: 'c2', name: 'Drive motor (right)', qty: 1, peakA: 15, typicalA: 5 },
        { id: 'c3', name: 'Weapon motor', qty: 1, peakA: 60, typicalA: 20 }
      ],
      exampleNote: 'Example values loaded (4S LiHV 1100 mAh is from Blink’s wiki page; everything else is a generic example). Replace them with your own specs.'
    }
  }
];

/* Rest of the Too Hot to Handle roster, generated from the bundled team snapshot (data/team.js).
   Bots that fought in 2026 also try a live BrettZone refresh (merged, so counts never drop); the rest are snapshot-only. */
(function () {
  var T = window.TEAM_DATA; if (!T) return;
  var WIKI = 'https://wiki.nhrl.io/wiki/index.php?title=';
  function cleanName(n) { return String(n || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  window.BOTS.forEach(function (b) { b.group = 'mine'; b.live = true; });
  T.bots.forEach(function (c) {
    var own = window.BOTS.filter(function (b) { return b.id === (c.appBot || c.id); })[0];
    if (own) { own.team = c; return; }
    window.BOTS.push({
      id: c.id, name: c.name, apiName: c.bz || cleanName(c.name), weightClass: c.cls, group: 'team', team: c,
      subtitle: c.cls + 'lb · NHRL', enabled: true,
      live: !!(c.bz && c.lastDate && c.lastDate >= '2026-01-01'),
      kodex: null, snapshot: null, rank: null,
      wikiUrl: c.wiki ? WIKI + encodeURIComponent(c.wiki.replace(/ /g, '_')) : null,
      specs: [['Builder / driver', c.builder || 'Unknown'], ['Weight class', c.cls + 'lb (NHRL)'], ['Weapon', c.weapon || 'Unknown']].concat(c.channel ? [['Team channel', '#' + c.channel]] : []),
      footnoteTitle: 'Where these fights come from',
      recordFootnote: 'Combined from BrettZone’s tournament fight lists and the NHRL wiki’s fight history. A fight found in both is counted once, with BrettZone’s result. Wiki-only fights are only used from before 2024. Team snapshot: ' + T.asOf + '.',
      eventNotes: {}
    });
  });
  T.planned.forEach(function (p) {
    window.BOTS.push({ id: 'plan-' + p.id, name: p.name, group: 'build', planned: true, enabled: true, live: false, channel: p.channel,
      subtitle: 'In build', kodex: null, snapshot: null, rank: null, specs: [['Status', 'In build, no fights yet']].concat(p.channel ? [['Team channel', '#' + p.channel]] : []) });
  });
})();
