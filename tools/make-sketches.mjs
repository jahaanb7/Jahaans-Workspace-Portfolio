// make-sketches.mjs: pencil sketches for the scratchbook, drawn with Rough.js at build time.
//
//   node tools/make-sketches.mjs          writes assets/sketches/*.svg
//
// Every sketch uses a fixed seed, so the output is identical on every run and the
// hand-drawn wobble does not change between builds. Strokes use currentColor and the
// classes .sk (graphite), .sk-blue and .sk-red so the page CSS sets the colours.
//
// Nothing here is invented data:
//   suzanne-sketch   edges of the real hero mesh (assets/mesh/hero-mesh.json)
//   projection       a real perspective divide: three points at depth z land at (x/z, y/z)
//   orbital-radial   hydrogen radial probability P(r) = r²|R(r)|² for 1s, 2s and 2p, in Bohr radii
//   verlet           the order of operations in the particle simulation's VerletIntegration()
//   arrows, frames   plain marks with no data
//
// Rough.js 4.6.6 (MIT, Preet Shihn) is vendored in tools/vendor/ and only runs here, in Node.

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const rough = require('./vendor/rough-4.6.6.cjs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/sketches');
mkdirSync(OUT, { recursive: true });

const r1 = (d) => d.replace(/-?\d+\.\d+/g, (n) => (+n).toFixed(1));

function sketch(seed, defaults = {}) {
  const g = rough.generator({ options: { seed, roughness: 1, bowing: 1, stroke: 'currentColor', ...defaults } });
  const out = [];
  const add = (drawable, cls = 'sk') => {
    for (const p of g.toPaths(drawable)) {
      const fill = p.fill && p.fill !== 'none' ? ` fill="${p.fill}"` : ' fill="none"';
      out.push(`<path class="${cls}" d="${r1(p.d)}"${fill}/>`);
    }
  };
  return { g, out, add };
}

function svg(name, w, h, title, desc, body) {
  const id = name.replace(/[^a-z0-9]/g, '');
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" class="sketch sketch-${name}" role="img" aria-labelledby="${id}-t ${id}-d">\n<title id="${id}-t">${title}</title>\n<desc id="${id}-d">${desc}</desc>\n${body.join('\n')}\n</svg>\n`;
  writeFileSync(path.join(OUT, `${name}.svg`), s);
  console.log(`${name}.svg`.padEnd(24), (s.length / 1024).toFixed(1), 'KB');
}

const label = (x, y, t, cls = 'sk-label', anchor = 'start') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${t}</text>`;

/* 1. Suzanne, sketched from the real mesh ------------------------------------------- */
{
  const mesh = JSON.parse(readFileSync(path.join(ROOT, 'assets/mesh/hero-mesh.json'), 'utf8'));
  const yaw = -0.5, pitch = -0.12;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const V = mesh.vertices.map(([x, y, z]) => {
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    return [x1, y2, z2];
  });
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
  const N = mesh.faces.map(([a, b, c]) => norm(cross(sub(V[b], V[a]), sub(V[c], V[a]))));
  const edges = new Map();
  mesh.faces.forEach((f, i) => f.forEach((a, k) => {
    const b = f[(k + 1) % 3];
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    (edges.get(key) || edges.set(key, []).get(key)).push(i);
  }));
  const front = (n) => n[2] > 0; // viewer on +z
  const S = 190, OX = 210, OY = 200;
  const P = (v) => [OX + v[0] * S, OY - v[1] * S];
  const { g, out, add } = sketch(11, { roughness: 0.9, bowing: 0.4, strokeWidth: 0.9 });
  const lines = [];
  for (const [key, fs] of edges) {
    const [a, b] = key.split(',').map(Number);
    let kind = null;
    if (fs.length === 1) kind = front(N[fs[0]]) ? 'outline' : null;
    else {
      const [n1, n2] = [N[fs[0]], N[fs[1]]];
      if (front(n1) !== front(n2)) kind = 'outline';
      else if (front(n1) && n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2] < Math.cos((38 * Math.PI) / 180)) kind = 'crease';
    }
    if (kind) lines.push([P(V[a]), P(V[b]), kind, V[a][2], V[b][2]]);
  }
  // depth buffer of the front-facing faces, so edges behind the head are not drawn
  const G = 2, W0 = 420, H0 = 400, zb = new Float32Array((W0 / G) * (H0 / G)).fill(-Infinity);
  mesh.faces.forEach((f, i) => {
    const [a, b, c] = f.map((k) => [...P(V[k]), V[k][2]]);
    const minx = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]) / G)), maxx = Math.min(W0 / G - 1, Math.ceil(Math.max(a[0], b[0], c[0]) / G));
    const miny = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]) / G)), maxy = Math.min(H0 / G - 1, Math.ceil(Math.max(a[1], b[1], c[1]) / G));
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-9) return;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const px = (x + 0.5) * G, py = (y + 0.5) * G;
      const w0 = ((c[0] - b[0]) * (py - b[1]) - (c[1] - b[1]) * (px - b[0])) / area;
      const w1 = ((a[0] - c[0]) * (py - c[1]) - (a[1] - c[1]) * (px - c[0])) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
      const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
      const k = y * (W0 / G) + x;
      if (z > zb[k]) zb[k] = z;
    }
  });
  const visible = (p, q, zp, zq) => {
    let ok = 0;
    for (let i = 1; i < 6; i++) {
      const t = i / 6, x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t, z = zp + (zq - zp) * t;
      const best = zb[Math.floor(y / G) * (W0 / G) + Math.floor(x / G)] ?? -Infinity;
      if (z >= best - 0.06) ok++;
    }
    return ok >= 3;
  };
  for (const [p, q, kind, zp, zq] of lines) if (visible(p, q, zp, zq)) add(g.line(p[0], p[1], q[0], q[1], kind === 'crease' ? { strokeWidth: 0.6, roughness: 0.6 } : {}), kind === 'crease' ? 'sk sk-light' : 'sk');
  svg('suzanne-sketch', 420, 400, 'Pencil sketch of the Suzanne test mesh',
    `Silhouette and crease edges of the same 507-vertex mesh the renderer uses, drawn with a hand-drawn line. Generated from assets/mesh/hero-mesh.json.`, out);
}

/* 2. Perspective projection --------------------------------------------------------- */
{
  const { g, out, add } = sketch(23);
  const scr = ([x, y, z]) => [40 + z * 150 + x * 38, 190 - y * 78 + x * 28];
  const eye = scr([0, 0, 0]);
  const plane = [[-0.85, 0.85, 1], [0.85, 0.85, 1], [0.85, -0.85, 1], [-0.85, -0.85, 1]].map(scr);
  const tri = [[-0.6, 1.25, 2.5], [1.1, 0.5, 2.5], [0.15, -1.1, 2.5]];
  const triS = tri.map(scr);
  const proj = tri.map(([x, y, z]) => scr([x / z, y / z, 1]));
  add(g.polygon(plane, { strokeWidth: 1.1 }));
  add(g.polygon(triS, { strokeWidth: 1.4 }));
  for (const t of triS) add(g.line(eye[0], eye[1], t[0], t[1], { strokeWidth: 0.7, strokeLineDash: [5, 5], roughness: 0.5 }), 'sk sk-light sk-dash');
  add(g.polygon(proj, { strokeWidth: 1.4 }), 'sk sk-blue');
  for (const p of proj) add(g.circle(p[0], p[1], 5, { strokeWidth: 1, fill: 'currentColor', fillStyle: 'solid' }), 'sk sk-blue');
  add(g.circle(eye[0], eye[1], 9, { fill: 'currentColor', fillStyle: 'solid' }));
  // z axis
  add(g.line(eye[0], eye[1], scr([0, 0, 3.15])[0], scr([0, 0, 3.15])[1], { strokeWidth: 0.6, roughness: 0.4 }), 'sk sk-light');
  const zEnd = scr([0, 0, 3.15]);
  add(g.linearPath([[zEnd[0] - 9, zEnd[1] - 5], zEnd, [zEnd[0] - 9, zEnd[1] + 5]], { strokeWidth: 0.8 }), 'sk sk-light');
  out.push(label(eye[0] - 8, eye[1] + 26, 'eye'));
  out.push(label(plane[3][0] - 6, plane[3][1] + 26, 'near plane, z = 1'));
  out.push(label(triS[2][0] + 14, triS[2][1] + 20, 'triangle at z = 2.5'));
  out.push(label(zEnd[0] + 8, zEnd[1] + 18, 'z'));
  out.push(label(plane[0][0] - 4, plane[0][1] - 34, 'x′ = x / z', 'sk-label sk-blue-t'));
  out.push(label(plane[0][0] - 4, plane[0][1] - 12, 'y′ = y / z', 'sk-label sk-blue-t'));
  svg('projection', 640, 340, 'Sketch of the perspective divide',
    'An eye at the origin, a near plane at z = 1 and a triangle at z = 2.5. Dashed rays from the eye pass through the plane; the blue triangle on the plane is the original divided by its depth.', out);
}

/* 3. Hydrogen radial probability ---------------------------------------------------- */
{
  const { g, out, add } = sketch(31, { roughness: 0.7 });
  const W = 500, H = 270, X0 = 50, Y0 = 220, XS = 30, YS = 330; // r 0..14 a0, P up to ~0.55
  const fns = {
    '1s': (r) => 4 * r * r * Math.exp(-2 * r),
    '2s': (r) => (r * r * (2 - r) ** 2 * Math.exp(-r)) / 8,
    '2p': (r) => (r ** 4 * Math.exp(-r)) / 24,
  };
  add(g.line(X0, Y0, X0 + 14.4 * XS, Y0, { strokeWidth: 1 }));
  add(g.line(X0, Y0, X0, Y0 - 0.62 * YS, { strokeWidth: 1 }));
  for (const r of [0, 2, 4, 6, 8, 10, 12, 14]) {
    add(g.line(X0 + r * XS, Y0, X0 + r * XS, Y0 + 6, { strokeWidth: 0.8, roughness: 0.3 }), 'sk sk-light');
    out.push(label(X0 + r * XS, Y0 + 22, String(r), 'sk-num', 'middle'));
  }
  const cls = { '1s': 'sk', '2s': 'sk sk-blue', '2p': 'sk sk-red' };
  const at = { '1s': 1.2, '2s': 6.4, '2p': 3.2 };
  for (const [k, f] of Object.entries(fns)) {
    const pts = [];
    for (let r = 0; r <= 14.001; r += 0.2) pts.push([X0 + r * XS, Y0 - f(r) * YS]);
    add(g.curve(pts, { strokeWidth: 1.6, roughness: 0.5 }), cls[k]);
    const r = at[k];
    out.push(label(X0 + r * XS + (k === '2p' ? -34 : 10), Y0 - f(r) * YS - 8, k, `sk-label ${k === '2s' ? 'sk-blue-t' : k === '2p' ? 'sk-red-t' : ''}`));
  }
  out.push(label(X0 + 14.4 * XS, Y0 - 10, 'r / a₀', 'sk-label', 'end'));
  out.push(label(X0 + 200, Y0 - 0.62 * YS + 20, 'P(r) = r²|R(r)|²'));
  svg('orbital-radial', W, H, 'Radial probability of the hydrogen 1s, 2s and 2p states',
    'Hand-drawn plot of P(r) = r squared times the radial wavefunction squared, against r in Bohr radii from 0 to 14. 1s peaks at r = 1, 2p at r = 4, and 2s has a node at r = 2 and its main peak near r = 5.2.', out);
}

/* 4. Velocity Verlet order of operations ------------------------------------------- */
{
  const { g, out, add } = sketch(47);
  const t0 = 110, t1 = 470, y = 150;
  add(g.line(50, y, 560, y, { strokeWidth: 1 }));
  for (const t of [t0, t1]) add(g.line(t, y - 8, t, y + 8, { strokeWidth: 1.2 }));
  out.push(label(t0, y + 30, 't', 'sk-label', 'middle'));
  out.push(label(t1, y + 30, 't + Δt', 'sk-label', 'middle'));
  // the particle's path
  const arc = [[t0, 110], [200, 82], [290, 72], [390, 78], [t1, 98]];
  add(g.curve(arc, { strokeWidth: 1.1, strokeLineDash: [4, 4], roughness: 0.4 }), 'sk sk-light sk-dash');
  add(g.circle(t0, 110, 12, { fill: 'currentColor', fillStyle: 'solid' }));
  add(g.circle(t1, 98, 12, { fill: 'currentColor', fillStyle: 'solid' }), 'sk sk-blue');
  // steps
  const step = (n, x, yy, text, cls) => {
    add(g.circle(x, yy, 22, { strokeWidth: 1 }), cls);
    out.push(label(x, yy + 5, String(n), 'sk-num', 'middle'));
    out.push(label(x + 18, yy + 5, text, `sk-label ${cls.includes('blue') ? 'sk-blue-t' : cls.includes('red') ? 'sk-red-t' : ''}`));
  };
  step(1, 40, 34, 'x += vΔt + ½aΔt²', 'sk');
  step(2, 350, 34, 'a ← gravity(x)', 'sk sk-blue');
  step(3, 150, 214, 'v += ½(a_old + a_new)Δt', 'sk sk-red');
  add(g.curve([[120, 52], [130, 80], [118, 100]], { strokeWidth: 0.9 }), 'sk sk-light');
  add(g.curve([[420, 52], [450, 70], [462, 86]], { strokeWidth: 0.9 }), 'sk sk-light');
  svg('verlet', 600, 240, 'Order of operations in one velocity Verlet step',
    'A timeline from t to t plus delta t. Step 1 moves the position with the old velocity and acceleration, step 2 recomputes the acceleration at the new position, step 3 updates the velocity with the average of the old and new accelerations.', out);
}

/* 5. Arrows and frames (plain marks) ------------------------------------------------ */
{
  const arrows = {
    'arrow-curve': [[[10, 60], [40, 20], [90, 14], [130, 34]], [[118, 18], [130, 34], [112, 42]]],
    'arrow-down': [[[30, 8], [22, 40], [34, 78], [28, 104]], [[16, 90], [28, 104], [40, 88]]],
    'arrow-loop': [[[8, 70], [40, 30], [70, 50], [50, 76], [34, 52], [80, 18], [138, 30]], [[124, 16], [138, 30], [122, 40]]],
  };
  Object.entries(arrows).forEach(([name, [body, head]], i) => {
    const { g, out, add } = sketch(60 + i, { strokeWidth: 1.6, roughness: 1.2 });
    add(g.curve(body));
    add(g.linearPath(head));
    const xs = [...body, ...head].map((p) => p[0]), ys = [...body, ...head].map((p) => p[1]);
    svg(name, Math.max(...xs) + 10, Math.max(...ys) + 10, 'Hand-drawn arrow', 'Decorative.', out.map((p) => p.replace('<path', '<path vector-effect="non-scaling-stroke"')));
  });
  for (let i = 0; i < 3; i++) {
    const { g, out, add } = sketch(80 + i, { strokeWidth: 1.2, roughness: 1.4, bowing: 2 });
    add(g.rectangle(4, 4, 392, 292));
    const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">${out.join('').replaceAll('<path', '<path vector-effect="non-scaling-stroke" stroke="#1B1E21" stroke-opacity=".55"').replace(/stroke="currentColor"/g, '')}</svg>`;
    writeFileSync(path.join(OUT, `frame-${i + 1}.svg`), s);
    console.log(`frame-${i + 1}.svg`.padEnd(24), (s.length / 1024).toFixed(1), 'KB');
  }
}

/* 6. Buffy permission flow (from src/core/permissions.ts DEFAULT_RULES) -------------- */
{
  const { g, out, add } = sketch(97, { roughness: 1.1 });
  const scopes = [['read', 'allow'], ['local_write', 'allow'], ['destructive', 'ask'], ['external', 'ask'], ['system', 'ask']];
  const allow = [400, 40], ask = [400, 160];
  add(g.rectangle(allow[0], allow[1] - 22, 120, 44, { strokeWidth: 1.3 }), 'sk sk-blue');
  add(g.rectangle(ask[0], ask[1] - 22, 120, 44, { strokeWidth: 1.3 }), 'sk sk-red');
  out.push(label(allow[0] + 60, allow[1] + 7, 'runs', 'sk-label sk-blue-t', 'middle'));
  out.push(label(ask[0] + 60, ask[1] + 7, 'asks first', 'sk-label sk-red-t', 'middle'));
  scopes.forEach(([s, d], i) => {
    const y = 26 + i * 44;
    out.push(label(30, y + 5, s, 'sk-num'));
    const to = d === 'allow' ? allow : ask;
    add(g.curve([[128, y], [250, (y + to[1]) / 2 + (i % 2 ? 6 : -6)], [to[0] - 6, to[1]]], { strokeWidth: 0.9, roughness: 0.6 }), d === 'allow' ? 'sk sk-blue' : 'sk sk-red');
  });
  // the locked rule
  add(g.ellipse(70, 26 + 3 * 44, 120, 30, { strokeWidth: 1, roughness: 1.4 }), 'sk sk-red');
  out.push(label(30, 26 + 5 * 44 + 4, 'external can never be set to allow', 'sk-label sk-red-t'));
  svg('buffy-scopes', 540, 260, 'Sketch of Buffy\'s permission rules',
    'Five tool scopes on the left. read and local_write run immediately; destructive, external and system wait for approval. external is circled: the code refuses to set it to allow.', out);
}
