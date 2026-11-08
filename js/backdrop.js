// backdrop.js: contour lines of a vibrating plate, drifting behind the page.
//
// The field is the same Chladni approximation as the Patterns tab:
//   u(x, y) = cos(nπx) cos(mπy) − cos(mπx) cos(nπy)
// Two modes are blended and the blend slowly moves on to the next pair, so the nodal lines
// (u = 0, drawn a little brighter) bend from one pattern into another. A few more levels
// (u = ±0.6, ±1.2) are drawn faintly like a topographic map. The pointer presses a small dent
// into the field, so the lines lean around it.
//
// On top of the contours:
//   - a sparse field of arrows showing ∇u (direction and relative size),
//   - tracers that move along the level sets (velocity = ∇u rotated 90°, so u stays constant),
//   - ruler ticks on the left and bottom edges,
//   - a probe at the pointer (or riding a tracer) that reads out u.
//
// Marching squares on a coarse grid at about 20 fps. It pauses in hidden tabs and draws one still
// frame with reduced motion.

const MODES = [[1, 2], [2, 3], [1, 4], [3, 5], [2, 5], [1, 3], [3, 4], [2, 7]];
const HOLD = 14000;            // ms per pair
const STEP = 18;               // grid cell in CSS px
const LEVELS = [-1.2, -0.6, 0, 0.6, 1.2];

export function initBackdrop() {
  const c = document.createElement('canvas');
  c.className = 'backdrop';
  c.setAttribute('aria-hidden', 'true');
  document.body.prepend(c);
  const ctx = c.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  let w = 0, h = 0, dpr = 1, cols = 0, rows = 0, field = new Float32Array(0);
  let raf = 0, last = 0, ink = '#fff', accent = '#9cf', mono = 'monospace';
  let mode = { n1: 1, m1: 2, n2: 2, m2: 3, f: 0 };
  const TRACERS = innerWidth < 760 ? 30 : 70, TRAIL = 16;
  const tr = Array.from({ length: TRACERS }, () => ({ x: 0, y: 0, life: 0, pts: [] }));
  const ptr = { x: -1e4, y: -1e4, s: 0, tx: -1e4, ty: -1e4, on: false };

  function size() {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = innerWidth; h = innerHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    cols = Math.ceil(w / STEP) + 1; rows = Math.ceil(h / STEP) + 1;
    field = new Float32Array(cols * rows);
    const cs = getComputedStyle(document.documentElement);
    ink = cs.getPropertyValue('--ink').trim() || '#fff';
    accent = cs.getPropertyValue('--accent').trim() || ink;
    mono = cs.getPropertyValue('--f-mono').trim() || 'monospace';
    tr.forEach((p) => { p.life = 0; });
  }

  // bilinear sample of u and its gradient from the grid
  function sample(x, y) {
    const gx = Math.min(cols - 2, Math.max(0, x / STEP)), gy = Math.min(rows - 2, Math.max(0, y / STEP));
    const ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, i = iy * cols + ix;
    const a = field[i], b = field[i + 1], c = field[i + cols], d = field[i + cols + 1];
    const u = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
    const ux = ((b - a) * (1 - fy) + (d - c) * fy) / STEP;
    const uy = ((c - a) * (1 - fx) + (d - b) * fx) / STEP;
    return { u, ux, uy };
  }

  function spawn(p) {
    p.x = Math.random() * w; p.y = Math.random() * h;
    p.life = 60 + Math.random() * 120; p.pts.length = 0;
  }

  const smooth = (t) => t * t * (3 - 2 * t);
  const PI = Math.PI;

  function compute(t) {
    const k = t / HOLD;
    const i = Math.floor(k) % MODES.length;
    const f = smooth(Math.min(1, Math.max(0, (k % 1) * 1.6 - 0.3)));
    const [n1, m1] = MODES[i], [n2, m2] = MODES[(i + 1) % MODES.length];
    mode = { n1, m1, n2, m2, f };
    const P = Math.max(w, h) * 0.75;           // a little more than one plate across the long side
    const drift = t * 0.000004;                 // the whole pattern slides very slowly
    const r2 = (Math.min(w, h) * 0.12) ** 2;
    for (let gy = 0; gy < rows; gy++) {
      const py = gy * STEP, Y = py / P + drift * 0.7;
      for (let gx = 0; gx < cols; gx++) {
        const px = gx * STEP, X = px / P + drift;
        const a = Math.cos(n1 * PI * X) * Math.cos(m1 * PI * Y) - Math.cos(m1 * PI * X) * Math.cos(n1 * PI * Y);
        const b = Math.cos(n2 * PI * X) * Math.cos(m2 * PI * Y) - Math.cos(m2 * PI * X) * Math.cos(n2 * PI * Y);
        let u = a * (1 - f) + b * f;
        if (ptr.s > 0.001) {
          const dx = px - ptr.x, dy = py - ptr.y;
          u += 0.9 * ptr.s * Math.exp(-(dx * dx + dy * dy) / r2);
        }
        field[gy * cols + gx] = u;
      }
    }
  }

  // marching squares for one level, appended to the current path
  function contour(level) {
    for (let gy = 0; gy < rows - 1; gy++) {
      for (let gx = 0; gx < cols - 1; gx++) {
        const i = gy * cols + gx;
        const a = field[i] - level, b = field[i + 1] - level, d = field[i + cols] - level, e = field[i + cols + 1] - level;
        const idx = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (e > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x = gx * STEP, y = gy * STEP;
        const top = [x + STEP * (a / (a - b)), y];
        const right = [x + STEP, y + STEP * (b / (b - e))];
        const bottom = [x + STEP * (d / (d - e)), y + STEP];
        const left = [x, y + STEP * (a / (a - d))];
        const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
        switch (idx) {
          case 1: case 14: seg(left, bottom); break;
          case 2: case 13: seg(bottom, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(top, right); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, top); break;
          case 5: seg(left, top); seg(bottom, right); break;
          case 10: seg(top, right); seg(left, bottom); break;
        }
      }
    }
  }

  function draw(t, still = false) {
    // ease the pointer dent in and out
    ptr.x += (ptr.tx - ptr.x) * 0.12; ptr.y += (ptr.ty - ptr.y) * 0.12;
    ptr.s += ((ptr.on ? 1 : 0) - ptr.s) * 0.05;
    compute(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;

    // contours
    for (const level of LEVELS) {
      ctx.beginPath();
      contour(level);
      if (level === 0) { ctx.strokeStyle = accent; ctx.globalAlpha = 0.34; }
      else { ctx.strokeStyle = ink; ctx.globalAlpha = Math.abs(level) > 1 ? 0.07 : 0.11; }
      ctx.stroke();
    }

    // ∇u arrows on a sparse grid
    const G = STEP * 5;
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.13;
    ctx.beginPath();
    for (let y = G / 2; y < h; y += G) {
      for (let x = G / 2; x < w; x += G) {
        const { ux, uy } = sample(x, y);
        const m = Math.hypot(ux, uy);
        if (m < 1e-5) continue;
        const len = Math.min(16, 4 + m * 2600), dx = (ux / m) * len, dy = (uy / m) * len;
        const ex = x + dx / 2, ey = y + dy / 2;
        ctx.moveTo(x - dx / 2, y - dy / 2); ctx.lineTo(ex, ey);
        const ax = -dx / len * 3.5, ay = -dy / len * 3.5;
        ctx.moveTo(ex, ey); ctx.lineTo(ex + ax - ay * 0.6, ey + ay + ax * 0.6);
        ctx.moveTo(ex, ey); ctx.lineTo(ex + ax + ay * 0.6, ey + ay - ax * 0.6);
      }
    }
    ctx.stroke();

    // tracers ride the level sets: v = (−∂u/∂y, ∂u/∂x)
    if (!still) {
      for (const p of tr) {
        if (p.life <= 0) spawn(p);
        const { ux, uy } = sample(p.x, p.y);
        const m = Math.hypot(ux, uy) || 1;
        p.x += (-uy / m) * 2.2; p.y += (ux / m) * 2.2; p.life--;
        if (p.x < 0 || p.y < 0 || p.x > w || p.y > h) { p.life = 0; continue; }
        p.pts.push(p.x, p.y);
        if (p.pts.length > TRAIL * 2) p.pts.splice(0, 2);
      }
    }
    ctx.strokeStyle = accent;
    for (const p of tr) {
      const n = p.pts.length / 2;
      if (n < 2) continue;
      for (let k = 1; k < n; k++) {
        ctx.globalAlpha = 0.5 * (k / n) * Math.min(1, p.life / 30);
        ctx.beginPath(); ctx.moveTo(p.pts[k * 2 - 2], p.pts[k * 2 - 1]); ctx.lineTo(p.pts[k * 2], p.pts[k * 2 + 1]); ctx.stroke();
      }
    }

    // rulers on the left and bottom edges
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.22; ctx.beginPath();
    for (let y = 0; y < h; y += 20) { const L = y % 100 === 0 ? 10 : 4; ctx.moveTo(0, y); ctx.lineTo(L, y); }
    for (let x = 0; x < w; x += 20) { const L = x % 100 === 0 ? 10 : 4; ctx.moveTo(x, h); ctx.lineTo(x, h - L); }
    ctx.stroke();

    // probe: follows the pointer, otherwise rides the first live tracer
    let px = ptr.tx, py = ptr.ty;
    if (!ptr.on && (w < 900 || coarse.matches)) px = -1; // phones and tablets: no wandering readout
    else if (!ptr.on) { const p = tr.find((q) => q.pts.length > 6 && q.x > 120 && q.x < w - 260 && q.y > 120 && q.y < h - 80); if (p) { px = p.x; py = p.y; } else px = -1; }
    if (px > 0) {
      const { u } = sample(px, py);
      ctx.globalAlpha = 0.55; ctx.strokeStyle = accent; ctx.beginPath();
      ctx.moveTo(px - 9, py); ctx.lineTo(px - 3, py); ctx.moveTo(px + 3, py); ctx.lineTo(px + 9, py);
      ctx.moveTo(px, py - 9); ctx.lineTo(px, py - 3); ctx.moveTo(px, py + 3); ctx.lineTo(px, py + 9);
      ctx.stroke();
      ctx.globalAlpha = 0.5; ctx.fillStyle = ink; ctx.font = `10px ${mono}`;
      ctx.fillText(`u = ${u >= 0 ? ' ' : ''}${u.toFixed(3)}`, px + 14, py + 14);
    }
    ctx.globalAlpha = 1;
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < 50) return;
    last = t;
    draw(t);
  }

  function sync() {
    cancelAnimationFrame(raf);
    if (reduce.matches || document.hidden) { draw(HOLD * 0.2, true); return; }
    raf = requestAnimationFrame(frame);
  }

  size();
  sync();
  addEventListener('resize', () => { size(); if (reduce.matches) draw(HOLD * 0.2, true); });
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener?.('change', sync);
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    ptr.tx = e.clientX; ptr.ty = e.clientY; ptr.on = true;
    if (ptr.x < -1e3) { ptr.x = ptr.tx; ptr.y = ptr.ty; }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { ptr.on = false; });
  new MutationObserver(() => { size(); if (reduce.matches || document.hidden) draw(HOLD * 0.2, true); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
