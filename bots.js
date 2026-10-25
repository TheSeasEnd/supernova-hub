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
    snapshot: window.SUPERNOVA_SNAPSHOT || null,
    // Rank isn't in the fights endpoint and BrettZone's /stats/leaderboard is a wins table with
    // different counting (it lists Supernova at 5W-2L), so the official rank is a dated snapshot.
    rank: { value: 9, label: 'BrettZone 12lb rank', asOf: 'Oct 24, 2026', url: 'https://brettzone.nhrl.io/brettZone/v2/rankings' },
    wikiUrl: 'https://wiki.nhrl.io/wiki/index.php?title=Supernova',
    specs: [
      ['Builder / driver', 'Ezequiel Gonzalez Solano'], ['Weight class', '12lb (NHRL)'],
      ['Weapon', 'Vertical spinner / eggbeater'], ['Body', '6061 aluminum, TPU, alloy steel'], ['Power', '6S LiPo']
    ],
    recordFootnote: 'The NHRL wiki and BrettZone rankings show <b>10–4</b>: that includes an April 2026 forfeit win that isn’t in the BrettZone fight list, so it isn’t counted here.',
    eventNotes: { nhrl_apr26_12lb: 'The wiki also credits a forfeit win here that BrettZone’s fight list doesn’t include (wiki: 4–1).' }
  },
  { id: 'blink', name: 'Blink', enabled: false, comingSoon: true, subtitle: 'Coming soon' }
];
