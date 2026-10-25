# Supernova Hub · NHRL stats PWA for Supernova (12lb) and Blink (3lb)

Static HTML/CSS/JS, no build step. Serve the folder over HTTPS (or localhost), open on a phone → Add to Home Screen.

## Navigation
Bottom bar: **Overview · Fights (All fights | Events) · Archetypes · Calcs · More**. Tap the robot name in the header to switch bots. Switching swaps everything: Overview, Fights/Events, Archetypes (per-bot opponent mapping and corrections), Calcs (per-bot robot profile) and More (specs, wiki link).
Hash routes: `#overview`, `#fights`, `#archetypes`, `#calc`, `#calc/<id>`, `#more`. Tab switches replace history; calculator sub-pages push history, so the phone's back gesture returns to the list.

## Files
- `index.html`, `styles.css` (ROBO CALC-inspired "hot" theme, our own CSS), `app.js` (router, stats, live updates, screens)
- `bots.js`: bot registry (id, BrettZone name, snapshot, dated rank, specs, notes). Supernova (12lb) and Blink (3lb). Each entry also has `footnoteTitle`/`recordFootnote`, `eventNotes` and `profileDefaults` (robot-profile defaults for the calculators).
- `archetypes.js` + `data/archetypes.json`: editable opponent→archetype mapping with evidence, source URLs and confidence. Taxonomy = NHRL wiki weapon-type categories. Mapping is per bot (`opponents.supernova`, `opponents.blink`) plus `selfArchetypes`. User corrections are saved per bot in localStorage (`sn_arch_overrides_v1` for Supernova, `sn_blink_arch_overrides_v1` for Blink).
- `calcs.js`: Calculators list (ROBO CALC, Ember, FingerTech, SDP/SI, Gates) + native Battery Sag / Max Amps
- `profile.js`: robot profile (`window.RobotProfile`), one per bot (`sn_robot_profile_v1` for Supernova, `sn_blink_robot_profile_v1` for Blink), for calculators and a future robot designer. Blink's defaults use the wiki's 4S LiHV 1100 mAh; other values are labelled generic examples.
- `data/kodex.js`: bundled KO-dex snapshot (see below)
- `data/snapshot.js`, `data/snapshot-blink.js`: bundled snapshots of BrettZone `/bots/{bot}/fights` plus round names (offline fallback)
- `sw.js`, `manifest.webmanifest`, `icons/`, `fonts/` (Chakra Petch, SIL OFL)

## Battery Sag / Max Amps (built-in estimate)
- Inputs: cells in series (S), **total pack capacity (mAh, the number on the label)**, full-charge and nominal cell V, allowed sag %, and internal resistance as one of: **per-cell IR** (mΩ, per cell; pack = (S ÷ P) × R_cell, so P matters only here), **whole-pack IR** (mΩ), or **C-rating only** (pack-level estimate R_pack ≈ S × 0.4 V ÷ (C × Ah_pack), labelled as an estimate).
- Outputs: pack resistance, I_max = (sag% × S × V_full) ÷ R_pack, loaded voltage at total peak/typical component draw with OK / will-sag warning, Wh = S × V_nominal × Ah_pack.
- Saved in the shared robot profile (`sn_robot_profile_v1`, profile version 2). Profiles saved by older versions (per-cell `capacityMah`) are migrated automatically: total = per-cell mAh × P.

## Blink (3lb)
- Identity: BrettZone has one Blink (3lb). Its NHRL wiki page lists Builder/Driver Ezequiel Gonzalez Solano, Single Disk weapon, Category: Vertical Spinners. BrettZone 3lb rank #167 (Active season, as of Oct 25, 2026).
- Record computed from the fight list: **11–14** over 25 timed fights at 8 events (Sep 2023 to May 2026). The wiki and BrettZone rankings say 13–15 because they also count the two March 2026 forfeits (W vs Stormsurge, L vs Project LiftOff-3) and a March 1, 2025 forfeit win vs The Trundler that isn't in BrettZone's fight list. Forfeits are shown under their event but not counted.
- Opponent archetypes come from each opponent's NHRL wiki page. IMPAKT (eggbeater, from the "Beater bar" weapon field) and Zenith (undercutter, "Undahcuttah") are medium confidence. Butter Fly has no wiki page, so it's "unknown".

## KO-dex ratings (snapshot)
- `data/kodex.js` (`window.KODEX`): **KO-dex snapshot, as of Oct 3, 2026 — not live.** Built from the saved pages in `/workspace/kodex-data/` (kodex.bot/bots/supernova-12 and kodex.bot/bots/blink-3). The app never calls kodex.bot (no API, no CORS).
- Wired per bot through `bots.js` (`kodex:`). Overview shows a KO-dex card (current and all-time rating ± RD with class rank, all-time peak, KO-dex type, badges, best win, KO-dex's own record labelled as KO-dex's number, a big link to the bot's KO-dex page, and the credit). Fights shows KO-dex's all-time rating change per fight, matched by BrettZone `tournamentID|gameID`. Forfeits and KO-dex-only fights are listed under their event but not counted.
- Supernova: current 1849 ± 113 (#14 of 178, 12 lb), all-time 1891 ± 108 (#21 of 381), peak 1922, type Executioner, badge Podium ×2, best win +74 vs Torrent, KO-dex record 10–4 (includes the BONK forfeit; the app's own record is 9–4).
- Blink (3 lb, blink-3): current 1551 ± 106 (#158 of 615), all-time 1537 ± 94 (#400 of 1659), peak 1543, type Damage Engine, badge Seasoned Veteran, best win +37 vs Juxtaposition, KO-dex record 13–17 (includes 5 forfeits; the app's own record is 11–14).
- Credit: Ratings and fight types by KO-dex (kodex.bot), an independent fan project, not affiliated with NHRL.

## Live data
- `GET /bots/{bot}/fights` on open, on return to the app, by pull-to-refresh or the refresh button, and every 60 s while visible (toggle in More). Never more than one request per 5 s.
- All stats are recomputed from the fight list on every refresh. BrettZone's aggregate endpoints are wrong for Supernova.
- Rank: BrettZone has no rankings API endpoint. `/stats/leaderboard?metric=wins&weightClass=12` is a wins table with different counting (it lists Supernova at 5W-2L), so the rank shown is the dated snapshot in `bots.js`.
- The `X-API-Key` header is blocked by BrettZone's CORS preflight in browsers, so requests are sent without it.

## Credits
Fight data: BrettZone (brettzone.nhrl.io) by NHRL. Ratings and fight types by KO-dex (kodex.bot), an independent fan project, not affiliated with NHRL (snapshot, as of Oct 3, 2026). Archetypes: NHRL wiki, RobotCombatWiki, Combat Robots Wiki.
Calculators belong to their owners (Brian Boxell / Too Hot Robotics; Level 5 Robotics; FingerTech Robotics; SDP/SI; Gates). They are only embedded or linked; none of their code is copied.

## Deploy
Push this folder to a GitHub repo and enable Pages (root), or drag it into Netlify Drop.
