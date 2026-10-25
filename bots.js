/* Bot registry. Add a new bot (e.g. Blink) by adding an entry here (+ optional snapshot file).
   Everything else (data, caches, archetype edits) is keyed by bot id. */
window.BOTS = [
  {
    id: 'supernova',
    name: 'Supernova',
    apiName: 'supernova',          // BrettZone clean name for /bots/{apiName}/fights
    weightClass: 12,
    subtitle: '12lb · NHRL · Too Hot Robotics',
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
    footnoteTitle: 'Why the wiki says 10–4',
    recordFootnote: 'The NHRL wiki and BrettZone rankings show <b>10–4</b>: that includes an April 2026 forfeit win that isn’t in the BrettZone fight list, so it isn’t counted here.',
    eventNotes: { nhrl_apr26_12lb: 'The wiki also credits a forfeit win here that BrettZone’s fight list doesn’t include (wiki: 4–1).' }
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
    footnoteTitle: 'Why the wiki says 13–15',
    recordFootnote: 'The NHRL wiki and BrettZone rankings show <b>13–15</b> (28 fights). They also count two March 2026 forfeits that BrettZone lists without a fight time (W vs Stormsurge, L vs Project LiftOff-3) and a March 1, 2025 forfeit win vs The Trundler that isn’t in BrettZone’s fight list. Forfeits aren’t counted here.',
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
