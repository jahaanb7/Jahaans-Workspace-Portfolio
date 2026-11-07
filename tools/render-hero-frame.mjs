// Renders the static hero frames with the same code the browser uses.
// Usage: node tools/render-hero-frame.mjs
// Writes assets/images/hero-frame-{shaded,wireframe,vertices}.png
import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRasterizer } from '../js/raster-core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mesh = JSON.parse(await readFile(path.join(root, 'assets/mesh/hero-mesh.json'), 'utf8'));

const SIZE = 320;
const POSE = { yaw: -0.55, pitch: 0.18 }; // must match DEFAULT_POSE in js/raster-study.js

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

for (const mode of ['shaded', 'wireframe', 'vertices']) {
  const r = createRasterizer(SIZE, SIZE);
  const stats = r.render(mesh, { ...POSE, mode });
  const out = path.join(root, `assets/images/hero-frame-${mode}.png`);
  await writeFile(out, png(SIZE, SIZE, r.color));
  console.log(`${path.relative(root, out)}  drawn=${stats.drawn} culled=${stats.culled}`);
}
