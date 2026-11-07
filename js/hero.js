// hero.js: the opening. Orion's real CAD parts, rendered live by a JavaScript port of the Rasterix
// pipeline (js/orion-core.js) as a dithered print.
//
// - Intro: a scan line prints the shaded model (once; any input skips it).
// - Desktop: the opening is pinned while you scroll and the exploded rocket assembles.
// - The light follows the pointer; hovering a part names it; drag or arrow keys rotate.
// - Controls: explode/assemble and pause. Everything stops off screen.
// - Reduced motion: no intro, no idle spin, no scroll assembly; still fully interactive.

import { prepareMesh, createOrion, LENGTH } from './orion-core.js';
import { HERO_POSE } from './hero-pose.js';

const root = document.querySelector('[data-hero]');
if (root) start(root).catch((err) => console.warn('hero unavailable', err));

async function start(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const stage = root.querySelector('.hero-stage');
  const track = root.querySelector('.hero-track');
  const labelsEl = root.querySelector('[data-hero-labels]');
  const statsEl = root.querySelector('[data-hero-stats]');
  const modeBtns = [...root.querySelectorAll('[data-hero-mode]')];
  const explodeBtn = root.querySelector('[data-hero-explode]');
  const pauseBtn = root.querySelector('[data-hero-pause]');
  const caption = root.querySelector('[data-hero-caption]');
  const cue = root.querySelector('[data-hero-cue]');

  const json = await (await fetch(root.dataset.mesh)).json();
  const parts = prepareMesh(json);

  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqPin = matchMedia('(min-width: 1024px) and (prefers-reduced-motion: no-preference)');
  const reduce = () => mqReduce.matches;

  const S = {
    yaw: HERO_POSE.yaw, pitch: HERO_POSE.pitch, tilt: HERO_POSE.tilt,
    light: [...HERO_POSE.light], lightTarget: [...HERO_POSE.light],
    explode: 1, explodeTarget: 1, manual: null,
    mode: 'pixels', scan: 1, hover: -1,
    playing: !reduce(), visible: true, intro: !reduce(), introT: 0,
    spinV: 0, dragging: null, progress: 0,
  };

  let r = null, px = 3, W = 0, H = 0, img = null, colors = null;
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    colors = { ink: cs.getPropertyValue('--ink').trim() || '#ECECEC', body: cs.getPropertyValue('--surface').trim() || '#17171A', dark: document.documentElement.dataset.theme !== 'light' };
  }
  function resize() {
    const rect = stage.getBoundingClientRect();
    px = 2;
    W = Math.max(60, Math.ceil(rect.width / px)); H = Math.max(60, Math.ceil(rect.height / px));
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * px}px`; canvas.style.height = `${H * px}px`;
    r = createOrion(parts, W, H);
    img = ctx.createImageData(W, H);
    measureBand();
    buildLabels();
    dirty = true;
  }

  // On narrow screens the rocket gets the band between the copy and the controls.
  let band = null;
  function measureBand() {
    const copy = root.querySelector('.hero-copy'), hud = root.querySelector('.hero-hud');
    const top = copy.offsetTop + copy.offsetHeight, bottom = hud.offsetTop;
    band = { top: top / px, height: Math.max(80, (bottom - top - 50) / px) };
  }
  function layout() {
    const wide = W * px >= 900;
    const span = 0.91 * (LENGTH + 575 * S.explode) + 90; // mm, vertical extent at this tilt
    if (wide) return { cx: W * 0.72, cy: H * 0.5, ppm: (H * 0.9) / span };
    return { cx: W * 0.38, cy: band.top + band.height / 2, ppm: (band.height * 0.95) / span };
  }

  /* ---------- labels ---------- */
  let labelEls = [];
  function buildLabels() {
    labelsEl.textContent = '';
    labelEls = parts.map((p, i) => {
      const el = document.createElement('span');
      el.className = 'hero-label';
      el.dataset.part = i;
      el.innerHTML = `<i class="hl-line"></i><span class="hl-no">${String(parts.length - i).padStart(2, '0')}</span> ${p.name} <span class="hl-mm">${p.lengthMm}&nbsp;mm</span>`;
      el.addEventListener('pointerenter', () => { S.hover = i; dirty = true; });
      el.addEventListener('pointerleave', () => { S.hover = -1; dirty = true; });
      labelsEl.append(el);
      return el;
    });
  }
  function placeLabels(anchors) {
    const show = Math.max(0, Math.min(1, (S.explode - 0.35) / 0.4));
    labelsEl.style.opacity = show;
    labelsEl.style.visibility = show < 0.02 ? 'hidden' : 'visible';
    // labels sit to the right of the axis, on the perpendicular; the leader points back to the part
    const nx = Math.cos(S.tilt), ny = -Math.sin(S.tilt);
    const ang = Math.atan2(ny, nx);
    anchors.forEach((a, i) => {
      const el = labelEls[i];
      if (!el) return;
      const off = a.r + 22 + (i % 2) * 14; // buffer px
      const x = (a.x + nx * off) * px, y = (a.y + ny * off) * px;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.setProperty('--len', `${((off - a.r - 4) * px).toFixed(1)}px`);
      el.style.setProperty('--ang', `${ang.toFixed(3)}rad`);
      el.classList.toggle('is-hot', S.hover === i);
    });
  }

  /* ---------- render ---------- */
  let dirty = true, last = 0, avg = 0, statT = 0;
  function draw() {
    const { cx, cy, ppm } = layout();
    const out = r.render({ yaw: S.yaw, pitch: S.pitch, tilt: S.tilt, explode: S.explode, light: S.light,
      mode: S.mode, scan: S.scan, hover: S.hover, centerX: cx, centerY: cy, pxPerMm: ppm,
      ink: colors.ink, body: colors.body, dark: colors.dark });
    img.data.set(out.rgba);
    ctx.putImageData(img, 0, 0);
    placeLabels(out.anchors);
    avg = avg ? avg * 0.9 + out.ms * 0.1 : out.ms;
    const now = performance.now();
    if (now - statT > 300) {
      statT = now;
      statsEl.textContent = `${out.triangles.toLocaleString('en')} triangles · ${avg.toFixed(1)} ms · ${W}×${H} px`;
    }
  }

  function setMode(m, fromIntro = false) {
    S.mode = m;
    modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.heroMode === m)));
    if (!fromIntro) { S.intro = false; S.scan = 1; }
    dirty = true;
  }

  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function tick(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    let moving = false;

    if (S.intro) {
      S.introT += dt;
      const k = S.introT;
      // the model prints in, top to bottom, as a shaded solid
      S.scan = ease(Math.min(1, k / 1.6));
      if (k > 1.6) { S.intro = false; S.scan = 1; }
      moving = true;
    }
    if (S.playing && !S.dragging) { S.yaw += dt * (0.22 + S.spinV); S.spinV *= 0.95; moving = true; }

    // scroll assembly (desktop) unless the visitor chose a state with the button
    if (mqPin.matches && track) {
      const rect = track.getBoundingClientRect();
      const range = Math.max(1, rect.height - innerHeight);
      const p = Math.max(0, Math.min(1, -rect.top / range));
      if (Math.abs(p - S.progress) > 0.001) { S.progress = p; if (S.manual !== null && Math.abs(p - S.manualAt) > 0.08) S.manual = null; }
      const sm = Math.max(0, Math.min(1, (p - 0.04) / 0.62));
      if (S.manual === null) S.explodeTarget = 1 - sm * sm * (3 - 2 * sm);
      S.tilt = HERO_POSE.tilt + p * 0.22;
      cue.style.opacity = String(Math.max(0, 1 - p * 8));
    }
    if (S.manual !== null) S.explodeTarget = S.manual;
    const de = S.explodeTarget - S.explode;
    if (Math.abs(de) > 0.001) { S.explode += reduce() ? de : de * Math.min(1, dt * 7); moving = true; }
    for (let k = 0; k < 3; k++) {
      const d = S.lightTarget[k] - S.light[k];
      if (Math.abs(d) > 0.002) { S.light[k] += d * Math.min(1, dt * 8); moving = true; }
    }
    caption.classList.toggle('is-on', S.explode < 0.08);
    explodeBtn.textContent = S.explodeTarget > 0.5 ? 'Assemble' : 'Explode';
    explodeBtn.setAttribute('aria-pressed', String(S.explodeTarget > 0.5));

    if ((moving || dirty) && S.visible) { draw(); dirty = false; }
    raf = S.visible && document.visibilityState === 'visible' ? requestAnimationFrame(tick) : 0;
  }
  let raf = 0;
  const wake = () => { if (!raf && S.visible && document.visibilityState === 'visible') { last = 0; raf = requestAnimationFrame(tick); } };

  /* ---------- input ---------- */
  const stopIntro = () => { if (S.intro) { S.intro = false; S.scan = 1; setMode('pixels', true); } };
  stage.addEventListener('pointermove', (e) => {
    const b = canvas.getBoundingClientRect();
    const x = (e.clientX - b.left) / px, y = (e.clientY - b.top) / px;
    const { cx, cy } = layout();
    S.lightTarget = [(x - cx) / W * 2.2, -1, -(y - cy) / H * 2.2];
    if (S.dragging) {
      const dx = e.clientX - S.dragging.x, dy = e.clientY - S.dragging.y;
      S.dragging.x = e.clientX; S.dragging.y = e.clientY;
      S.yaw += dx * 0.009; S.spinV = dx * 0.02;
      S.pitch = Math.max(-0.4, Math.min(0.9, S.pitch + dy * 0.004));
    } else if (e.pointerType === 'mouse') {
      const h = r ? r.pick(x, y) : -1;
      if (h !== S.hover) { S.hover = h; canvas.style.cursor = h >= 0 ? 'grab' : ''; }
    }
    dirty = true; wake();
  });
  stage.addEventListener('pointerleave', () => { S.hover = -1; S.lightTarget = [...HERO_POSE.light]; dirty = true; wake(); });
  canvas.addEventListener('pointerdown', (e) => {
    stopIntro();
    S.dragging = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  const endDrag = () => { S.dragging = null; canvas.style.cursor = ''; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight') S.yaw += (k === 'ArrowLeft' ? -0.2 : 0.2);
    else if (k === 'ArrowUp' || k === 'ArrowDown') S.pitch = Math.max(-0.4, Math.min(0.9, S.pitch + (k === 'ArrowUp' ? -0.1 : 0.1)));
    else if (k === 'e' || k === 'E') toggleExplode();
    else if (k === ' ' || k === 'p') togglePause();
    else return;
    e.preventDefault(); stopIntro(); dirty = true; wake();
  });
  modeBtns.forEach((b) => b.addEventListener('click', () => { setMode(b.dataset.heroMode); wake(); }));
  function toggleExplode() {
    S.manual = S.explodeTarget > 0.5 ? 0 : 1;
    S.manualAt = S.progress;
    stopIntro(); dirty = true; wake();
  }
  explodeBtn.addEventListener('click', toggleExplode);
  function togglePause() {
    S.playing = !S.playing;
    pauseBtn.textContent = S.playing ? 'Pause' : 'Play';
    pauseBtn.setAttribute('aria-pressed', String(!S.playing));
    stopIntro(); dirty = true; wake();
  }
  pauseBtn.addEventListener('click', togglePause);
  pauseBtn.textContent = S.playing ? 'Pause' : 'Play';
  pauseBtn.setAttribute('aria-pressed', String(!S.playing));

  new IntersectionObserver((es) => { S.visible = es[0].isIntersecting; if (S.visible) wake(); }).observe(stage);
  document.addEventListener('visibilitychange', wake);
  document.addEventListener('themechange', () => { readColors(); dirty = true; wake(); });
  addEventListener('scroll', wake, { passive: true });
  new ResizeObserver(() => { resize(); wake(); }).observe(stage);
  mqReduce.addEventListener('change', () => { if (reduce()) { S.playing = false; S.intro = false; S.scan = 1; } dirty = true; wake(); });

  readColors();
  resize();
  setMode('pixels', true);
  if (S.intro) S.scan = 0;
  root.classList.add('is-live');
  wake();
  root.hero = { state: () => ({ mode: S.mode, explode: +S.explode.toFixed(2), playing: S.playing, hover: S.hover, intro: S.intro, W, H }) };
}
