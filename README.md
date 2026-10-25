# Supernova · NHRL 12lb stats PWA (multi-bot ready)

Static HTML/CSS/JS, no build step. Serve the folder over HTTPS (or localhost), open on a phone → Add to Home Screen.

## Navigation
Bottom bar: **Overview · Fights (All fights | Events) · Archetypes · Calcs · More**. Tap the robot name in the header to switch bots (Blink is listed as "coming soon").
Hash routes: `#overview`, `#fights`, `#archetypes`, `#calc`, `#calc/<id>`, `#more`. Tab switches replace history; calculator sub-pages push history, so the phone's back gesture returns to the list.

## Files
- `index.html`, `styles.css` (ROBO CALC-inspired "hot" theme, our own CSS), `app.js` (router, stats, live updates, screens)
- `bots.js`: bot registry (id, BrettZone name, snapshot, dated rank, specs, notes). Add Blink here later.
- `archetypes.js` + `data/archetypes.json`: editable opponent→archetype mapping with evidence, source URLs and confidence. Taxonomy = NHRL wiki weapon-type categories. User corrections saved in localStorage (`sn_arch_overrides_v1`).
- `calcs.js`: Calculators list (ROBO CALC, Ember, FingerTech, SDP/SI, Gates) + native Battery Sag / Max Amps
- `profile.js`: shared robot profile (`window.RobotProfile`) for calculators / future robot designer
- `data/snapshot.js`: bundled snapshot of BrettZone `/bots/supernova/fights` + round names (offline fallback)
- `sw.js`, `manifest.webmanifest`, `icons/`, `fonts/` (Chakra Petch, SIL OFL)

## Battery Sag / Max Amps (built-in estimate)
- Inputs: cells in series (S), **total pack capacity (mAh, the number on the label)**, full-charge and nominal cell V, allowed sag %, and internal resistance as one of: **per-cell IR** (mΩ, per cell; pack = (S ÷ P) × R_cell, so P matters only here), **whole-pack IR** (mΩ), or **C-rating only** (pack-level estimate R_pack ≈ S × 0.4 V ÷ (C × Ah_pack), labelled as an estimate).
- Outputs: pack resistance, I_max = (sag% × S × V_full) ÷ R_pack, loaded voltage at total peak/typical component draw with OK / will-sag warning, Wh = S × V_nominal × Ah_pack.
- Saved in the shared robot profile (`sn_robot_profile_v1`, profile version 2). Profiles saved by older versions (per-cell `capacityMah`) are migrated automatically: total = per-cell mAh × P.

## Live data
- `GET /bots/{bot}/fights` on open, on return to the app, by pull-to-refresh or the refresh button, and every 60 s while visible (toggle in More). Never more than one request per 5 s.
- All stats are recomputed from the fight list on every refresh. BrettZone's aggregate endpoints are wrong for Supernova.
- Rank: BrettZone has no rankings API endpoint. `/stats/leaderboard?metric=wins&weightClass=12` is a wins table with different counting (it lists Supernova at 5W-2L), so the rank shown is the dated snapshot in `bots.js`.
- The `X-API-Key` header is blocked by BrettZone's CORS preflight in browsers, so requests are sent without it.

## Credits
Fight data: BrettZone (brettzone.nhrl.io) by NHRL. Archetypes: NHRL wiki, RobotCombatWiki, Combat Robots Wiki.
Calculators belong to their owners (Brian Boxell / Too Hot Robotics; Level 5 Robotics; FingerTech Robotics; SDP/SI; Gates). They are only embedded or linked; none of their code is copied.

## Deploy
Push this folder to a GitHub repo and enable Pages (root), or drag it into Netlify Drop.
