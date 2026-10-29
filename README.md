# Too Hot to Handle Statistics Hub · NHRL stats PWA for team Too Hot to Handle

(Formerly “Supernova Hub”. The URL and repo name are unchanged: https://theseasend.github.io/supernova-hub/.)

Static HTML/CSS/JS, no build step. Serve the folder over HTTPS (or localhost), open on a phone → Add to Home Screen.

## Navigation
Bottom bar: **Overview · Fights (All fights | Events) · Team · Archetypes · Calcs · More**. The Weight Budget sheet lives in Calcs (`#calc/weight`). Tap the robot name in the header to switch bots. Switching swaps everything: Overview, Fights/Events, Archetypes (per-bot opponent mapping and corrections), Calcs (per-bot robot profile) and More (specs, wiki link).
Hash routes: `#overview`, `#fights`, `#team`, `#team/<botId>`, `#archetypes`, `#calc`, `#calc/<id>`, `#more` (old `#weight` links redirect to `#calc/weight`). Tab switches replace history; calculator sub-pages push history, so the phone's back gesture returns to the list.

## Files
- `index.html`, `styles.css` (ROBO CALC-inspired "hot" theme, our own CSS), `app.js` (router, stats, live updates, screens)
- `bots.js`: bot registry (id, BrettZone name, snapshot, dated rank, specs, notes). Supernova (12lb) and Blink (3lb). Each entry also has `footnoteTitle`/`recordFootnote`, `eventNotes` and `profileDefaults` (robot-profile defaults for the calculators).
- `archetypes.js` + `data/archetypes.json`: editable opponent→archetype mapping with evidence, source URLs and confidence. Taxonomy = NHRL wiki weapon-type categories. Mapping is per bot (`opponents.supernova`, `opponents.blink`) plus `selfArchetypes`. User corrections are saved per bot in localStorage (`sn_arch_overrides_v1` for Supernova, `sn_blink_arch_overrides_v1` for Blink).
- `calcs.js`: Calculators list (ROBO CALC, Ember, FingerTech, SDP/SI, Gates) + native Battery Sag & Wh (`sagcalc.js` UI, `sagmath.js` math)
- `weightmath.js` (limits, totals, CSV/XLSX/zip; tests: `node tools/test_weightmath.js`) + `weightview.js`: Weight Budget calculator (in Calcs)
- `profile.js`: robot profile (`window.RobotProfile`), one per bot (`sn_robot_profile_v1` for Supernova, `sn_blink_robot_profile_v1` for Blink), for calculators and a future robot designer. Blink's defaults use the wiki's 4S LiHV 1100 mAh; other values are labelled generic examples.
- `data/kodex.js`: bundled KO-dex snapshot (see below)
- `data/complete-fights.js` (`window.COMPLETE_FIGHTS`): complete Supernova and Blink fight lists, built from every BrettZone tournament fight list (scanned Oct 25, 2026 3:58 PM ET)
- `data/team.js` (`window.TEAM_DATA`) + `teamview.js`: Team tab (see below)
- `tools/build_data.py`: rebuilds both data files from `/workspace/team-data` (tournament scan + NHRL wiki reconcile)
- `data/snapshot.js`, `data/snapshot-blink.js`: bundled snapshots of BrettZone `/bots/{bot}/fights` plus round names (offline fallback)
- `sw.js`, `manifest.webmanifest`, `icons/`, `fonts/` (Chakra Petch, SIL OFL)

## Battery Sag & Wh (built-in, general purpose; v22)
See the v22 section at the end of this file. The math is in `sagmath.js` (tests: `node tools/test_sagmath.js`), the UI in `sagcalc.js`. It no longer reads or writes the robot profile.

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
- Team totals, filters (All / 3lb / 12lb / 30lb / In progress), and one card per robot: combined record, record without forfeits, streak, class, builder, weapon, last event, team channel, and source counts (BZ / WIKI / BOTH).
- Planned bots Rupture, Rapier, Scope Creep and Sux2Suck are shown as "in progress". Clyde is tagged to the Alex and Gabe channel. Phantom IV has unknown builder and weapon, with Phantom III as history (not in the totals).
- Tap a card (`#team/<id>`) for its fight list by year, each fight tagged by source, with conflict notes. Fireball vs Apex (2023-06-24) and Fully Defined vs Synthesis (May 2023, still unresolved) both use BrettZone's win, as Ezequiel approved. Supernova and Blink cards have a button to open their live stats.

## Credits
Fight data: BrettZone (brettzone.nhrl.io) by NHRL. Older fights, builders and specs: NHRL wiki. Team: Too Hot to Handle / Too Hot Robotics (Brian Boxell). Ratings and fight types by KO-dex (kodex.bot), an independent fan project, not affiliated with NHRL (snapshot, as of Oct 3, 2026). Archetypes: NHRL wiki, RobotCombatWiki, Combat Robots Wiki.
Calculators belong to their owners (Brian Boxell / Too Hot Robotics; Level 5 Robotics; FingerTech Robotics; SDP/SI; Gates). They are only linked (each opens in a new tab); none is embedded and none of their code is copied.

## Deploy
Push this folder to a GitHub repo and enable Pages (root), or drag it into Netlify Drop.

## v10: a hub for every robot on the roster

- The robot switcher (tap the name in the header) now lists the whole Too Hot to Handle roster. It's grouped into **Mine** (Supernova, Blink), **Team · 3lb / 12lb / 30lb** and **In progress**, and you can search it. The list scrolls inside the sheet, so it works on a phone.
- Every team robot gets the full hub: Overview, Fights and Archetypes. Fights come from the combined team snapshot (`data/team.js`), which is BrettZone tournament fight lists plus NHRL wiki history, reconciled. Each fight is tagged BOTH, BZ or WIKI.
  - Overview adds an identity card for robots with no hero photo or ranking, a by-year table, a sources card linking to the Team-tab detail, and Phantom III history on Phantom IV.
  - Rematches are capped at the top 10.
- **Live vs snapshot:**
  - Supernova and Blink keep full live refresh.
  - Team robots that fought in 2026 (`live: true` in bots.js) also refresh from BrettZone. The live data merges onto the snapshot by `tournamentID|gameID`, aliased by tournament + match + both robots because BrettZone sometimes lists a match twice, so counts never drop.
  - All other robots are labelled "Snapshot, not live" and don't fetch.
- Planned robots (Rupture, Rapier, Scope Creep, Sux2Suck) get an "In progress" hub with no fights.
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
  - NHRL wiki page images: Caldera, The Power of Friendship!, Juxtaposition, Cereal Killer, Phantom III, Stoneforge, Fully Defined, Fireball, Thumb War.
  - Team-supplied: Plot Twist (since v27; transparent PNG from the team, replaces the wiki image).
  - The builder's site (nikbuchholz.weebly.com): Phantom IV.
- Barbie and Ken has no photo; none was found. Planned robots show a "No robot yet" placeholder.
- The Supernova and Blink hubs keep their existing BrettZone hero images.

## v14: Too Hot to Handle Hub

- The app is now **Too Hot to Handle Hub** everywhere visible: the header name line, the page title, the manifest (`name` “Too Hot to Handle Hub”, `short_name` “Too Hot Hub”), the iOS home-screen title and the About card. It has a new flame icon.
- The robot switcher is grouped only by weight class (3lb / 12lb / 30lb) plus In progress. Supernova and Blink sit in their class groups with their live tags. Search still works.
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
    - Calcs is a card grid.
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

## v18: Slipstream (in progress)

- Slipstream added as a planned robot (per Ezequiel), like Rupture, Rapier, Scope Creep and Sux2Suck: an "In progress" hub, the switcher's In progress group, and a Team tab In progress card. Class, builder, weapon and Discord channel are Unknown. BrettZone search and the NHRL wiki have no "slipstream" entries (checked Oct 25, 2026, 8:15 PM ET).
- Planned robots with no known channel show Class/Builder/Weapon as Unknown on More.
- Service worker cache: `supernova-v18`.

## v19: "In build" renamed to "In progress"

- Every user-visible "In build" label now says "In progress": the switcher group, the Team tab filter, section title and card badges, the planned-robot hub and status lines, and the More tab specs. (Earlier README sections are updated to the new wording.)
- Internal ids are unchanged (`group: 'build'`, filter key `build`, `plan-<id>` bot ids, `data-plan`, CSS `.tbuild`), so saved selections and `#team` routes keep working.
- Service worker cache: `supernova-v19`.

## v20: fewer tags

- Removed the purple `#channel` chips (Discord team-channel tags) from the Team tab cards, the Team robot detail, the hub Overview ID card and the In progress cards and hub.
- Removed the "live" tags: "★ yours · live" on Team cards, "· live" in switcher rows (including "Current · live"), and the "● Live" tag in the desktop sidebar.
- Live refresh still works, and the hub's status line ("Live · updated …") is unchanged. Class chips, BZ/WIKI/BOTH source chips, streak pills and IN PROGRESS badges are unchanged. The More tab still lists the team channel as plain text.
- Service worker cache: `supernova-v20`.

## v21: Battery Sag calculator greyed out

- The built-in Battery Sag / Max Amps card in Calcs is greyed out (low opacity, greyscale, not clickable) with a "Coming soon" label, on phone and desktop. The code is still there: delete `disabled: true` on the `battery` entry in `calcs.js` to turn it back on.
- Deep links and saved routes to `#calc/battery` show the Calcs list instead (the URL is rewritten to `#calc`). The other calculators are unchanged.
- Service worker cache: `supernova-v21`.

## v22: Battery Sag & Wh rebuilt (general purpose) and re-enabled
- The `disabled` flag is removed from the `battery` entry in `calcs.js`; the card now reads "Battery Sag & Wh". `#calc/battery` opens it.
- **General purpose**: nothing is tied to Supernova or Blink. Every input is typed in; presets fill editable fields. The working setup and named "saved setups" are kept in localStorage `sag_calc_v1` (this device only).
- **Wh converter** at the top: volts × mAh, or fill volts from S × the chemistry's nominal voltage.
- **Battery**: chemistry preset (LiPo 4.2/3.7, LiHV 4.35/3.8, Li-ion 4.2/3.6, LiFePO4 3.6/3.2; full/nominal editable), S, P, capacity as total pack mAh or per cell × P. Resistance comes from (a) a measured value per cell or for the whole pack, (b) a quality-class estimate R_cell = k ÷ Ah_cell with k = 7 good / 10 average / 15 poor (editable), or (c) the label C-rating: R_cell = sag at real peak (0.5 V) ÷ (realism 0.5 × C × Ah_cell). With C mode, C × Ah is shown only as a "label max", never used.
- **Conditions & wiring**: resting V/cell late in the match (3.75 default), a "fresh pack" toggle, a temperature/age factor (1.0), and harness resistance typed in directly (8 mΩ assumed) or built from wire gauge + length, connectors and switch.
- **Loads** (add or remove rows): weapon (spin-up A and s, re-spins per match, steady A), drive (cruise A, push A and s, pushes per match), other (average and peak A). Each row has quantity, duty % and an optional ESC current limit. Use battery-side amps.
- **Scenarios**: worst case (every burst at once, late in the match, with harness, 1.3× resistance for bursts over 5 s); opening spin-up (weapon spin + drive cruise, fresh pack); match average (duty-weighted amps, mAh per match and % of pack, runtime, average C vs a continuous estimate of 0.55 × the current for 0.5 V/cell sag).
- **Outputs**: pack R, sag split pack/harness, loaded V per cell and per pack, margins to the ESC cutoff, floor and BEC minimum, I²R heat, max amps for a chosen floor (late/fresh, short/long burst), Wh.
- **Verdicts**: PASS ≥ 3.5 V/cell, WARN 3.3–3.5, FAIL < 3.3 or below the ESC cutoff or BEC minimum. All thresholds are editable and marked "suggested"; Li-ion and LiFePO4 presets set their own lower thresholds.
- A collapsible "How this works" section lists the formulas, sources and caveats.
- "Fill generic example" loads a clearly labelled example (4S 1300 mAh good-quality pack, 40 A weapon spin-up, two drive motors) that gives WARN / PASS / PASS.
- Tests: `node tools/test_sagmath.js` (44 checks against the worked examples in the sag math review plus S/P, harness, temperature and verdict sanity checks).
- The old robot-profile battery code was removed from `calcs.js`. `profile.js` is still loaded for other uses. Ember links are unchanged.
- SW cache `supernova-v22` (adds `sagmath.js`, `sagcalc.js`).

## v23: Weight tab (work in progress)
- New 7th tab **Weight** (`#weight`), marked with the dashed "Work in progress" badge (same `.tbuild` style as "In progress" robots; a small "WIP" tag in the desktop sidebar). A weight budget spreadsheet per robot, tied to the robot switcher and saved per robot in localStorage (`wb_v1_<botId>`).
- **Parts**: name, category, quantity, unit weight, total, weight source (measured / estimated / CAD / datasheet), notes. Grouped by category (Weapon, Drive, Electronics, Battery, Armor/Chassis, Fasteners/Hardware, Other, plus your own categories) with subtotals. Weights are stored in grams; you can enter and view them in g, oz or lb.
- **3D print** checkbox per part: material (with density), infill %, walls, layer height, slicer estimate (g), measured after print (g), optional model volume (cm³, gives a 100%-solid upper bound). Shows measured vs slicer delta. The weight used is the measured value, then the slicer estimate, then the typed unit weight. Entering a measured weight sets the source to "measured".
- **Exempt** checkbox per part (with reason) for weigh-in exemptions; exempt parts are listed but not counted.
- **Limit**: weight class (from the robot when known, else Unknown until you pick), **locomotion type**, multibot segments, optional custom override (lb), and an editable warn margin (default 5% since v24; was 3%). The bar shows OK / CLOSE (within the margin) / OVER, with the remaining margin, the NHRL weigh-in penalty when over, and per-segment bars for multibots.
- **Rules used** (NHRL Open Rules 2026, https://wiki.nhrl.io/wiki/index.php?title=NHRL_Open_Rules_-_2026, last edited Sep 28, 2026, checked Oct 28, 2026):
  - Classes 3 / 12 / 30 lb; at or below the class maximum at the start of each fight. No stated tolerance. Pre-fight weight check: up to 2.5 oz over = 1 TKO point; more than 2.5 oz over = 3 TKO points and an immediate TKO.
  - Locomotion: Traditional (wheels of any form, treads, tracks, belts, spinning shafts) = no bonus. Non-traditional (examples given: shuffling, bristle bots, flying systems, gyroscopic precession, torque reaction, Jansen linkages, hovercrafts) = +1.5 / +6 / +15 lb. True walker = +3 / +12 / +30 lb, needs NHRL approval before registration.
  - Multibot bonus, max per segment: 3lb 2 / 1.33 / 1 lb, 12lb 8 / 5.33 / 4 lb, 30lb 20 / 13.33 / 10 lb (2 / 3 / 4 segments).
  - Locomotion and multibot bonuses cannot be combined (the app flags it and applies no bonus). Exemptions (dry weight for fuel/fluids/gas tanks, autonomous-only electronics, active cameras) can be combined with bonuses.
- **Files**: Export Excel (.xlsx, two sheets: Parts with `=Qty*Unit` formulas, Summary with SUMIFS totals; written with a tiny built-in zip writer, no libraries), Export CSV (UTF-8 BOM, CRLF, Excel quoting, grams), template CSV, import CSV/TSV/semicolon CSV/.xlsx (first sheet; deflated xlsx needs `DecompressionStream`) with tolerant column matching and a preview (add or replace), JSON backup/restore of all robots' sheets.
- Filament densities (g/cm³, ISO 1183) from manufacturer data sheets: Bambu Lab PLA Basic 1.24, PETG Basic 1.25, ABS 1.05, ASA 1.05, PA6-CF 1.09, PAHT-CF 1.06, GF nylon (PA6-GF) 1.14, TPU 95A HF 1.22; Polymaker PolyMide CoPA (nylon) 1.12. "Other" takes your own density and is flagged typical/unsourced.
- Phone: cards (tap to edit). Desktop (≥900px): spreadsheet table with inline cells, summary and limit cards side by side.
- SW cache `supernova-v23` (adds `weightmath.js`, `weightview.js`).

## v24: Weight tab tweaks
- Default "close to limit" warn margin is now **5%** (was 3%), still editable. Sheets saved by v23 that still had the old 3% default (or a blank) switch to 5%; any other saved value is kept as a custom margin. Typing a value other than 5 marks it custom (`warnCustom`), so later default changes won't overwrite it. Sheet format version 2.
- Filament dropdown labels: "GF nylon (PA6-GF) · 1.14" and "PAHT-CF (CF nylon) · 1.06" (Bambu Lab data sheets, unchanged values).
- SW cache `supernova-v24`.

## v25: 1lb class on the Weight tab
- NHRL's 2026 rules define only 3lb, 12lb and 30lb ("NHRL offers three weight classes"); the "1 lb" in them is only the 4-part multibot segment limit for 3lb. So the new **1lb** option is labelled "1lb (SPARC rules; not an NHRL class)" and uses the **SPARC Robot Construction Specifications v1.7** (Sep 1, 2026), https://sparc.tools/SPARC_Robot_Construction_Specifications_v1.7.pdf, section 3 "Weight Classes": rolling 1 lb (454 g), shufflers 1.25 lb (1.25×), non-traditional 1.5 lb (1.5×), walkers 2 lb (2×). Section 4 definitions are quoted in the UI. Why SPARC: 1lb events held in the NHRL pits list "General SPARC rules" (e.g. Shri's Garden Club, Oct 2, 2026: https://www.robotcombatevents.com/events/10157).
- Locomotion mapping for 1lb: traditional = rolling; shuffler = 1.25×; bristle bot, torque reaction, gyroscopic precession, hovercraft = non-traditional 1.5×; flying = 1.5× but flagged (SPARC: "may be allowed at some events"); walker = 2×, flagged to confirm with the event (SPARC's walker definition differs from NHRL's). **Unverified, flagged, no guess:** Jansen linkage (not listed by SPARC; no bonus applied), "other non-traditional" (1.5× shown but marked unverified), and any multibot bonus (SPARC defines none; segments share the 1 lb). The custom limit override covers whatever the event decides.
- 1lb has no NHRL weigh-in penalty text (SPARC states no tolerance); NHRL TKO notes stay on NHRL classes only.
- Class labels now match the rules' own wording: "3lb", "12lb", "30lb" (the beetleweight/hobbyweight/featherweight names were mine, not NHRL's, and are gone).
- SW cache `supernova-v25`.

## v26: Weight moves into Calcs; Battery Sag greyed out again
- **Battery Sag & Wh** is greyed out again with the "Coming soon" tag (`disabled: true, disabledLabel: 'Coming soon'` on the `battery` entry in `calcs.js`, with a comment). The card can't be opened and `#calc/battery` falls back to the list. `sagcalc.js`/`sagmath.js` are unchanged; delete the flag to turn it back on.
- **Weight** is no longer a top-level tab (back to 6: Overview, Fights, Team, Archetypes, Calcs, More). It is now the **Weight Budget** card under "Built in" in Calcs, with the dashed "Work in progress" badge, and opens in-app at `#calc/weight` with a "‹ Calculators" back button. Old `#weight` links redirect there.
- All Weight features are unchanged: per-robot sheets (same `wb_v1_<botId>` storage, so saved data carries over), the robot switcher still drives the sheet, CSV/XLSX/JSON import and export, limits and flags.
- `weightview.js` now exposes `WeightView.mount(el)` (called by `calcs.js`) and `rerender()` (called through `Calcs.rerender()` on robot switch).
- Tests: `node tools/test_calcs.js` (calc list config, 6 tabs, redirect, SW version) plus the existing weight and sag math tests.
- SW cache `supernova-v26`.

## v27: ROBO CALC becomes a link-out
- ROBO CALC (Brian Boxell / Too Hot Robotics) is no longer embedded in an iframe. Like the Ember calculators since v16, its card in Calcs has an "Open ↗" link that opens https://bdboxell.github.io/robocalc/ in a new tab (`target=_blank rel=noopener`). The title, description and credit (linking github.com/bdboxell/robocalc) are unchanged; it sits under its own "ROBO CALC (opens in browser)" group. The More tab credit now says it is linked, not embedded.
- The iframe code is gone: `renderEmbed`, the `embedmode` class, the "Open here"/"Open in browser" pair, the phone CSV note, and the `.framewrap`/`.calcnote`/`.ci-ext`/embed-height CSS (including the v16 desktop frame sizing). No calculator is embedded any more.
- Old `#calc/robocalc` links (and any unknown, disabled or link-out `#calc/<id>`) show the Calcs list and the URL is rewritten to `#calc`. Only native calcs (Weight Budget; Battery Sag when re-enabled) open in-app.
- Tests: `node tools/test_calcs.js` also checks that ROBO CALC is a link with Brian's credit and that no iframe code is left.
- **Plot Twist photo**: replaced with the team's own transparent PNG (kept in `/workspace/team-data/raw/photos/team_plottwist.png`, entry `kind='team'` in `tools/build_photos.py`). Same pipeline as the other photos: trimmed to the alpha bounding box, 600px wide (600x427), WebP q72, `cut: true` so it sits on the dark panel like the other cut-outs. Credit now reads "Too Hot to Handle (team photo) · Plot Twist, photo supplied by the team" with no wiki link (`teamview.js` shows a plain credit when a photo has no URL).
- SW cache `supernova-v27`.

## v28: renamed to Too Hot to Handle Statistics Hub
- The app is now **Too Hot to Handle Statistics Hub** everywhere visible: header/sidebar name line, page `<title>` (`<robot> · Too Hot to Handle Statistics Hub`), meta description, manifest `name`, the About card in More, and the weight backup error message.
- Home-screen name (`short_name`, `apple-mobile-web-app-title`, `application-name`): **TH2H Stats** (10 characters, fits under an iOS/Android icon without truncation).
- Layout: the header name is split into "Too Hot to Handle" + "Statistics Hub". The desktop sidebar wraps it onto two lines after "Handle". Phones 375px and wider show the full name on one line; narrower phones show "Too Hot to Handle Stats Hub" so the refresh button stays on screen (below 340px the letter spacing is also tightened). The full name stays in the element's `title`/`aria-label`.
- Weight backup JSON: `app` is now `too-hot-to-handle-statistics-hub` and the file is `too-hot-statistics-hub-weight-backup-<date>.json`. Import only checks `kind: 'weight-budget'`, so older backups still restore. CSV/XLSX file names use the robot name and never contained the app name.
- Repo name and URL are unchanged (TheSeasEnd/supernova-hub, theseasend.github.io/supernova-hub).
- Fix (bug from v27): reloading the page on `#calc/weight` dropped back to the Calcs list, because the startup re-render of the list rewrote any `#calc/<id>` hash. The fallback rewrite now only happens when a specific unknown, disabled or link-out id is opened.
- Tests: `node tools/test_branding.js`. SW cache `supernova-v28`.

## v29: landing page (title screen)
- Opening the bare site URL (no `#…`) shows a title screen: flame mark, "Too Hot to Handle / Statistics Hub", a one-line tagline, a **Meet the team →** button (goes to `#team`) and the BrettZone / NHRL wiki credit line. It is not a tab: it has no nav entry, the header is hidden and the bottom tab bar / desktop sidebar stay visible (dimmed, no tab highlighted) so any tab can be used to leave.
- **Once per tab session.** The landing shows only when the URL has no hash and `sessionStorage['th2h_landing_left']` is unset (an inline script in `index.html` sets `html.landing-on` before first paint, so there's no flash of the Overview). Leaving it by the button, a tab, a link, the robot switcher or a typed hash sets the flag, and the bare-URL history entry is *replaced* (`history.replaceState`) by the new tab, so Back can't return to it.
- Reloading while still on the landing shows it again. After leaving, the URL always carries the tab, so reloads stay on that tab; if the bare URL is opened again in the same tab session it goes to the last tab (`sessionStorage['th2h_last_hash']`, default `#overview`).
- Deep links (`#team`, `#fights`, `#calc/weight`, old `#weight`, …) skip the landing entirely.
- Installed PWA: `start_url` is the bare `./`, so each fresh launch (new session) starts on the landing page.
- Animation (fade/rise and a slow glow on the flame) only runs with `prefers-reduced-motion: no-preference`.
- Tests: `node tools/test_landing.js`. SW cache `supernova-v29`.

## v30: Morningstar added
- **Morningstar** (one word; 3lb) joins the roster, per the user. Reference: the NHRL wiki page the user gave, https://wiki.nhrl.io/wiki/index.php?title=Morningstar, plus BrettZone `morningstar` (https://brettzone.nhrl.io/brettZone/v2/b/morningstar).
- Facts: weight class 3lb (wiki and BrettZone). Weapon "Vertical Disk Thwack Bot" (wiki), archetype **Unique weapon** (wiki category Unique Weapons). Builder **Nick Grumski** is user-provided and flagged as such: the wiki page says Builder (TBA) / Driver (TBA), and Nick Grumski's wiki page (same spelling) lists Rapier, Saber and Alan but not Morningstar. BrettZone has no builder field. No Discord channel given.
- Record **2–2** (no forfeits; streak L1), all at NHRL October 2024 3lb on Oct 26, 2024: qualifiers L Chippy (JD), W Fang Tooth (JD), W Black Beans (KO); bracket R1 L Name TBD (JD). All 4 fights are in both BrettZone and the wiki table (source BOTH), so nothing was wiki-only and the pre-2024 wiki rule didn't apply.
- Only one robot named Morningstar exists: BrettZone search finds a single `morningstar` (the other "morning" hit, Morning Shot, is a different bot) and the wiki's only Morningstar robot page is this one ("Max Morningstar" and "Olivia Morningstar" are people pages).
- Photo: no BrettZone Hero's Gallery still exists (all 1,082 stills checked), so it uses the wiki image File:Morningstar-Oct24.png (transparent, trimmed, 600px WebP), credited "NHRL wiki · Morningstar, October 2024".
- Its 4 opponents got archetypes from their wiki categories (Chippy hammersaw, Fang Tooth horizontal spinner, Black Beans unique, Name TBD lifter). Nothing else in the roster changed (checked: every other bot's data is identical after the rebuild).
- Pipeline: `raw/brettzone/morningstar.json`, `raw/wiki_html/Morningstar.json`, `raw/morningstar/` in team-data; `compute_tournament_scan.py` and `reconcile.py` include it; `tools/build_data.py` and `tools/build_photos.py` have its entry. Tests: `node tools/test_roster.js`. SW cache `supernova-v30`.

## v31: reload goes to the landing page
- **Every browser reload shows the landing page**, whatever tab you were on (Calcs, the Weight sheet, a robot profile, …). The inline script in `index.html` checks `performance.getEntriesByType('navigation')[0].type === 'reload'` before first paint; on a reload it drops the hash with `history.replaceState` (address bar becomes the bare URL, so a second reload lands there too) and turns the landing on.
- Fresh opens: the bare URL shows the landing; a fresh deep link (`#team`, `#calc/weight`, `#team/morningstar`, old `#weight`) still skips it. Back/forward into the app (navigation type `back_forward`) restores the tab you were on.
- The v29 once-per-session flag (`sessionStorage['th2h_landing_left']`) is gone; it isn't needed now that every reload and bare-URL open shows the landing.
- Still true: once you leave the landing, its history entry is replaced by the tab, so the nav and Back can't return to it during that page's lifetime.
- The in-app **Refresh** button and pull-to-refresh only re-fetch fight data (they never reload the page), so they keep you on the current tab.
- Service worker: it activates with `skipWaiting`/`clients.claim` and the app never calls `location.reload()`, so a new version can't cause a reload loop (tested: no extra navigations after a reload with the SW in control). Weight Budget sheets live in localStorage (`wb_v1_<botId>`) and are unchanged by reloads (tested: same saved data and parts after two reloads).
- Tests: `node tools/test_landing.js` (updated). SW cache `supernova-v31`.

