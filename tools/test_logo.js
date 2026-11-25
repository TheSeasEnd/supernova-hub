// node tools/test_logo.js: v38 team logo (transparent badge on the landing page; flame crop in the header / app icons).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..'); const R = f => fs.readFileSync(path.join(root, f), 'utf8');
const E = f => fs.existsSync(path.join(root, f));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const html = R('index.html'), css = R('styles.css'), sw = R('sw.js'), man = JSON.parse(R('manifest.webmanifest'));
ok(E('img/logo/th2h-logo-source.jpg') && E('img/logo/th2h-logo.png') && E('img/logo/th2h-logo.webp'), 'original-colors transparent logo + source kept as assets');
ok(E('img/logo/th2h-logo-on-dark.png') && E('img/logo/th2h-logo-on-dark.webp'), 'on-dark (cream text/outlines) logo');
ok(E('img/logo/th2h-flame-original.png') && E('img/logo/th2h-flame.png') && E('icons/flame.webp') && E('icons/flame.png'), 'flame-only crops');
ok(E('icons/icon-192.png') && E('icons/icon-512.png') && E('icons/icon-maskable-512.png') && E('icons/apple-touch-icon.png'), 'home-screen / favicon PNGs');
ok(!E('icons/flame.svg') && !E('icons/icon.svg') && !/flame\.svg|icon\.svg/.test(html + sw + JSON.stringify(man)), 'old SVG marks retired');
ok(/th2h-logo-on-dark\.webp/.test(html) && /th2h-logo-on-dark\.png/.test(html) && /alt="Too Hot to Handle"/.test(html), 'landing uses the on-dark full logo');
ok(/src="icons\/flame\.webp" alt="" class="logo"/.test(html), 'header / sidebar use the flame crop (ring text would be unreadable at 38px)');
ok(/\.ld-mark\{[^}]*min\(72vw,264px\)/.test(css) && /@media \(min-width: 900px\)\{[\s\S]*?\.ld-mark\{width:320px;height:320px\}/.test(css), 'landing logo size: ~264px phone, 320px desktop');
ok(/\.ld-mark::before\{[^}]*radial-gradient\(circle,rgba\(255,166,33,\.28\)/.test(css), 'soft glow behind the landing logo');
ok(/@media \(prefers-reduced-motion: no-preference\)\{[\s\S]*?html\.landing-on \.ld-mark::before\{animation:ldGlow/.test(css), 'glow pulse only without reduced motion');
ok(!/border-radius:22px;box-shadow:0 0 0 2px var\(--hot\)/.test(css) && !/\.logo\{[^}]*border-radius/.test(css), 'no ring or rounded tile in CSS around the header mark');
ok(/'img\/logo\/th2h-logo-on-dark\.webp'/.test(sw) && /'icons\/flame\.webp'/.test(sw) && /supernova-v(3[8-9]|[4-9]\d)/.test(sw), 'new assets cached, sw v38+');
ok(man.icons.every(i => i.src.startsWith('icons/icon') || i.src.startsWith('icons/apple')) && man.icons.some(i => i.purpose === 'maskable'), 'manifest icons are the PNG app icons (incl. maskable)');
// pixel checks: transparent corners, navy vs cream ink, no cream background left in the source cutout
const py = `
from PIL import Image
import sys, json, warnings; warnings.filterwarnings("ignore")
def load(p):
    im=Image.open(p).convert('RGBA'); a=list(im.getdata()); w,h=im.size
    return im,w,h,a
out={}
# original-colors full logo: corners transparent, some navy pixels, no cream-bg field
im,w,h,a=load(${JSON.stringify(path.join(root,'img/logo/th2h-logo.png'))})
corners=[im.getpixel((0,0)),im.getpixel((w-1,0)),im.getpixel((0,h-1)),im.getpixel((w-1,h-1))]
out['orig_corners_clear']=all(p[3]==0 for p in corners)
navy=sum(1 for p in a if p[3]>200 and p[2]>p[0]+8 and p[0]<50 and p[1]<50)
creamish=sum(1 for p in a if p[3]>200 and p[0]>230 and p[1]>230 and p[2]>210)
out['orig_has_navy']=navy>1000
out['orig_no_cream_fill']=creamish<200  # cream should only appear as residual AA, not as a background
# on-dark: corners clear, cream ink instead of navy, flame fills still orange/pink
im2,w2,h2,a2=load(${JSON.stringify(path.join(root,'img/logo/th2h-logo-on-dark.png'))})
out['dark_corners_clear']=all(im2.getpixel(c)[3]==0 for c in [(0,0),(w2-1,0),(0,h2-1),(w2-1,h2-1)])
navy2=sum(1 for p in a2 if p[3]>200 and p[2]>p[0]+8 and p[0]<50 and p[1]<50)
cream2=sum(1 for p in a2 if p[3]>200 and p[0]>230 and p[1]>230 and p[2]>200)
orange=sum(1 for p in a2 if p[3]>200 and p[0]>200 and 80<p[1]<160 and p[2]<80)
pink=sum(1 for p in a2 if p[3]>200 and p[0]>200 and p[2]>80 and p[1]<140)
out['dark_no_navy']=navy2<200
out['dark_has_cream_ink']=cream2>1000
out['dark_keeps_flame_colors']=orange>500 and pink>500
# flame crop: no ring text (narrower than the full badge), transparent corners
im3,w3,h3,a3=load(${JSON.stringify(path.join(root,'icons/flame.png'))})
out['flame_corners_clear']=all(im3.getpixel(c)[3]==0 for c in [(0,0),(w3-1,0),(0,h3-1),(w3-1,h3-1)])
# header flame should be square 256 and mostly the flame (high fill in the centre, empty corners already checked)
out['flame_256']=im3.size==(256,256)
cx=im3.getpixel((128,150))
out['flame_center_is_fill']=cx[3]>200 and cx[0]>180
# app icon: dark tile, not transparent, flame in the middle
im4=Image.open(${JSON.stringify(path.join(root,'icons/icon-192.png'))}).convert('RGB')
out['icon_dark_tile']=all(v<30 for v in im4.getpixel((0,0))) and im4.size==(192,192)
mid=im4.getpixel((96,105))
out['icon_center_is_flame']=mid[0]>180
print(json.dumps(out))
`;
let pix = {};
try { pix = JSON.parse(execFileSync('python3', ['-c', py], { encoding: 'utf8' })); }
catch (e) { console.log('FAIL pixel script', e.message); pix = {}; }
const pixChecks = {
  orig_corners_clear: 'original logo corners are transparent',
  orig_has_navy: 'original logo keeps navy text/outlines',
  orig_no_cream_fill: 'original logo has no cream background left',
  dark_corners_clear: 'on-dark logo corners are transparent',
  dark_no_navy: 'on-dark logo has no navy ink (would vanish on the dark page)',
  dark_has_cream_ink: 'on-dark logo uses cream text/outlines',
  dark_keeps_flame_colors: 'on-dark logo keeps the original flame fills',
  flame_corners_clear: 'header flame crop is transparent around the flame',
  flame_256: 'header flame is 256×256',
  flame_center_is_fill: 'header flame centre is a flame fill, not empty',
  icon_dark_tile: 'app icon is a dark full-bleed tile',
  icon_center_is_flame: 'app icon shows the flame'
};
for (const [k, m] of Object.entries(pixChecks)) ok(!!pix[k], m + (k in pix ? '' : ' (script had no result)'));
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
