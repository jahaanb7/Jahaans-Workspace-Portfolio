// orbital.js: draws a hydrogen orbital from QuantumSim as ink dots on a print.
// The physics is QuantumSim's own src/physics/orbitals.js, copied unchanged into
// js/quantumsim/ by tools/sync-quantumsim.mjs (commit pinned in js/quantumsim/SOURCE.json).
// This file only handles the canvas: projection, ink, drag, morph.

import { sampleCloud, orbitalLabel } from './quantumsim/orbitals.js';

const N = 14000;
const INK_POS = '27, 58, 87';     // #1B3A57 navy: ψ > 0
const INK_NEG = '106, 150, 186';  // a sky-steel tint: ψ < 0

// (n, l, m) for each button; m follows QuantumSim's real-harmonic convention.
const ORBITALS = {
  '1s':   { n: 1, l: 0, m: 0 },
  '2pz':  { n: 2, l: 1, m: 0 },
  '3dz2': { n: 3, l: 2, m: 0 },
  '3dxy': { n: 3, l: 2, m: -2 },
  '4fz3': { n: 4, l: 3, m: 0 },
};

// QuantumSim labels look like "3d_z²"; render the suffix as a subscript.
const htmlLabel = ({ n, l, m }) => orbitalLabel(n, l, m).replace(/_(.+)$/, '<sub>$1</sub>');

function sample(o) {
  const c = sampleCloud({ ...o, zEff: 1, count: N, seed: 1 + o.n * 16 + o.l * 4 + (o.m + 3) });
  return { pos: c.positions, sign: c.signs, extent: c.extent, mean: c.mean };
}

export function initOrbital(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const buttons = [...root.querySelectorAll('[data-orbital]')];
  const pauseBtn = root.querySelector('[data-orbital-pause]');
  const readout = root.querySelector('[data-orbital-readout]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 0, h = 0, dpr = 1;
  let yaw = 0.6, pitch = 0.32, spin = !reduce, visible = false, dirty = true;
  let from = null, cur = null, extent = 1, extentFrom = 1, t0 = 0, morph = 1;
  const shown = new Float32Array(N * 3);

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    dirty = true;
  };

  const select = (key) => {
    const o = ORBITALS[key];
    if (!o) return;
    const next = sample(o);
    from = cur ? Float32Array.from(shown) : null;
    extentFrom = cur ? extent : next.extent;
    cur = next; t0 = performance.now(); morph = from && !reduce ? 0 : 1;
    if (morph === 1) { shown.set(cur.pos); extent = cur.extent; }
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orbital === key)));
    const label = htmlLabel(o), name = orbitalLabel(o.n, o.l, o.m).replace('_', ' ');
    readout.innerHTML = `${label} · n=${o.n} l=${o.l} · ⟨r⟩ = ${+cur.mean.toFixed(1)} a₀`;
    canvas.setAttribute('aria-label', `${name} orbital drawn as ${N.toLocaleString()} points sampled from |ψ|², dark where ψ is positive and light where it is negative. Mean radius ${+cur.mean.toFixed(1)} Bohr radii.`);
    dirty = true;
  };

  const niceBar = (pxPerA0) => {
    for (const v of [1, 2, 5, 10, 20, 50]) if (v * pxPerA0 >= w * 0.16) return v;
    return 50;
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const scale = (Math.min(w, h) * 0.44) / extent;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const D = extent * 4;

    // z axis, faint pencil
    ctx.strokeStyle = 'rgba(74, 110, 141, 0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath();
    const ax = extent * 1.05;
    const zTop = cy - ax * cp * scale, zBot = cy + ax * cp * scale;
    ctx.moveTo(cx, zTop); ctx.lineTo(cx, zBot); ctx.stroke(); ctx.setLineDash([]);

    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]; // pos-far, neg-far, pos-near, neg-near
    const size = Math.max(1, Math.min(w, h) / 360);
    for (let i = 0; i < N; i++) {
      const x = shown[i * 3], y = shown[i * 3 + 1], z = shown[i * 3 + 2];
      const x1 = x * cyw - y * syw, y1 = x * syw + y * cyw;
      const y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp;
      const k = D / (D + y2);
      const sx = cx + x1 * scale * k, sy = cy - z2 * scale * k;
      paths[(y2 < 0 ? 2 : 0) + (cur.sign[i] > 0 ? 0 : 1)].rect(sx, sy, size * k, size * k);
    }
    ctx.fillStyle = `rgba(${INK_POS}, 0.38)`; ctx.fill(paths[0]);
    ctx.fillStyle = `rgba(${INK_NEG}, 0.45)`; ctx.fill(paths[1]);
    ctx.fillStyle = `rgba(${INK_POS}, 0.78)`; ctx.fill(paths[2]);
    ctx.fillStyle = `rgba(${INK_NEG}, 0.85)`; ctx.fill(paths[3]);

    // labels and scale bar
    ctx.font = `${Math.max(10, w / 60)}px ui-monospace, 'SF Mono', Menlo, monospace`;
    ctx.fillStyle = '#4A6E8D';
    ctx.textBaseline = 'middle';
    ctx.fillText('z', cx + 8, Math.max(14, zTop));
    const bar = niceBar(scale), bw = bar * scale, pad = Math.max(12, w * 0.035);
    ctx.fillStyle = '#1B3A57';
    ctx.fillRect(w - pad - bw, h - pad, bw, 2);
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${bar} a₀`, w - pad, h - pad - 6);
    ctx.textAlign = 'left';
  };

  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(now - last, 50); last = now;
    if (visible) {
      if (morph < 1) {
        morph = Math.min(1, (now - t0) / 700);
        const e = morph < 0.5 ? 4 * morph ** 3 : 1 - (-2 * morph + 2) ** 3 / 2;
        for (let i = 0; i < N * 3; i++) shown[i] = from[i] + (cur.pos[i] - from[i]) * e;
        extent = extentFrom + (cur.extent - extentFrom) * e;
        dirty = true;
      }
      if (spin && !dragging) { yaw += dt * 0.00022; dirty = true; }
      if (dirty && w > 0) { draw(); dirty = false; }
    }
    requestAnimationFrame(frame);
  };

  // drag to turn
  let dragging = false, px = 0, py = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    root.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += (e.clientX - px) * 0.008;
    pitch = Math.max(-1.3, Math.min(1.3, pitch + (e.clientY - py) * 0.008));
    px = e.clientX; py = e.clientY; dirty = true;
  });
  const end = () => { dragging = false; root.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
    if (!step) return;
    e.preventDefault();
    yaw += step[0]; pitch = Math.max(-1.3, Math.min(1.3, pitch + step[1])); dirty = true;
  });

  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.orbital)));
  if (pauseBtn) {
    const sync = () => {
      pauseBtn.setAttribute('aria-pressed', String(!spin));
      pauseBtn.textContent = spin ? 'Pause' : 'Spin';
    };
    pauseBtn.addEventListener('click', () => { spin = !spin; sync(); });
    sync();
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); last = performance.now(); }).observe(canvas);
  resize();
  select(buttons.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.orbital || '3dz2');
  root.classList.add('is-live');
  requestAnimationFrame(frame);
}
