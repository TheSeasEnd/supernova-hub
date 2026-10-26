# Too Hot to Handle Hub · NHRL stats PWA for team Too Hot to Handle

(Formerly “Supernova Hub”. The URL and repo name are unchanged: https://theseasend.github.io/supernova-hub/.)

Static HTML/CSS/JS, no build step. Serve the folder over HTTPS (or localhost), open on a phone → Add to Home Screen.

## Navigation
Bottom bar: **Overview · Fights (All fights | Events) · Team · Archetypes · Calcs · More**. Tap the robot name in the header to switch bots. Switching swaps everything: Overview, Fights/Events, Archetypes (per-bot opponent mapping and corrections), Calcs (per-bot robot profile) and More (specs, wiki link).
Hash routes: `#overview`, `#fights`, `#team`, `#team/<botId>`, `#archetypes`, `#calc`, `#calc/<id>`, `#more`. Tab switches replace history; calculator sub-pages push history, so the phone's back gesture returns to the list.

## Files
- `index.html`, `styles.css` (ROBO CALC-inspired "hot" theme, our own CSS), `app.js` (router, stats, live updates, screens)
- `bots.js`: bot registry (id, BrettZone name, snapshot, dated rank, specs, notes). Supernova (12lb) and Blink (3lb). Each entry also has `footnoteTitle`/`recordFootnote`, `eventNotes` and `profileDefaults` (robot-profile defaults for the calculators).
- `archetypes.js` + `data/archetypes.json`: editable opponent→archetype mapping with evidence, source URLs and confidence. Taxonomy = NHRL wiki weapon-type categories. Mapping is per bot (`opponents.supernova`, `opponents.blink`) plus `selfArchetypes`. User corrections are saved per bot in localStorage (`sn_arch_overrides_v1` for Supernova, `sn_blink_arch_overrides_v1` for Blink).
- `calcs.js`: Calculators list (ROBO CALC, Ember, FingerTech, SDP/SI, Gates) + native Battery Sag / Max Amps
- `profile.js`: robot profile (`window.RobotProfile`), one per bot (`sn_robot_profile_v1` for Supernova, `sn_blink_robot_profile_v1` for Blink), for calculators and a future robot designer. Blink's defaults use the wiki's 4S LiHV 1100 mAh; other values are labelled generic examples.
- `data/kodex.js`: bundled KO-dex snapshot (see below)
- `data/complete-fights.js` (`window.COMPLETE_FIGHTS`): complete Supernova and Blink fight lists, built from every BrettZone tournament fight list (scanned Oct 25, 2026 3:58 PM ET)
- `data/team.js` (`window.TEAM_DATA`) + `teamview.js`: Team tab (see below)
- `tools/build_data.py`: rebuilds both data files from `/workspace/team-data` (tournament scan + NHRL wiki reconcile)
- `data/snapshot.js`, `data/snapshot-blink.js`: bundled snapshots of BrettZone `/bots/{bot}/fights` plus round names (offline fallback)
- `sw.js`, `manifest.webmanifest`, `icons/`, `fonts/` (Chakra Petch, SIL OFL)

## Battery Sag / Max Amps (built-in estimate)
- Inputs: cells in series (S), **total pack capacity (mAh, the number on the label)**, full-charge and nominal cell V, allowed sag %, and internal resistance as one of: **per-cell IR** (mΩ, per cell; pack = (S ÷ P) × R_cell, so P matters only here), **whole-pack IR** (mΩ), or **C-rating only** (pack-level estimate R_pack ≈ S × 0.4 V ÷ (C × Ah_pack), labelled as an estimate).
- Outputs: pack resistance, I_max = (sag% × S × V_full) ÷ R_pack, loaded voltage at total peak/typical component draw with OK / will-sag warning, Wh = S × V_nominal × Ah_pack.
- Saved in the shared robot profile (`sn_robot_profile_v1`, profile version 2). Profiles saved by older versions (per-cell `capacityMah`) are migrated automatically: total = per-cell mAh × P.

## Records: complete fight lists (v9)
- BrettZone's `/bots/{bot}/fights` leaves out some decided fights: forfeits, fights with no start time, and fights at unlisted events. The app used to count only fights with a start time, which made Supernova 9–4 and Blink 11–14.
- Now every decided fight from the tournament fight lists counts, forfeits included. Byes and unplayed 0-0 placeholders are dropped. A fight with no start time is ordered by its end time.
- **Supernova 10–4.** Adds the April 2026 forfeit win vs BONK. Footnotes: without forfeits 9–4; wiki/rankings convention 10–4.
- **Blink 14–17** over 31 fights. Adds L FF vs IDKWTFID and L FF vs Spectroscope (March 2023 qualifiers), W JD vs Something (Sept 2023 freestyle exhibition), W FF vs The Trundler (March 1, 2025), and keeps the two March 2026 forfeits that have no fight time (W vs Stormsurge, L vs Project LiftOff-3). Footnotes: without forfeits 12–14; NHRL wiki / BrettZone rankings 13–15 (they leave out forfeits from before 2024 and freestyle exhibitions).
- Fight-time stats only use fights with a real length. BrettZone reports `matchLength` = stopTime for fights with no start time. Archetype matchups leave out forfeits.

## Blink (3lb)
- Identity: BrettZone has one Blink (3lb). Its NHRL wiki page lists Builder/Driver Ezequiel Gonzalez Solano, Single Disk weapon, Category: Vertical Spinners. BrettZone 3lb rank #167 (Active season, as of Oct 25, 2026).
- Opponent archetypes come from each opponent's NHRL wiki page. IMPAKT (eggbeater, from the "Beater bar" weapon field) and Zenith (undercutter, "Undahcuttah") are medium confidence. Butter Fly has no wiki page, so it's "unknown".

## KO-dex ratings (snapshot)
- `data/kodex.js` (`window.KODEX`): **KO-dex snapshot, as of Oct 3, 2026 — not live.** Built from the saved pages in `/workspace/kodex-data/` (kodex.bot/bots/supernova-12 and kodex.bot/bots/blink-3). The app never calls kodex.bot (no API, no CORS).
- Wired per bot through `bots.js` (`kodex:`). Overview shows a KO-dex card (current and all-time rating ± RD with class rank, all-time peak, KO-dex type, badges, best win, KO-dex's own record labelled as KO-dex's number, a big link to the bot's KO-dex page, and the credit). Fights shows KO-dex's all-time rating change per fight, matched by BrettZone `tournamentID|gameID`. Forfeits and KO-dex-only fights are listed under their event but not counted.
- Supernova: current 1849 ± 113 (#14 of 178, 12 lb), all-time 1891 ± 108 (#21 of 381), peak 1922, type Executioner, badge Podium ×2, best win +74 vs Torrent, KO-dex record 10–4 (includes the BONK forfeit; the app's own record is now also 10–4).
- Blink (3 lb, blink-3): current 1551 ± 106 (#158 of 615), all-time 1537 ± 94 (#400 of 1659), peak 1543, type Damage Engine, badge Seasoned Veteran, best win +37 vs Juxtaposition, KO-dex record 13–17 (includes 5 forfeits; the app's own record is now 14–17, which also counts the Sept 2023 freestyle exhibition win KO-dex doesn't list).
- Credit: Ratings and fight types by KO-dex (kodex.bot), an independent fan project, not affiliated with NHRL.

## Live data
- The fight list is a union keyed by `tournamentID|gameID`, where later sources win: bundled complete snapshot < bundled bot-endpoint snapshot < live tournament re-scan < live `/bots/{bot}/fights`. A live fetch can only add or update fights, so it can't undercount.
- `GET /bots/{bot}/fights` runs on open, on return to the app, on pull-to-refresh or the refresh button, and every 60 s while visible (toggle in More). Never more than one request per 5 s.
- New-event check: every 15 min (60 s for a manual refresh), `GET /tournaments` (~85 KB). Then the fight lists of up to 6 tournaments for the bot's weight class (or mixed) that were updated since the snapshot (`updateTime` ≥ snapshot − 1 day), 1.5 s apart, about 40-110 KB each. Usually 0-3 lists. Results are cached in localStorage (`sn_<bot>_deep`). The status line shows the snapshot time and when new events were last checked.
- Rank: BrettZone has no rankings API endpoint. `/stats/leaderboard?metric=wins&weightClass=12` is a wins table with different counting (it lists Supernova at 5W-2L), so the rank shown is the dated snapshot in `bots.js`.
- The `X-API-Key` header is blocked by BrettZone's CORS preflight in browsers, so requests are sent without it.

## Team tab · Too Hot to Handle
- Bundled snapshot only (scanned Oct 25, 2026 3:58 PM ET, labelled "not live"). It combines the BrettZone tournament fight lists with each bot's NHRL wiki Full Fight History. A fight found in both is counted once with BrettZone's result. Wiki-only fights count only before 2024, and 2024+ wiki-only rows (duplicates with conflicting results) are dropped.
- Team totals, filters (All / 3lb / 12lb / 30lb / In build), and one card per robot: combined record, record without forfeits, streak, class, builder, weapon, last event, team channel, and source counts (BZ / WIKI / BOTH).
- Planned bots Rupture, Rapier, Scope Creep and Sux2Suck are shown as "in build". Clyde is tagged to the Alex and Gabe channel. Phantom IV has unknown builder and weapon, with Phantom III as history (not in the totals).
- Tap a card (`#team/<id>`) for its fight list by year, each fight tagged by source, with conflict notes. Fireball vs Apex (2023-06-24) and Fully Defined vs Synthesis (May 2023, still unresolved) both use BrettZone's win, as Ezequiel approved. Supernova and Blink cards have a button to open their live stats.

## Credits
Fight data: BrettZone (brettzone.nhrl.io) by NHRL. Older fights, builders and specs: NHRL wiki. Team: Too Hot to Handle / Too Hot Robotics (Brian Boxell). Ratings and fight types by KO-dex (kodex.bot), an independent fan project, not affiliated with NHRL (snapshot, as of Oct 3, 2026). Archetypes: NHRL wiki, RobotCombatWiki, Combat Robots Wiki.
Calculators belong to their owners (Brian Boxell / Too Hot Robotics; Level 5 Robotics; FingerTech Robotics; SDP/SI; Gates). They are only embedded or linked; none of their code is copied.

## Deploy
Push this folder to a GitHub repo and enable Pages (root), or drag it into Netlify Drop.

## v10: a hub for every robot on the roster

- The robot switcher (tap the name in the header) now lists the whole Too Hot to Handle roster. It's grouped into **Mine** (Supernova, Blink), **Team · 3lb / 12lb / 30lb** and **In build**, and you can search it. The list scrolls inside the sheet, so it works on a phone.
- Every team robot gets the full hub: Overview, Fights and Archetypes. Fights come from the combined team snapshot (`data/team.js`), which is BrettZone tournament fight lists plus NHRL wiki history, reconciled. Each fight is tagged BOTH, BZ or WIKI.
  - Overview adds an identity card for robots with no hero photo or ranking, a by-year table, a sources card linking to the Team-tab detail, and Phantom III history on Phantom IV.
  - Rematches are capped at the top 10.
- **Live vs snapshot:**
  - Supernova and Blink keep full live refresh.
  - Team robots that fought in 2026 (`live: true` in bots.js) also refresh from BrettZone. The live data merges onto the snapshot by `tournamentID|gameID`, aliased by tournament + match + both robots because BrettZone sometimes lists a match twice, so counts never drop.
  - All other robots are labelled "Snapshot, not live" and don't fetch.
- Planned robots (Rupture, Rapier, Scope Creep, Sux2Suck) get an "In build" hub with no fights.
- Archetypes fall back to `data/opptypes.js`, which is built automatically from NHRL wiki weapon-type categories for every opponent. Hand-curated entries and your own overrides still take priority. A robot's own type comes from the same map.
- Team tab cards open the robot's hub. Source detail is still at `#team/<id>`, linked from the hub's Overview.
- Calcs stays global: switching to a team robot doesn't change your Calcs profile.
- Credits: KO-dex shows only for robots with KO-dex data. Team robots get an NHRL wiki credit.
- Service worker cache: `supernova-v10`.

## v11: sourced builder and weapon facts

- Phantom IV builder: Nik Buchholz (Team Bloodsport), per Ezequiel and the builder's own project page. Weapon: spinner with a blade, per Robot Combat Events and the builder's page. Whether it spins horizontally or vertically isn't stated anywhere.
- Phantom III (history): Nik Buchholz, overhead bar spinner (horizontal), per the NHRL wiki and the builder's page.
- Juxtaposition builder: Kekoto Maane, per the BrettZone Hero's Gallery and the Builders Database.
- Luna builder: Connor Howard, per the BrettZone Hero's Gallery. Luna's weapon is still unknown.
- Barbie builder: Brian Boxell, per the BrettZone Hero's Gallery.
- Barbie and Ken's weapon is still unknown.
- Each filled field has a per-field source credit (`facts` in data/team.js) shown on the robot's hub and its Team-tab detail.
- Service worker cache: `supernova-v11`.

## v12: team-confirmed weapons (per Ezequiel / team)

- Luna: vertical spinner. Barbie: beater bar (vertical eggbeater). Barbie and Ken: multibot, Barbie's weapon a beater bar and Ken's a drum. Juxtaposition's builder, Kekoto Maane, is confirmed by the team.
- These override the wiki-category archetype map (`TEAM_TYPES` in tools/build_data.py). Archetypes show them with a "Per team" badge.
- Service worker cache: `supernova-v12`.

## v13: robot photos

- Each robot's hub Overview, Team card and Team detail now show a photo, bundled as roughly 600px webp in `img/bots/` (about 270 KB total) and cached by the service worker. Every photo has a credit line linking to its source. They're built by `tools/build_photos.py`, and the metadata is in `data/photos.js`.
- Sources:
  - BrettZone Hero's Gallery stills: Eruption, Caldera 12, Clyde, Luna, Alan, Barbie, and the Supernova/Blink thumbnails.
  - NHRL wiki page images: Caldera, The Power of Friendship!, Juxtaposition, Cereal Killer, Plot Twist, Phantom III, Stoneforge, Fully Defined, Fireball, Thumb War.
  - The builder's site (nikbuchholz.weebly.com): Phantom IV.
- Barbie and Ken has no photo; none was found. Planned robots show a "No robot yet" placeholder.
- The Supernova and Blink hubs keep their existing BrettZone hero images.

## v14: Too Hot to Handle Hub

- The app is now **Too Hot to Handle Hub** everywhere visible: the header name line, the page title, the manifest (`name` “Too Hot to Handle Hub”, `short_name` “Too Hot Hub”), the iOS home-screen title and the About card. It has a new flame icon.
- The robot switcher is grouped only by weight class (3lb / 12lb / 30lb) plus In build. Supernova and Blink sit in their class groups with their live tags. Search still works.
- On first load the app opens Supernova. After that it opens the last robot you picked (`sn_current_bot`).
- Service worker cache: `supernova-v14`.

## v15: desktop / tablet layout + switcher scrolling

- **Phones (up to 899px) are unchanged.** Screenshots at 390×844 match v14 apart from the "updated" time.
- **At 900px and wider:**
  - **Sidebar:** the bottom tab bar becomes a left sidebar. It holds the app name and flame icon, the current robot's photo, record and live/snapshot tag, a Switch robot button (`/`), a Refresh button, and the tabs in the order Overview, Fights, Archetypes, Calcs, Team, More.
  - **Content:** uses up to 1400px of width.
    - Overview, Archetypes and More lay out as masonry columns, so cards keep their natural height.
    - Fights show 2–3 fight cards per row inside each event.
    - Team is a 4-across card grid with the filters on top.
    - Calcs is a card grid. Embedded calculators such as ROBO CALC fill the window height.
  - **Switcher:** a wide popover with search and weight-class groups laid out in columns.
  - **Hover and focus:** hover states on fights, cards and tabs, plus visible keyboard focus.
- **Keyboard:**
  - `/` opens the switcher with search focused.
  - Typing filters the list, and Enter picks the first match.
  - ↑/↓ move through the robots, and Esc closes.
  - In the sidebar, ↑/↓ move between tabs.
- **Tablets (900–1100px):** a narrower sidebar (216px) and narrower columns.
- **Switcher scrolling (all sizes):**
  - The robot list is its own scroll container (max-height, `overflow-y:auto`, `overscroll-behavior:contain`).
  - The page behind is locked while the switcher is open (body `position:fixed` keeps your scroll position, which is restored on close; this works for wheel and touch).
- Service worker cache: `supernova-v15`.

## v16: calculators

- The Ember calculators (Level 5 Robotics) are no longer embedded. They're link-outs that open in a new tab (`target=_blank rel=noopener`), styled like the other link-out calculators, with their descriptions and the Level 5 Robotics credit kept.
- ROBO CALC is the only embedded calculator. ROBO CALC is a responsive page (content up to ~900px, two-column modules above 768px), so on desktop the frame gets its natural width (up to 1000px, centred) and the full window height, with no scaling. "Open in browser" is kept both in the list and on the embed screen.
- Service worker cache: `supernova-v16`.

## v17: Comet added

- Comet (3lb, builder/driver Connor Howard, vertical spinner) joins the roster, per Ezequiel. Sources: NHRL wiki Comet and Connor Howard pages (Connor also builds team bots Plot Twist and Luna), and BrettZone (`comet`, 3lb only).
- 29–13 combined (26–10 without forfeits). All 42 fights appear in both the BrettZone tournament scan and the wiki table. Comet shows in the switcher (3lb group), the Team tab card and team totals, and has its own hub. Its photo is a BrettZone Hero’s Gallery hero shot (October 2025, still #117), credited.
- Archetype: vertical spinner (wiki category Vertical Spinners). Discord channel isn't known. “Sun, moon, and comet” (Feb 2026) is a different bot and isn't included.
- Service worker cache: `supernova-v17`.

## v18: Slipstream (in build)

- Slipstream added as a planned robot (per Ezequiel), like Rupture, Rapier, Scope Creep and Sux2Suck: an "In build" hub, the switcher's In build group, and a Team tab In build card. Class, builder, weapon and Discord channel are Unknown. BrettZone search and the NHRL wiki have no "slipstream" entries (checked Oct 25, 2026, 8:15 PM ET).
- Planned robots with no known channel show Class/Builder/Weapon as Unknown on More.
- Service worker cache: `supernova-v18`.
