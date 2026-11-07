// orion-core.js: the opening's renderer. No DOM, so it also runs in Node (tools/render-orion-frame.mjs).
//
// It is the Rasterix pipeline (raster-core.js) grown for a bigger scene: several parts, each with
// its own explode offset; a z-buffer and a part-id buffer for picking; flat Lambert shading with a
// movable light; then a print pass that turns light into ink with an 8×8 ordered (Bayer) dither and
// draws outlines where depth or part changes. Modes follow the pipeline: points, wires, pixels.

const BAYER = (() => {
  const m = [[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22], [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]];
  const out = new Float32Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y * 8 + x] = (m[y][x] + 0.5) / 64;
  return out;
})();

export const Z_MID = 408;          // mm, middle of the assembled rocket (−34 … 850)
export const LENGTH = 884;         // mm, assembled length, measured from the meshes
const GAP = 115;                   // mm between parts when fully exploded

export function prepareMesh(json) {
  const n = json.parts.length;
  return json.parts.map((p, i) => {
    const v = new Float32Array(p.v.length);
    for (let k = 0; k < v.length; k++) v[k] = p.v[k] / 10;
    return {
      id: p.id, name: p.name, lengthMm: p.lengthMm, diameterMm: p.diameterMm,
      zMid: (p.z[0] + p.z[1]) / 2, v, f: Uint32Array.from(p.f),
      offset: (i - (n - 1) / 2) * GAP, // explode direction along the axis
      spin: (i % 2 ? 1 : -1) * 0.5,      // parts turn a little as they separate
    };
  });
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function createOrion(parts, width, height) {
  const W = width, H = height, N = W * H;
  const depth = new Float32Array(N);
  const shade = new Float32Array(N);
  const pid = new Int8Array(N);
  const rgba = new Uint8ClampedArray(N * 4);
  const wire = new Uint8Array(N);          // 1 = front edge, 2 = back edge, 3 = vertex
  let maxV = 0;
  for (const p of parts) maxV = Math.max(maxV, p.v.length / 3);
  const sx = new Float32Array(maxV), sy = new Float32Array(maxV), sz = new Float32Array(maxV);
  const cx3 = new Float32Array(maxV), cy3 = new Float32Array(maxV), cz3 = new Float32Array(maxV);

  function plotWire(x, y, val) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (wire[i] === 0 || val < wire[i]) wire[i] = val;
  }
  // Bresenham, as in Rasterix's LineDrawer
  function line(x0, y0, x1, y1, val) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), stx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sty = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let g = 0; g < 4096; g++) {
      plotWire(x0, y0, val);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += stx; }
      if (e2 <= dx) { err += dx; y0 += sty; }
    }
  }

  /**
   * state: { yaw, pitch, tilt, explode (0..1), light [x,y,z], mode 'points'|'wires'|'pixels',
   *          scan (0..1, rows above are printed, rows below stay wires), hover (part index or -1),
   *          centerX, centerY (px), pxPerMm, ink '#hex', body '#hex', dark (bool) }
   */
  function render(s) {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    depth.fill(Infinity); shade.fill(-1); pid.fill(-1); wire.fill(0);
    const cyw = Math.cos(s.yaw), syw = Math.sin(s.yaw);
    const cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
    const ct = Math.cos(s.tilt), st = Math.sin(s.tilt);
    const L = s.light; const ll = Math.hypot(L[0], L[1], L[2]) || 1;
    const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
    const ppm = s.pxPerMm, camD = 2600; // mm; mild perspective
    const e = s.explode;
    const wantWire = s.mode !== 'pixels' || s.scan < 1;
    const wantFill = s.mode === 'pixels';
    const anchors = [];
    let drawn = 0, tris = 0;

    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi];
      const nv = p.v.length / 3;
      const dz = p.offset * e;
      const spin = p.spin * e;
      const cs = Math.cos(s.yaw + spin), ss = Math.sin(s.yaw + spin);
      // model → camera: spin about the rocket axis (z), lift by the explode offset, centre,
      // tilt in the picture plane, then pitch toward the viewer. Camera looks along +y.
      const xf = (x, y, z, out, k) => {
        let X = x * cs - y * ss, Y = x * ss + y * cs, Z = z + dz - Z_MID;
        // pitch about screen x: Y is depth, Z is up
        const Y2 = Y * cp - Z * sp, Z2 = Y * sp + Z * cp;
        // tilt in the picture plane (about depth)
        const X3 = X * ct - Z2 * st, Z3 = X * st + Z2 * ct;
        cx3[k] = X3; cy3[k] = Y2; cz3[k] = Z3;
        const persp = camD / (camD + Y2);
        sx[k] = s.centerX + X3 * ppm * persp;
        sy[k] = s.centerY - Z3 * ppm * persp;
        sz[k] = Y2;
      };
      for (let k = 0; k < nv; k++) xf(p.v[k * 3], p.v[k * 3 + 1], p.v[k * 3 + 2], null, k);

      // label anchor: the part's middle on the axis, and the axis direction on screen
      {
        const zc = p.zMid + dz - Z_MID;
        const Y2 = -zc * sp, Z2 = zc * cp;
        const X3 = -Z2 * st, Z3 = Z2 * ct;
        const persp = camD / (camD + Y2);
        anchors.push({ x: s.centerX + X3 * ppm * persp, y: s.centerY - Z3 * ppm * persp, r: (p.diameterMm / 2) * ppm });
      }

      const F = p.f;
      for (let fi = 0; fi < F.length; fi += 3) {
        const a = F[fi], b = F[fi + 1], c = F[fi + 2];
        tris++;
        // face normal (camera space)
        const ux = cx3[b] - cx3[a], uy = cy3[b] - cy3[a], uz = cz3[b] - cz3[a];
        const vx = cx3[c] - cx3[a], vy = cy3[c] - cy3[a], vz = cz3[c] - cz3[a];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        // screen-space winding decides facing (mesh winding is consistent per STL)
        const area = (sx[b] - sx[a]) * (sy[c] - sy[a]) - (sy[b] - sy[a]) * (sx[c] - sx[a]);
        const front = area < 0;
        if (wantWire && s.mode !== 'points') {
          const val = front ? 1 : 2;
          line(sx[a], sy[a], sx[b], sy[b], val); line(sx[b], sy[b], sx[c], sy[c], val); line(sx[c], sy[c], sx[a], sy[a], val);
        }
        if (s.mode === 'points' && front) { plotWire(sx[a], sy[a], 3); plotWire(sx[b], sy[b], 3); plotWire(sx[c], sy[c], 3); }
        if (!wantFill || area === 0) continue;
        // two-sided: flip the normal toward the viewer (camera at −y)
        if (ny > 0) { nx = -nx; ny = -ny; nz = -nz; }
        const lam = Math.max(0, nx * lx + ny * ly + nz * lz);
        const rim = Math.pow(1 - Math.abs(ny), 3) * 0.25;
        const I = Math.min(1, 0.08 + 0.92 * lam + rim);
        drawn++;
        const ax = sx[a], ay = sy[a], bx = sx[b], by = sy[b], qx = sx[c], qy = sy[c];
        const minX = Math.max(0, Math.floor(Math.min(ax, bx, qx))), maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, qx)));
        const minY = Math.max(0, Math.floor(Math.min(ay, by, qy))), maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, qy)));
        const inv = 1 / area;
        for (let y = minY; y <= maxY; y++) {
          const py = y + 0.5;
          for (let x = minX; x <= maxX; x++) {
            const px = x + 0.5;
            // the edge function, as in Rasterix
            const w0 = ((qx - bx) * (py - by) - (qy - by) * (px - bx)) * inv;
            const w1 = ((ax - qx) * (py - qy) - (ay - qy) * (px - qx)) * inv;
            const w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const z = w0 * sz[a] + w1 * sz[b] + w2 * sz[c];
            const i = y * W + x;
            if (z >= depth[i]) continue;
            depth[i] = z; shade[i] = I; pid[i] = pi;
          }
        }
      }
    }

    // print pass
    const ink = hexToRgb(s.ink), body = hexToRgb(s.body);
    const scanRow = Math.round(s.scan * H);
    const hov = s.hover ?? -1;
    rgba.fill(0);
    for (let y = 0; y < H; y++) {
      const printed = wantFill && y < scanRow;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, o = i * 4;
        if (printed && pid[i] >= 0) {
          const pp = pid[i];
          // outline where the part or the depth changes
          const r = x + 1 < W ? i + 1 : i, d = y + 1 < H ? i + W : i;
          const edge = pid[r] !== pp || pid[d] !== pp || Math.abs(depth[r] - depth[i]) > 22 || Math.abs(depth[d] - depth[i]) > 22;
          let cov = s.dark ? shade[i] : 1 - shade[i];
          if (hov >= 0) cov = pp === hov ? Math.min(1, cov * 1.25 + 0.12) : cov * 0.45;
          const on = edge || cov > BAYER[(y & 7) * 8 + (x & 7)];
          const c = on ? ink : body;
          rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2];
          rgba[o + 3] = on ? 255 : (hov >= 0 && pp !== hov ? 150 : 235);
          continue;
        }
        const w = wire[i];
        if (w && (!wantFill || y >= scanRow)) {
          if (w === 2 && ((x + y) & 1)) continue; // back edges: every other pixel
          rgba[o] = ink[0]; rgba[o + 1] = ink[1]; rgba[o + 2] = ink[2];
          rgba[o + 3] = w === 2 ? 50 : w === 3 ? 255 : 150;
        }
      }
      if (wantFill && y === scanRow && s.scan > 0 && s.scan < 1) {
        for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; rgba[o] = ink[0]; rgba[o + 1] = ink[1]; rgba[o + 2] = ink[2]; rgba[o + 3] = (x & 1) ? 255 : 120; }
      }
    }
    const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    return { rgba, anchors, triangles: tris, drawn, ms: t1 - t0 };
  }

  function pick(x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    return pid[y * W + x];
  }

  return { width: W, height: H, render, pick };
}
