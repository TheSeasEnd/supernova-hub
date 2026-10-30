// node tools/gen_wsa_media.js: synthetic 9 s spin-up WAV for the Weapon Speed Analyzer (2-tooth weapon, 10 -> 140 rev/s,
// impact tone 20 -> 280 Hz + harmonics, 8 kHz ESC-like tone, noise). Then make the video versions with ffmpeg:
//   cd $WSA_MEDIA && ffmpeg -f lavfi -i color=c=0x221111:s=320x240:r=15 -i spinup.wav -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac spinup.mp4
//   (same with -f mov spinup.mov; -c:v libvpx-vp9 -c:a libopus spinup.webm; and -t 3 without the wav for noaudio.mp4)
// Expected with N = 2, D = 8 in: peak 280 Hz -> F = 140 Hz -> 8,400 RPM -> S = 199.9 mph.
const F = require(require('path').join(__dirname, '../freqmath.js')), fs = require('fs'), sr = 48000, dur = 9;
// 2-tooth weapon: rev/s 10 -> 140 (spin-up 0.5-3.5 s), hold to 5.5 s, spin-down to 10 by 8.5 s; impact freq = 2 x rev/s
const rev = t => t < 0.5 ? 10 : t < 3.5 ? 10 + 130 * (t - 0.5) / 3 : t < 5.5 ? 140 : t < 8.5 ? 140 - 130 * (t - 5.5) / 3 : 10;
const x = F.synth(sr, dur, t => 2 * rev(t), { harmonics: [0.45, 0.22, 0.12], tones: [[8000, 0.03]], noise: 0.03, env: t => Math.min(1, t / 0.3) });
const b = Buffer.alloc(44 + x.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
const dir = process.env.WSA_MEDIA || '/tmp/pt/media'; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(dir + '/spinup.wav', b); console.log('wav', b.length);
