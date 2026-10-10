/**
 * Ilova ikonkalarini yasaydi — tashqi kutubxonasiz (sof Node: zlib + PNG kodlash).
 *
 * Belgi: kun tartibi — vertikal chiziqqa ulangan uchta tugun (kun boʻlaklari) va
 * yonida ish chiziqlari. Oʻrtadagi oltin tugun — "hozir". Namozim'ning quyosh yoyi
 * belgisi bilan bir oila (bir xil chiziq qalinligi va ranglar), lekin bir qarashda farqlanadi.
 *
 * Ishga tushirish: npm run icons
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');
mkdirSync(OUT, { recursive: true });

const BG = [0x0a, 0x0a, 0x0a];
const WHITE = [0xfa, 0xfa, 0xfa];
const AMBER = [0xe8, 0xa3, 0x3d];

/* ── Geometriya (birlik kvadratda) ─────────────────────────────────────────── */

function geometry({ stroke = 0.03, dot = 0.036, gap = 0.022 } = {}) {
  const x = 0.29; // tugunlar chizigʻi; ish chiziqlari bilan birga gorizontal markazda
  const rows = [0.27, 0.5, 0.73];
  return {
    stroke, dot, gap, x,
    spine: [rows[0], rows[2]],
    nodes: rows.map((y, i) => ({ p: [x, y], accent: i === 1, scale: i === 1 ? 1.35 : 1 })),
    // [boshi, oxiri, y] — har xil uzunlik: roʻyxat emas, kun tartibi
    bars: [
      [0.42, 0.76, rows[0]],
      [0.42, 0.71, rows[1]],
      [0.42, 0.62, rows[2]],
    ],
  };
}

function sample(g, x, y) {
  // Tugunlar (ustida)
  for (const n of g.nodes) {
    if (Math.hypot(x - n.p[0], y - n.p[1]) <= g.dot * n.scale) return n.accent ? 2 : 1;
  }
  // Tugun atrofida kichik boʻshliq — chiziq tugunga tegmay turadi
  for (const n of g.nodes) {
    if (Math.hypot(x - n.p[0], y - n.p[1]) <= g.dot * n.scale + g.gap) return 0;
  }
  const half = g.stroke / 2;
  // Tugunlarni ulovchi chiziq — yumaloq uchli
  const qy = Math.max(g.spine[0], Math.min(g.spine[1], y));
  if (Math.hypot(x - g.x, y - qy) <= half) return 1;
  // Ish chiziqlari
  for (const [x0, x1, by] of g.bars) {
    const qx = Math.max(x0, Math.min(x1, x));
    if (Math.hypot(x - qx, y - by) <= half) return 1;
  }
  return 0;
}

/* ── Rasterlash ───────────────────────────────────────────────────────────── */

function render(size, { scale = 1, background = null, mono = false, geo = geometry() } = {}) {
  const SS = 4; // har pikselga 4×4 namuna — silliq chetlar
  const px = Buffer.alloc(size * size * 4);
  const off = (1 - scale) / 2;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let w = 0;
      let a = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const u = ((i + (si + 0.5) / SS) / size - off) / scale;
          const v = ((j + (sj + 0.5) / SS) / size - off) / scale;
          const s = sample(geo, u, v);
          if (s === 1 || (s === 2 && mono)) w++;
          else if (s === 2) a++;
        }
      }
      const n = SS * SS;
      const cov = (w + a) / n;
      const fg = w + a > 0 ? [0, 1, 2].map((k) => (w * WHITE[k] + a * AMBER[k]) / (w + a)) : [0, 0, 0];
      const o = (j * size + i) * 4;
      if (background) {
        for (let k = 0; k < 3; k++) px[o + k] = Math.round(fg[k] * cov + background[k] * (1 - cov));
        px[o + 3] = 255;
      } else {
        for (let k = 0; k < 3; k++) px[o + k] = Math.round(fg[k]);
        px[o + 3] = Math.round(cov * 255);
      }
    }
  }
  return encodePng(size, size, px);
}

/* ── PNG ──────────────────────────────────────────────────────────────────── */

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filtr: yoʻq
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit chuqurligi
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ── Fayllar ──────────────────────────────────────────────────────────────── */

const files = {
  // Oddiy ikonka — toʻq fon bilan
  'icon.png': render(1024, { scale: 0.86, background: BG }),
  // Adaptive: fon app.json da (#0A0A0A); belgi xavfsiz zonada (markaziy ~61%)
  'adaptive-foreground.png': render(1024, { scale: 0.62 }),
  'adaptive-monochrome.png': render(1024, { scale: 0.62, mono: true }),
  'splash-icon.png': render(1024, { scale: 1 }),
  // Bildirishnoma ikonkasi — faqat oq, qalinroq chiziqlar (24dp da ham oʻqilsin)
  'notification-icon.png': render(96, { scale: 1.08, mono: true, geo: geometry({ stroke: 0.06, dot: 0.062, gap: 0.03 }) }),
};

for (const [name, buf] of Object.entries(files)) {
  writeFileSync(join(OUT, name), buf);
  console.log(`${name.padEnd(28)} ${(buf.length / 1024).toFixed(1)} KB`);
}
