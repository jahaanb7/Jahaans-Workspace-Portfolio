// Renders the opening's static Orion frame with the same code the browser uses (js/orion-core.js).
// Usage: node tools/render-orion-frame.mjs [out.png] [light]
// Writes assets/images/hero-orion.png (the no-JavaScript and reduced-data fallback).
import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prepareMesh, createOrion } from '../js/orion-core.js';
import { HERO_POSE } from '../js/hero-pose.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = JSON.parse(await readFile(path.join(root, 'assets/mesh/orion-parts.json'), 'utf8'));
const parts = prepareMesh(json);
const W = 520, H = 640;
const light = process.argv[3] === 'light';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}


const r = createOrion(parts, W, H);
const out = r.render({ ...HERO_POSE, explode: Number(process.env.EXPLODE ?? 1), mode: process.env.MODE || 'pixels', scan: 1, hover: -1,
  centerX: W / 2, centerY: H / 2, pxPerMm: (H * 0.86) / (884 + 600 * Number(process.env.EXPLODE ?? 1)),
  ink: light ? '#141415' : '#ECECEC', body: light ? '#F7F7F5' : '#17171A', dark: !light });
const file = process.argv[2] || path.join(root, 'assets/images/hero-orion.png');
await writeFile(file, png(W, H, out.rgba));
console.log(`${file}  ${out.drawn}/${out.triangles} triangles  ${out.ms.toFixed(1)} ms`);
