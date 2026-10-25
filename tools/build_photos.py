#!/usr/bin/env python3
"""Build bundled robot photos (img/bots/<id>.webp, ~600px wide) and data/photos.js with credits.
Originals live in /workspace/team-data/raw/photos (BrettZone Hero's Gallery stills, NHRL wiki page images, builder site).
Each photo was checked by eye against its label / caption / page context. Nothing here is guessed."""
import json, os
from PIL import Image, ImageOps
RAW = '/workspace/team-data/raw/photos'; APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HG = 'https://brettzone.nhrl.io/brettZone/v2/heros/'
WF = 'https://wiki.nhrl.io/wiki/index.php?title=File:'
def bz(id, f, still, event, who='robotTag'):
    return dict(id=id, file=f, kind='bz', credit='BrettZone Hero’s Gallery', caption=event + ' hero shot (still #' + str(still) + ')', url=HG + who)
def wk(id, f, page, cap):
    return dict(id=id, file=f, kind='wiki', credit='NHRL wiki', caption=cap, url=WF + page.replace(' ', '_'))
P = [
    bz('supernova', 'bz_supernova_1038.jpg', 1038, 'October 2026 Open', 'supernova'),
    bz('blink', 'bz_blink_455.jpg', 455, 'BrettZone', 'blink'),
    bz('eruption', 'bz_eruption_669.jpg', 669, 'May 2026 Pro Tour', 'eruption'),
    wk('caldera', 'wiki_caldera.png', 'Caldera-November 2025.png', 'Caldera, November 2025'),
    bz('caldera12', 'bz_caldera12_657.jpg', 657, 'May 2026 Pro Tour', 'caldera12'),
    bz('clyde', 'bz_clyde_532.jpg', 532, 'May 2026', 'clyde'),
    wk('pof', 'wiki_pof.png', 'Thepoweroffriendship-removebg.png', 'The Power of Friendship, January 2024 event'),
    wk('juxtaposition', 'wiki_juxtaposition.png', 'Juxtaposition-April25.png', 'Juxtaposition, April 2025'),
    wk('cerealkiller', 'wiki_cerealkiller.png', 'Cerealkiller-Sept24.png', 'Cereal Killer, September 2024'),
    wk('plottwist', 'wiki_plottwist.png', 'Plot Twist January.png', 'Plot Twist, January 2023'),
    dict(id='phantomiv', file='p4_7r7a2863-1.jpeg', kind='builder', credit='Nik Buchholz (builder’s site)', caption='Phantom IV, from the builder’s Phantom IV project page', url='https://nikbuchholz.weebly.com/phantom-iv---3lb-combat-robot.html'),
    wk('phantomiii', 'wiki_phantomiii.png', 'Phantom III.png', 'Phantom III'),
    wk('stoneforge', 'wiki_stoneforge.jpg', 'Stoneforge V5.jpg', 'Stoneforge, updated robot picture (modular configurations)'),
    wk('fullydefined', 'wiki_fullydefined.png', 'Fullydefined 3lb Sept22.png', 'Fully Defined, September 2022 event'),
    wk('fireball', 'wiki_fireball.png', 'Fireball-removebg.png', 'Fireball'),
    bz('luna', 'bz_luna_389.jpg', 389, 'April 2026', 'luna'),
    bz('alan', 'bz_alan_585.jpg', 585, 'April 2026 (“BotHero_ALAN”)', 'alan'),
    bz('barbie', 'bz_barbie_667.jpg', 667, 'May 2026 Pro Tour', 'barbie'),
    wk('thumbwar', 'wiki_thumbwar.png', 'Thumb War .png', 'Thumb War, March 2025'),
]
def crop_bz(im):
    # BrettZone hero stills are 3840x2160 with the robot lit in the middle of a dark set: crop to the bright region.
    g = ImageOps.grayscale(im.resize((im.width // 8, im.height // 8)))
    bb = g.point(lambda v: 255 if v > 70 else 0).getbbox()
    if not bb: return im
    l, t, r, b = [v * 8 for v in bb]; cx, cy = (l + r) / 2, (t + b) / 2
    w = max((r - l) * 1.35, (b - t) * 1.35 * 1.6, 1400); h = w / 1.6
    w, h = min(w, im.width), min(h, im.height)
    x0 = min(max(cx - w / 2, 0), im.width - w); y0 = min(max(cy - h / 2, 0), im.height - h)
    return im.crop((int(x0), int(y0), int(x0 + w), int(y0 + h)))
out = {}; total = 0
for p in P:
    im = Image.open(os.path.join(RAW, p['file'])); im = ImageOps.exif_transpose(im)
    alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    im = im.convert('RGBA' if alpha else 'RGB')
    if p['kind'] == 'bz': im = crop_bz(im)
    if alpha: im = im.crop(im.getbbox() or (0, 0, im.width, im.height))
    im.thumbnail((600, 600))
    dst = f"img/bots/{p['id']}.webp"; im.save(os.path.join(APP, dst), 'WEBP', quality=72, method=6)
    sz = os.path.getsize(os.path.join(APP, dst)); total += sz
    out[p['id']] = dict(src=dst, w=im.width, h=im.height, cut=alpha, credit=p['credit'], caption=p['caption'], url=p['url'])
    print(p['id'], im.size, sz)
print('total', total)
open(os.path.join(APP, 'data/photos.js'), 'w').write('/* Robot photos (bundled, ~600px webp), built by tools/build_photos.py. Credits: BrettZone Hero’s Gallery (brettzone.nhrl.io), NHRL wiki (wiki.nhrl.io), builder sites. */\nwindow.BOT_PHOTOS = ' + json.dumps(out, ensure_ascii=False, indent=0) + ';\n')
