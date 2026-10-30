/* MOV/MP4 audio extractor + M4A/WAV writer (v36). Our own code, no library. Lazy-loaded by freqview.js only when the
   browser can't decode a video's audio itself (e.g. some iPhone .mov files), or when a video is too big to load whole.
   Reads just the 'moov' index and the audio track's bytes with Blob.slice (the video track is never loaded), then:
   - AAC / ALAC / MP3 audio: rewraps the compressed frames, unchanged, into an audio-only MP4 (.m4a) that the browser can
     decode (or decodes AAC with WebCodecs AudioDecoder when available and the rewrap fails);
   - uncompressed PCM (QuickTime sowt / twos / in24 / in32 / fl32 / fl64 / raw / lpcm): converts to float directly.
   Works on the main thread, no SharedArrayBuffer / COOP / COEP needed. Format refs: ISO/IEC 14496-12 (ISO base media
   file format), 14496-14 (MP4, esds) and Apple's QuickTime File Format spec (sound sample description v0/v1/v2). */
(function (root) {
  'use strict';
  var MAX_MOOV = 200 * 1048576;
  function slice(file, off, len) {
    var b = file.slice(off, off + len);
    if (b.arrayBuffer) return b.arrayBuffer().then(function (a) { return new Uint8Array(a); });
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(new Uint8Array(r.result)); }; r.onerror = function () { rej(r.error || new Error('read failed')); }; r.readAsArrayBuffer(b); });
  }
  function u32(b, o) { return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]; }
  function u16(b, o) { return (b[o] << 8) | b[o + 1]; }
  function u64(b, o) { return u32(b, o) * 4294967296 + u32(b, o + 4); }
  function fourcc(b, o) { return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]); }
  function err(code, msg) { var e = new Error(msg); e.code = code; return e; }
  // children of a container box: [{type, start, hdr, end}]
  function kids(b, s, e) {
    var out = [];
    while (s + 8 <= e) {
      var size = u32(b, s), t = fourcc(b, s + 4), h = 8;
      if (size === 1) { size = u64(b, s + 8); h = 16; } else if (size === 0) size = e - s;
      if (size < h || s + size > e) break;
      out.push({ type: t, start: s, hdr: h, end: s + size }); s += size;
    }
    return out;
  }
  function find(b, box, type) { var k = kids(b, box.start + box.hdr, box.end); for (var i = 0; i < k.length; i++) if (k[i].type === type) return k[i]; return null; }
  function path(b, box, types) { for (var i = 0; i < types.length && box; i++) box = find(b, box, types[i]); return box; }
  function fullBody(box) { return box.start + box.hdr + 4; } // skip version/flags
  // search for a box type anywhere under [s, e) (used for esds/alac/enda inside QuickTime 'wave')
  function deep(b, s, e, type, depth) {
    var k = kids(b, s, e);
    for (var i = 0; i < k.length; i++) { if (k[i].type === type) return k[i]; if ((depth || 0) < 3 && /^(wave|mp4a)$/.test(k[i].type)) { var r = deep(b, k[i].start + k[i].hdr + (k[i].type === 'mp4a' ? 28 : 0), k[i].end, type, (depth || 0) + 1); if (r) return r; } }
    return null;
  }
  // locate top-level boxes by reading 16-byte headers only
  function scan(file, onProgress) {
    var off = 0, n = 0, found = {};
    function step() {
      if (off + 8 > file.size || n++ > 100000) return Promise.resolve(found);
      return slice(file, off, 16).then(function (h) {
        var size = u32(h, 0), t = fourcc(h, 4), hdr = 8;
        if (size === 1) { size = u64(h, 8); hdr = 16; } else if (size === 0) size = file.size - off;
        if (n === 1 && !/^(ftyp|moov|mdat|wide|free|skip|pnot|uuid)$/.test(t)) throw err('notmp4', 'not an MP4/MOV file');
        if (size < hdr) throw err('corrupt', 'bad box size');
        if (!found[t]) found[t] = { start: off, size: size, hdr: hdr };
        off += size;
        if (found.moov && (found.mdat || off >= file.size)) return found;
        return step();
      });
    }
    return step();
  }
  function parseTrack(b, trak) {
    var mdia = find(b, trak, 'mdia'); if (!mdia) return null;
    var hdlr = find(b, mdia, 'hdlr'); if (!hdlr || fourcc(b, fullBody(hdlr) + 4) !== 'soun') return null;
    var mdhd = find(b, mdia, 'mdhd'), v = b[mdhd.start + mdhd.hdr], o = fullBody(mdhd) + (v === 1 ? 16 : 8);
    var tr = { timescale: u32(b, o), duration: v === 1 ? u64(b, o + 4) : u32(b, o + 4) };
    var stbl = path(b, mdia, ['minf', 'stbl']); if (!stbl) return null;
    var stsd = find(b, stbl, 'stsd'), es = fullBody(stsd) + 4, entry = { start: es, end: es + u32(b, es) };
    tr.format = fourcc(b, es + 4); var ver = u16(b, es + 16);
    tr.channels = u16(b, es + 24); tr.bits = u16(b, es + 26); tr.rate = u32(b, es + 32) / 65536; tr.ver = ver;
    var child = es + 36;
    if (ver === 1) { tr.spp = u32(b, es + 36); tr.bpp = u32(b, es + 40); tr.bpf = u32(b, es + 44); tr.bps = u32(b, es + 48); child = es + 52; }
    else if (ver === 2) {
      var dv = new DataView(b.buffer, b.byteOffset + es + 40, 8); tr.rate = dv.getFloat64(0); tr.channels = u32(b, es + 48);
      tr.bits = u32(b, es + 56); tr.lpcmFlags = u32(b, es + 60); tr.bpp = u32(b, es + 64); tr.fpp = u32(b, es + 68); child = es + 72;
    }
    tr.childStart = child; tr.entryEnd = entry.end;
    ['esds', 'alac', 'enda'].forEach(function (t) { var x = deep(b, child, entry.end, t); if (x) tr[t] = b.slice(x.start, x.end); });
    if (tr.format === 'alac' && !tr.alac) { var a2 = deep(b, child, entry.end, 'alac'); if (a2) tr.alac = b.slice(a2.start, a2.end); }
    // sample tables
    var stts = find(b, stbl, 'stts'), stsc = find(b, stbl, 'stsc'), stsz = find(b, stbl, 'stsz') || find(b, stbl, 'stz2'), stco = find(b, stbl, 'stco'), co64 = find(b, stbl, 'co64');
    if (!stsc || !stsz || !(stco || co64)) throw err('corrupt', 'audio sample tables missing');
    var i, p;
    tr.stts = []; if (stts) { p = fullBody(stts); var nE = u32(b, p); for (i = 0; i < nE; i++) tr.stts.push([u32(b, p + 4 + i * 8), u32(b, p + 8 + i * 8)]); }
    tr.stsc = []; p = fullBody(stsc); var nC = u32(b, p); for (i = 0; i < nC; i++) tr.stsc.push([u32(b, p + 4 + i * 12), u32(b, p + 8 + i * 12)]);
    p = fullBody(stsz);
    if (stsz.type === 'stz2') { var fs = b[p + 3], cnt2 = u32(b, p + 4); tr.sizes = new Uint32Array(cnt2); for (i = 0; i < cnt2; i++) tr.sizes[i] = fs === 16 ? u16(b, p + 8 + i * 2) : fs === 8 ? b[p + 8 + i] : (b[p + 8 + (i >> 1)] >> (i & 1 ? 0 : 4)) & 15; tr.count = cnt2; }
    else { tr.fixed = u32(b, p); tr.count = u32(b, p + 4); if (!tr.fixed) { tr.sizes = new Uint32Array(tr.count); for (i = 0; i < tr.count; i++) tr.sizes[i] = u32(b, p + 8 + i * 4); } }
    var cb = stco || co64; p = fullBody(cb); var nO = u32(b, p); tr.chunks = new Array(nO);
    for (i = 0; i < nO; i++) tr.chunks[i] = co64 ? u64(b, p + 4 + i * 8) : u32(b, p + 4 + i * 4);
    return tr;
  }
  var PCM = { sowt: 1, twos: 1, in24: 1, in32: 1, fl32: 1, fl64: 1, 'raw ': 1, lpcm: 1, NONE: 1 };
  function pcmLayout(tr) {
    var f = tr.format, le = !!(tr.enda && tr.enda.length >= 10 && (tr.enda[8] << 8 | tr.enda[9]) === 1), L = { ch: tr.channels };
    if (f === 'sowt') { L.bits = tr.bits === 8 ? 8 : 16; L.le = true; L.type = 'int'; }
    else if (f === 'twos' || f === 'NONE') { L.bits = tr.bits === 8 ? 8 : 16; L.le = false; L.type = 'int'; }
    else if (f === 'raw ') { L.bits = 8; L.type = 'uint'; }
    else if (f === 'in24') { L.bits = 24; L.le = le; L.type = 'int'; }
    else if (f === 'in32') { L.bits = 32; L.le = le; L.type = 'int'; }
    else if (f === 'fl32') { L.bits = 32; L.le = le; L.type = 'float'; }
    else if (f === 'fl64') { L.bits = 64; L.le = le; L.type = 'float'; }
    else if (f === 'lpcm') { var fl = tr.lpcmFlags || 0; L.bits = tr.bits; L.le = !(fl & 2); L.type = fl & 1 ? 'float' : fl & 4 ? 'int' : 'uint'; }
    L.frame = L.ch * L.bits / 8;
    if (tr.ver === 1 && tr.bpf) L.frame = tr.bpf; else if (tr.ver === 2 && tr.bpp && tr.fpp === 1) L.frame = tr.bpp;
    return L;
  }
  // [{off, len, n}] list of byte runs to read (one per chunk) + per-sample sizes for compressed audio, capped at maxSec
  function plan(tr, maxSec, pcm, frameBytes) {
    var runs = [], sizes = [], si = 0, total = tr.count, limit = Infinity;
    if (isFinite(maxSec)) {
      if (pcm) limit = Math.ceil(maxSec * tr.rate);
      else { var t = 0, k = 0; for (var e = 0; e < tr.stts.length && t < maxSec * tr.timescale; e++) for (var j = 0; j < tr.stts[e][0] && t < maxSec * tr.timescale; j++) { t += tr.stts[e][1]; k++; } limit = tr.stts.length ? k : Infinity; }
    }
    var truncated = total > limit;
    for (var c = 0; c < tr.chunks.length && si < Math.min(total, limit); c++) {
      var spc = 0; for (var q = tr.stsc.length - 1; q >= 0; q--) if (tr.stsc[q][0] <= c + 1) { spc = tr.stsc[q][1]; break; }
      var n = Math.min(spc, Math.min(total, limit) - si), len = 0;
      if (pcm) len = n * frameBytes;
      else for (var s = 0; s < n; s++) { var sz = tr.sizes ? tr.sizes[si + s] : tr.fixed; sizes.push(sz); len += sz; }
      runs.push({ off: tr.chunks[c], len: len, n: n }); si += n;
    }
    return { runs: runs, sizes: sizes, samples: si, truncated: truncated };
  }
  function readRuns(file, runs, onProgress) {
    var total = runs.reduce(function (a, r) { return a + r.len; }, 0), out = new Uint8Array(total), pos = 0, i = 0;
    // merge adjacent runs into bigger reads (≤ 8 MB) to keep the number of slices low
    var groups = []; runs.forEach(function (r) { var g = groups[groups.length - 1]; if (g && g.off + g.len === r.off && g.len + r.len <= 8388608) g.len += r.len; else groups.push({ off: r.off, len: r.len }); });
    function next() {
      if (i >= groups.length) return Promise.resolve(out);
      var g = groups[i++];
      return slice(file, g.off, g.len).then(function (u) { if (u.length < g.len) throw err('corrupt', 'file ends early'); out.set(u, pos); pos += g.len; if (onProgress) onProgress(pos / (total || 1)); return next(); });
    }
    return next();
  }
  function pcmToMono(u, L, maxFrames) {
    var frames = Math.min(maxFrames, Math.floor(u.length / L.frame)), x = new Float32Array(frames), dv = new DataView(u.buffer, u.byteOffset, u.length), bps = L.bits / 8, ch = L.ch;
    for (var i = 0; i < frames; i++) {
      var s = 0, o = i * L.frame;
      for (var c = 0; c < ch; c++, o += bps) {
        var v;
        if (L.type === 'float') v = L.bits === 64 ? dv.getFloat64(o, L.le) : dv.getFloat32(o, L.le);
        else if (L.bits === 8) v = L.type === 'uint' ? (u[o] - 128) / 128 : dv.getInt8(o) / 128;
        else if (L.bits === 16) v = dv.getInt16(o, L.le) / 32768;
        else if (L.bits === 24) { var b0 = u[o], b1 = u[o + 1], b2 = u[o + 2], w = L.le ? (b2 << 16 | b1 << 8 | b0) : (b0 << 16 | b1 << 8 | b2); if (w & 0x800000) w -= 0x1000000; v = w / 8388608; }
        else v = dv.getInt32(o, L.le) / 2147483648;
        s += v;
      }
      x[i] = s / ch;
    }
    return x;
  }
  // esds -> {oti, asc}
  function parseEsds(esds) {
    if (!esds) return {};
    var b = esds, p = 12, out = {};
    function len() { var l = 0, k = 0, c; do { c = b[p++]; l = (l << 7) | (c & 0x7f); } while (c & 0x80 && ++k < 4); return l; }
    while (p < b.length) {
      var tag = b[p++], l = len(), s = p;
      if (tag === 3) { p += 2; var fl = b[p++]; if (fl & 0x80) p += 2; if (fl & 0x40) p += 1 + b[p]; if (fl & 0x20) p += 2; continue; }
      if (tag === 4) { out.oti = b[p]; p += 13; continue; }
      if (tag === 5) { out.asc = b.slice(s, s + l); break; }
      p = s + l;
    }
    return out;
  }
  var AAC_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  function ascInfo(asc) {
    if (!asc || asc.length < 2) return null;
    var aot = asc[0] >> 3, fi = ((asc[0] & 7) << 1) | (asc[1] >> 7), off = 9;
    if (aot === 31) { aot = 32 + (((asc[0] & 7) << 3) | (asc[1] >> 5)); fi = (asc[1] >> 1) & 15; off = 15; }
    var rate = fi === 15 ? NaN : AAC_RATES[fi], chcfg = 0;
    var bitpos = off + (fi === 15 ? 24 : 0); chcfg = ((((asc[bitpos >> 3] << 8) | (asc[(bitpos >> 3) + 1] || 0)) >> (12 - (bitpos & 7))) & 15);
    return { aot: aot, rate: rate, channels: chcfg };
  }
  /* ---------- writers ---------- */
  function box(type, parts) {
    var len = 8; parts.forEach(function (p) { len += p.length; });
    var o = new Uint8Array(len); o[0] = len >>> 24; o[1] = (len >> 16) & 255; o[2] = (len >> 8) & 255; o[3] = len & 255;
    for (var i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i);
    var p = 8; parts.forEach(function (x) { o.set(x, p); p += x.length; }); return o;
  }
  function be(n, bytes) { var o = new Uint8Array(bytes); for (var i = bytes - 1; i >= 0; i--) { o[i] = n % 256; n = Math.floor(n / 256); } return o; }
  function str(s) { return Uint8Array.from(s.split('').map(function (c) { return c.charCodeAt(0); })); }
  function cat(list) { var n = 0; list.forEach(function (x) { n += x.length; }); var o = new Uint8Array(n), p = 0; list.forEach(function (x) { o.set(x, p); p += x.length; }); return o; }
  var MATRIX = cat([be(0x10000, 4), be(0, 4), be(0, 4), be(0, 4), be(0x10000, 4), be(0, 4), be(0, 4), be(0, 4), be(0x40000000, 4)]);
  // Audio-only MP4 (.m4a): the compressed frames are copied unchanged; sample entry rebuilt as a plain ISO v0 entry.
  function toM4A(a) {
    var dur = 0; a.stts.forEach(function (e) { dur += e[0] * e[1]; });
    var fmt = a.format === 'alac' ? 'alac' : '.mp3' === a.format ? '.mp3' : 'mp4a', extra = a.format === 'alac' ? (a.alac || new Uint8Array(0)) : (a.esds || new Uint8Array(0));
    var rate = Math.round(a.rate) > 65535 ? 0 : Math.round(a.rate);
    var entry = box(fmt, [new Uint8Array(6), be(1, 2), be(0, 8), be(a.channels || 2, 2), be(16, 2), be(0, 4), be(rate * 65536, 4), extra]);
    var stts = [], last = null; a.stts.forEach(function (e) { if (last && last[1] === e[1]) last[0] += e[0]; else stts.push(last = [e[0], e[1]]); });
    var sttsB = box('stts', [be(0, 4), be(stts.length, 4)].concat(stts.map(function (e) { return cat([be(e[0], 4), be(e[1], 4)]); })));
    var sizes = new Uint8Array(a.sizes.length * 4); a.sizes.forEach(function (s, i) { sizes[i * 4] = s >>> 24; sizes[i * 4 + 1] = (s >> 16) & 255; sizes[i * 4 + 2] = (s >> 8) & 255; sizes[i * 4 + 3] = s & 255; });
    function moov(mdatOff) {
      var stbl = box('stbl', [box('stsd', [be(0, 4), be(1, 4), entry]), sttsB, box('stsc', [be(0, 4), be(1, 4), be(1, 4), be(a.sizes.length, 4), be(1, 4)]), box('stsz', [be(0, 4), be(0, 4), be(a.sizes.length, 4), sizes]), box('stco', [be(0, 4), be(1, 4), be(mdatOff, 4)])]);
      var minf = box('minf', [box('smhd', [be(0, 4), be(0, 4)]), box('dinf', [box('dref', [be(0, 4), be(1, 4), box('url ', [be(1, 4)])])]), stbl]);
      var mdia = box('mdia', [box('mdhd', [be(0, 4), be(0, 4), be(0, 4), be(a.timescale, 4), be(dur, 4), be(0x55c4, 2), be(0, 2)]), box('hdlr', [be(0, 4), be(0, 4), str('soun'), be(0, 12), str('SoundHandler'), new Uint8Array(1)]), minf]);
      var tkhd = box('tkhd', [be(7, 4), be(0, 4), be(0, 4), be(1, 4), be(0, 4), be(Math.round(dur / a.timescale * 1000), 4), be(0, 8), be(0, 2), be(0, 2), be(0x0100, 2), be(0, 2), MATRIX, be(0, 4), be(0, 4)]);
      var mvhd = box('mvhd', [be(0, 4), be(0, 4), be(0, 4), be(1000, 4), be(Math.round(dur / a.timescale * 1000), 4), be(0x10000, 4), be(0x0100, 2), be(0, 10), MATRIX, be(0, 24), be(2, 4)]);
      return box('moov', [mvhd, box('trak', [tkhd, mdia])]);
    }
    var ftyp = box('ftyp', [str('M4A '), be(0, 4), str('M4A '), str('isom'), str('mp42')]);
    var mv = moov(0), off = ftyp.length + mv.length + 8; mv = moov(off);
    var mdatLen = 8 + a.data.length, mdatH = cat([be(mdatLen, 4), str('mdat')]);
    return cat([ftyp, mv, mdatH, a.data]);
  }
  function toWav(x, sr) {
    var n = x.length, b = new Uint8Array(44 + n * 2), dv = new DataView(b.buffer);
    [['RIFF', 0], ['WAVE', 8], ['fmt ', 12], ['data', 36]].forEach(function (s) { for (var i = 0; i < 4; i++) b[s[1] + i] = s[0].charCodeAt(i); });
    dv.setUint32(4, 36 + n * 2, true); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); dv.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) { var v = Math.max(-1, Math.min(1, x[i])); dv.setInt16(44 + i * 2, v < 0 ? v * 32768 : v * 32767, true); }
    return b;
  }
  /* ---------- main ---------- */
  // extract(file, {maxSec, onProgress}) -> {kind:'pcm', x, rate, ...} | {kind:'compressed', format, codec, data, sizes, stts, timescale, rate, channels, esds|alac, asc}
  function extract(file, opt) {
    opt = opt || {}; var prog = opt.onProgress || function () {};
    return scan(file).then(function (top) {
      if (!top.moov) throw err('nomoov', 'no index (moov) found: the file may be incomplete or still being written');
      if (top.moov.size > MAX_MOOV) throw err('toobig', 'index too large');
      prog(0, 'index');
      return slice(file, top.moov.start, top.moov.size).then(function (b) {
        var moov = { start: 0, hdr: top.moov.hdr, end: b.length }, tracks = kids(b, moov.hdr, b.length).filter(function (k) { return k.type === 'trak'; }), tr = null, others = 0;
        if (find(b, moov, 'mvex')) throw err('fragmented', 'fragmented MP4 is not supported');
        for (var i = 0; i < tracks.length && !tr; i++) { var t = parseTrack(b, tracks[i]); if (t) tr = t; else others++; }
        if (!tr) throw err('noaudio', 'no audio track');
        tr.isPcm = !!PCM[tr.format];
        if (!tr.isPcm && !/^(mp4a|alac|\.mp3)$/.test(tr.format)) throw err('codec', 'audio codec "' + tr.format.trim() + '" is not supported by the converter');
        var L = tr.isPcm ? pcmLayout(tr) : null;
        if (L && !(L.frame > 0 && L.ch > 0)) throw err('codec', 'unsupported PCM layout');
        var pl = plan(tr, opt.maxSec, tr.isPcm, L && L.frame);
        if (!pl.runs.length) throw err('noaudio', 'the audio track is empty');
        return readRuns(file, pl.runs, function (f) { prog(f, 'audio'); }).then(function (data) {
          var info = { format: tr.format, rate: tr.rate, channels: tr.channels, truncated: pl.truncated, bytes: data.length, tracks: tracks.length, moovBytes: b.length };
          if (tr.isPcm) { info.kind = 'pcm'; info.bits = L.bits; info.pcmType = L.type; info.x = pcmToMono(data, L, Infinity); return info; }
          info.kind = 'compressed'; info.data = data; info.sizes = pl.sizes; info.timescale = tr.timescale; info.esds = tr.esds; info.alac = tr.alac;
          var stts = [], left = pl.samples; tr.stts.forEach(function (e) { if (left <= 0) return; var c = Math.min(e[0], left); stts.push([c, e[1]]); left -= c; }); if (!stts.length) stts = [[pl.samples, 1024]]; info.stts = stts;
          var es = parseEsds(tr.esds); info.oti = es.oti; info.asc = es.asc; info.ascInfo = ascInfo(es.asc);
          if (tr.format === 'mp4a' && es.oti === 0x6b || es.oti === 0x69) info.codec = 'mp3'; else if (tr.format === 'alac') info.codec = 'alac'; else info.codec = 'aac';
          if (info.ascInfo && info.ascInfo.rate) info.rate = info.ascInfo.rate; // AAC: the ASC has the true rate (QuickTime header can differ)
          return info;
        });
      });
    });
  }
  // WebCodecs AAC decode (when the rewrapped .m4a still won't decode). Resolves {x (mono Float32), rate}.
  function decodeWebCodecs(info) {
    if (typeof AudioDecoder === 'undefined' || info.codec !== 'aac' || !info.asc) return Promise.reject(err('nowebcodecs', 'WebCodecs AudioDecoder not available'));
    var aot = info.ascInfo ? info.ascInfo.aot : 2, cfg = { codec: 'mp4a.40.' + aot, sampleRate: info.rate, numberOfChannels: info.channels || (info.ascInfo && info.ascInfo.channels) || 2, description: info.asc };
    var guard = function (pr, ms) { return Promise.race([pr, new Promise(function (_, rej) { setTimeout(function () { rej(err('timeout', 'decoder did not answer')); }, ms); })]); };
    return guard(AudioDecoder.isConfigSupported(cfg), 10000).then(function (s) {
      if (!s.supported) throw err('nowebcodecs', 'AAC not supported by AudioDecoder');
      return guard(new Promise(function (res, rej) {
        var parts = [], len = 0, rate = info.rate;
        var dec = new AudioDecoder({ output: function (ad) {
          var n = ad.numberOfFrames, ch = ad.numberOfChannels, m = new Float32Array(n), tmp = new Float32Array(n); rate = ad.sampleRate;
          for (var c = 0; c < ch; c++) { ad.copyTo(tmp, { planeIndex: c, format: 'f32-planar' }); for (var i = 0; i < n; i++) m[i] += tmp[i] / ch; }
          parts.push(m); len += n; ad.close();
        }, error: function (e) { rej(e); } });
        dec.configure(cfg);
        var p = 0, t = 0; info.sizes.forEach(function (sz) { dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(t * 1e6 / rate), data: info.data.subarray(p, p + sz) })); p += sz; t += 1024; });
        dec.flush().then(function () { var x = new Float32Array(len), o = 0; parts.forEach(function (q) { x.set(q, o); o += q.length; }); dec.close(); if (!len) rej(err('decode', 'no audio decoded')); else res({ x: x, rate: rate }); }, rej);
      }), 60000);
    });
  }
  // Plain PCM WAV (RIFF WAVE, integer 8/16/24/32-bit or float 32/64) -> mono Float32, for browsers that can't decode WAV themselves.
  function wavToMono(u) {
    if (fourcc(u, 0) !== 'RIFF' || fourcc(u, 8) !== 'WAVE') throw err('notwav', 'not a WAV file');
    var dv = new DataView(u.buffer, u.byteOffset, u.length), p = 12, fmt = null;
    while (p + 8 <= u.length) {
      var id = fourcc(u, p), n = dv.getUint32(p + 4, true), b = p + 8;
      if (id === 'fmt ') { var tag = dv.getUint16(b, true); if (tag === 0xfffe && n >= 26) tag = dv.getUint16(b + 24, true); fmt = { tag: tag, ch: dv.getUint16(b + 2, true), rate: dv.getUint32(b + 4, true), align: dv.getUint16(b + 12, true), bits: dv.getUint16(b + 14, true) }; }
      else if (id === 'data' && fmt) {
        if (!(fmt.tag === 1 || fmt.tag === 3) || !fmt.ch) throw err('codec', 'WAV encoding ' + fmt.tag + ' is not plain PCM');
        var len = Math.min(n, u.length - b), L = { ch: fmt.ch, bits: fmt.bits, le: true, type: fmt.tag === 3 ? 'float' : fmt.bits === 8 ? 'uint' : 'int', frame: fmt.align || fmt.ch * fmt.bits / 8 };
        return { x: pcmToMono(u.subarray(b, b + len), L, Infinity), rate: fmt.rate, channels: fmt.ch, bits: fmt.bits, pcmType: L.type };
      }
      p = b + n + (n & 1);
    }
    throw err('corrupt', 'WAV data chunk missing');
  }
  var api = { extract: extract, wavToMono: wavToMono, toM4A: toM4A, toWav: toWav, decodeWebCodecs: decodeWebCodecs, parseEsds: parseEsds, ascInfo: ascInfo, _kids: kids };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MovAudio = api;
})(typeof window !== 'undefined' ? window : this);
