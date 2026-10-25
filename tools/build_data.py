"""Builds data/complete-fights.js and data/team.js from /workspace/team-data (tournament scan + wiki reconcile).
Run: python3 tools/build_data.py  (after compute_tournament_scan.py and reconcile.py in /workspace/team-data)."""
import json, glob, collections, datetime, os, re
TD = '/workspace/team-data'; APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = {t['tournamentID']: t for t in json.load(open(f'{TD}/raw/brettzone/tournaments_list.json'))['tournaments']}
scanned = datetime.datetime.fromtimestamp(os.path.getmtime(f'{TD}/raw/brettzone/tournaments_list.json')).astimezone()
SCAN_ISO = scanned.isoformat(timespec='seconds'); SCAN_LABEL = scanned.strftime('%b %-d, %Y %-I:%M %p') + ' ET'

# ---------- 1. complete fight lists (Supernova, Blink) ----------
T = collections.defaultdict(list)
for f in glob.glob(f'{TD}/raw/brettzone/tournaments/*.json'):
    for x in json.load(open(f)).get('fights', []):
        for p in ('1', '2'): T[x['player' + p + 'clean']].append(x)
out = {}
for b in ('supernova', 'blink'):
    rows = []
    for x in T[b]:
        if x['player1wins'] + x['player2wins'] == 0: continue                  # unplayed placeholder
        if (x['winAnnotation'] or '') == 'BY' or 'bye' in (x['player1clean'], x['player2clean']): continue
        m = meta.get(x['tournamentID'], {})
        et = int(x['endTime'] // 1000) if x.get('endTime') else 0
        rows.append(dict(tournamentID=x['tournamentID'], gameID=x['id'], name=x['name'], round=x['round'], cage=x.get('cage'),
            player1=x['player1'], player1clean=x['player1clean'], player2=x['player2'], player2clean=x['player2clean'],
            player1wins=x['player1wins'], player2wins=x['player2wins'], winAnnotation=x['winAnnotation'] or '',
            startTime=x['startTime'] or 0, endTime=et, matchLength=x.get('matchLength') or 0,
            tournamentName=x.get('tournamentName') or m.get('tournamentName'), WeightClass=x.get('weightClass') or m.get('WeightClass'),
            isFreestyle=m.get('isFreestyle', 0), privacy=m.get('privacy')))
    rows.sort(key=lambda r: (r['startTime'] or r['endTime'], r['name'] or ''))
    out[b] = rows
cf = dict(scannedAt=SCAN_ISO, label=f'Complete BrettZone snapshot, scanned {SCAN_LABEL}',
          method='Every BrettZone tournament fight list (/tournaments/{id}/fights) scanned for this bot; decided fights only (byes and unplayed 0-0 placeholders dropped).',
          bots=out)
open(f'{APP}/data/complete-fights.js', 'w').write('/* Complete fight lists from BrettZone (brettzone.nhrl.io, by NHRL), built from every tournament fight list.\n   /bots/{bot}/fights misses some decided fights (forfeits, fights with no start time, unlisted events), so the app merges this snapshot with live data. */\nwindow.COMPLETE_FIGHTS = ' + json.dumps(cf, separators=(',', ':'), ensure_ascii=False) + ';\n')
for b, r in out.items():
    w = sum(1 for x in r if (x['player1wins'] > x['player2wins']) == (x['player1clean'] == b)); print(b, len(r), f'{w}-{len(r)-w}')

# ---------- 2. team dashboard data ----------
C = json.load(open(f'{TD}/combined_fights.json'))['bots']; R = json.load(open(f'{TD}/team_roster.json'))
roster = {r['bot']: r for r in R['roster']}
WIKI = 'https://wiki.nhrl.io/wiki/index.php?title='
def bz(c): return 'https://brettzone.nhrl.io/brettZone/v2/b/' + c
events = []; evi = {}
def ev(n):
    if not n: return -1
    if n not in evi: evi[n] = len(events); events.append(n)
    return evi[n]
RAW = {}
for f in glob.glob(f'{TD}/raw/brettzone/tournaments/*.json'):
    for x in json.load(open(f)).get('fights', []):
        # BrettZone sometimes lists the same match twice (two gameIDs, one without times); prefer the timed, decided copy,
        # which is the one /bots/{name}/fights returns, so live merges dedupe on the same key.
        for pl in (x['player1'], x['player2']):
            k = (x['tournamentID'], x['name'], pl); o = RAW.get(k)
            score = lambda y: (int(y.get('startTime') or 0) > 0, (y.get('player1wins') or 0) + (y.get('player2wins') or 0) > 0)
            if o is None or score(x) > score(o): RAW[k] = x
def raw_for(r):
    return RAW.get((r.get('bz_tournamentID'), r.get('bz_match'), r['opponent']))
def trim(title):
    v = C[title]; fs = []
    for r in v['fights']:
        if r['source'] == 'wiki' and not r.get('countedInCombined', True): continue
        src = {'brettzone': 'b', 'wiki': 'w', 'both': 'x'}[r['source']]
        flags = []
        for fl in r.get('flags', []):
            if fl.startswith('result conflict'): flags.append('conflict: ' + fl.split(': ', 1)[1])
            elif fl.startswith('PROBABLE'): flags.append('probable match (wiki opponent blank or different: ' + (r.get('wiki') or {}).get('opponent', '') + ')')
            elif fl.startswith('method differs'): flags.append('wiki: ' + (r.get('wiki') or {}).get('method', ''))
        rd = (r.get('wiki') or {}).get('round') or ''
        st = r.get('stage') or ''
        x = raw_for(r) if src != 'w' else None
        if src != 'w' and not x: print('WARN no raw for', title, r['date'], r['opponent'], r.get('bz_match'))
        t = (x['startTime'] or (x['endTime'] // 1000 if x.get('endTime') else 0)) if x else 0
        ln = (x.get('matchLength') or 0) if (x and x.get('startTime')) else 0
        if not ln:
            try: ln = int((r.get('wiki') or {}).get('fightLengthS') or 0)
            except ValueError: ln = 0
        if ln > 1200 or r['method'] in ('FF', 'DQ'): ln = 0
        vid = (r.get('wiki') or {}).get('video') or ''
        fs.append([r['date'], r['opponent'], r['result'], r['method'] or '', src, ev(r.get('event')), rd if src == 'w' else (st[:1] if st else ''), ' · '.join(flags),
                   x['tournamentID'] if x else '', x['id'] if x else '', x['name'] if x else '', x['round'] if x else -9, t, ln, vid])
    return v, fs
def card(id, title, extra):
    v, fs = trim(title); ro = roster.get(extra.get('roster', title), {})
    last = fs[-1] if fs else None
    lastEvent = next((events[f[5]] for f in reversed(fs) if f[5] >= 0), None)
    c = dict(id=id, name=extra.get('name', title), cls=extra['cls'], builder=extra.get('builder', ro.get('builderDriver')), weapon=extra.get('weapon', ro.get('weapon')),
        status=extra.get('status'), channel=extra.get('channel', ro.get('discordChannel')), note=extra.get('note'),
        rec=[v['recordCombined']['W'], v['recordCombined']['L']], recNoFF=[v['recordCombinedExclForfeits']['W'], v['recordCombinedExclForfeits']['L']],
        recBZ=[v['recordBrettzoneScan']['W'], v['recordBrettzoneScan']['L']], streak=v['currentStreakCombined'],
        lastDate=last[0] if last else None, lastEvent=lastEvent if (last and last[5] >= 0) else (lastEvent and ('last BrettZone event: ' + lastEvent)),
        firstDate=fs[0][0] if fs else None, counts=dict(v['counts']), wikiDupesDropped=v.get('wikiOnlyExcluded', 0),
        sources=extra.get('sources', []), appBot=extra.get('appBot'), bz=v.get('brettzoneCleanName'), wiki=extra.get('wikiTitle', title), fights=fs)
    return c
BOTS = [
 ('supernova','Supernova',dict(cls=12,appBot='supernova',channel='blink-supernova',sources=[['BrettZone',bz('supernova')],['NHRL wiki',WIKI+'Supernova']])),
 ('blink','Blink',dict(cls=3,appBot='blink',channel='blink-supernova',sources=[['BrettZone',bz('blink')],['NHRL wiki',WIKI+'Blink']])),
 ('eruption','Eruption',dict(cls=3,channel='eruption-rupture',sources=[['BrettZone',bz('eruption')],['NHRL wiki',WIKI+'Eruption'],['NHRL Teams 2024 page','https://www.nhrl.io/meet-the-teams']])),
 ('caldera','Caldera',dict(cls=3,channel='caldera',sources=[['BrettZone',bz('caldera')],['NHRL wiki',WIKI+'Caldera']])),
 ('caldera12','Caldera 12',dict(cls=12,channel='caldera',note='Listed as “Caldera” (12lb) on the NHRL Teams 2024 page.',sources=[['BrettZone',bz('caldera12')],['NHRL wiki',WIKI+'Caldera_12'],['NHRL Teams 2024 page','https://www.nhrl.io/meet-the-teams']])),
 ('clyde','Clyde',dict(cls=3,channel='Alex and Gabe (#alex-and-gabe-clyde)',sources=[['BrettZone',bz('clyde')],['NHRL wiki',WIKI+'Clyde']])),
 ('pof','The Power of Friendship!',dict(cls=3,weapon='Twin drills (multibot)',channel='juxtaposition-pof-cereal',note='One extra freestyle exhibition (Mar 2024) is listed under “Power of Friendship” on BrettZone and isn’t included.',sources=[['BrettZone',bz('thepoweroffriendship')],['NHRL wiki',WIKI+'The_Power_of_Friendship!']])),
 ('juxtaposition','Juxtaposition',dict(cls=3,builder='Not documented',channel='juxtaposition-pof-cereal',sources=[['BrettZone',bz('juxtaposition')],['NHRL wiki',WIKI+'Juxtaposition']])),
 ('cerealkiller','Cereal Killer',dict(cls=3,channel='juxtaposition-pof-cereal',sources=[['BrettZone',bz('cerealkiller')],['NHRL wiki',WIKI+'Cereal_Killer']])),
 ('plottwist','Plot Twist',dict(cls=3,channel='plot-twist-luna',sources=[['BrettZone',bz('plottwist')],['NHRL wiki',WIKI+'Plot_Twist']])),
 ('phantomiv','Phantom IV',dict(cls=3,roster='Phantom IV',wikiTitle=None,builder='Unknown',weapon='Unknown',channel='phantom-thumb-war',note='The newest Phantom. No wiki page yet, so builder and weapon are unknown.',sources=[['BrettZone',bz('phantomiv')]])),
 ('stoneforge','Stoneforge',dict(cls=3,builder='James Nguyen',weapon='Modular (drum / eggbeater)',sources=[['BrettZone',bz('stoneforge')],['NHRL wiki',WIKI+'Stoneforge']])),
 ('fullydefined','Fully Defined',dict(cls=3,builder='Ian MacInerney',weapon='Vertical spinner (hub motor)',sources=[['BrettZone',bz('fullydefined')],['NHRL wiki',WIKI+'Fully_Defined']])),
 ('fireball','Fireball',dict(cls=3,note='No fights since Dec 2023 (likely retired).',sources=[['BrettZone',bz('fireball')],['NHRL wiki',WIKI+'Fireball']])),
 ('luna','Luna',dict(cls=12,builder='Not documented',weapon='Not documented',channel='plot-twist-luna',sources=[['BrettZone',bz('luna')],['NHRL wiki',WIKI+'Luna']])),
 ('alan','Alan',dict(cls=30,channel='alan-rapier',sources=[['BrettZone',bz('alan')],['NHRL wiki',WIKI+'Alan']])),
 ('barbie','Barbie',dict(cls=30,builder='Not documented',weapon='Vertical eggbeater spinner',sources=[['BrettZone',bz('barbie')],['NHRL wiki',WIKI+'Barbie']])),
 ('barbieandken','Barbie and Ken',dict(cls=30,builder='Drivers: Brian Boxell and James Nguyen',weapon='Not documented',sources=[['BrettZone',bz('barbieandken')],['NHRL wiki',WIKI+'Barbie_and_Ken'],['NHRL Teams 2024 page','https://www.nhrl.io/meet-the-teams']])),
 ('thumbwar','Thumb War',dict(cls=30,channel='phantom-thumb-war',sources=[['BrettZone',bz('thumbwar')],['NHRL wiki',WIKI+'Thumb_War']])),
]
cards = [card(*b) for b in BOTS]
# Phantom III as history inside Phantom IV
p3 = card('phantomiii', 'Phantom III', dict(cls=3, builder='Nick Buchholz (driver, wiki)', weapon='Overhead bar', sources=[['NHRL wiki', WIKI+'Phantom_III']]))
for c in cards:
    if c['id'] == 'phantomiv': c['history'] = p3
planned = [dict(id=n.lower().replace(' ', ''), name=n, channel=ch, planned=True) for n, ch in
           [('Rupture', 'eruption-rupture'), ('Rapier', 'alan-rapier'), ('Scope Creep', 'scope-creep'), ('Sux2Suck', 'sux2suck')]]
OT = json.load(open(f'{TD}/opponent_types.json'))
open(f'{APP}/data/opptypes.js', 'w').write('/* Opponent robot types from NHRL wiki weapon-type categories (wiki.nhrl.io), auto-built ' + OT['builtAt'] + ' by tools/build_data.py.\n   clean name -> [archetype id, confidence (high = one weapon category, medium = several), wiki page, categories]. */\nwindow.OPP_TYPES = ' + json.dumps(OT['map'], separators=(',', ':'), ensure_ascii=False) + ';\n')
team = dict(name='Too Hot to Handle', alt='Too Hot Robotics', asOf=SCAN_LABEL, events=events, bots=cards, planned=planned,
    conflicts=[['Fireball', '2023-06-24', 'Apex', 'BrettZone has a JD win; the wiki says a loss. Using BrettZone’s win (it fits the bracket: Fireball went on to round 3).'],
               ['Fully Defined', '2023-05', 'Synthesis', 'BrettZone has a TO win; the wiki says a forfeit loss (third-place match). Using BrettZone’s win. Unresolved.']],
    method='BrettZone = every tournament fight list (scanned ' + SCAN_LABEL + '). Wiki = each bot page’s Full Fight History table, used only for fights BrettZone doesn’t have from before 2024. A fight found in both is counted once and uses BrettZone’s result.')
open(f'{APP}/data/team.js', 'w').write('/* Too Hot to Handle team snapshot: BrettZone (by NHRL) fight lists + NHRL wiki fight histories, reconciled. Built by tools/build_data.py. */\nwindow.TEAM_DATA = ' + json.dumps(team, separators=(',', ':'), ensure_ascii=False) + ';\n')
print('team.js', os.path.getsize(f'{APP}/data/team.js'), 'complete', os.path.getsize(f'{APP}/data/complete-fights.js'))
for c in cards: print(c['name'], c['rec'], c['recNoFF'], c['streak'], c['lastDate'], c['lastEvent'], len(c['fights']))
