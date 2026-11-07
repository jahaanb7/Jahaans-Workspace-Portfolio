// pipeline.js: the Rasterix bench.
// Static stage images ship in the markup. When the bench nears the viewport the mesh is fetched
// and a canvas takes over, drawn live by js/raster-core.js (a port of the Rasterix pipeline).
// - Modes: vertices, wireframe, filled (buttons, or keys 1–3 on the canvas).
// - Drag (or arrow keys) to turn the mesh.
// - Point at a pixel in Filled mode: the ledger shows the real numbers the rasterizer used for it
//   (barycentric weights, interpolated depth, the shade term). Nothing here is illustrative.
import { createRasterizer, MODES } from './raster-core.js';

const POSE = { yaw: -0.55, pitch: 0.18 };
const LABELS = ['Vertices', 'Wireframe', 'Filled'];
const SIZE = 400;
const FOV = 40;
const f2 = (v) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);

export function initPipeline(root) {
  const canvas = root.querySelector('canvas');
  const frame = root.querySelector('[data-ras-frame]') || canvas.parentElement;
  const imgs = [...root.querySelectorAll('[data-stage-img]')];
  const buttons = [...root.querySelectorAll('[data-stage]')];
  const label = root.querySelector('[data-stage-label]');
  const count = root.querySelector('[data-ras-count]');
  const probe = root.querySelector('[data-ras-probe]');
  const steps = [...root.querySelectorAll('[data-step]')];
  const live = [...root.querySelectorAll('[data-live]')];
  const idle = live.map((n) => n.innerHTML);
  const state = { stage: 2, yaw: POSE.yaw, pitch: POSE.pitch, mesh: null, raf: 0, stats: null, hover: null };
  let ctx, raster, image;

  function paint() {
    state.raf = 0;
    if (!state.mesh) return;
    state.stats = raster.render(state.mesh, { yaw: state.yaw, pitch: state.pitch, mode: MODES[state.stage] });
    image.data.set(raster.color);
    ctx.putImageData(image, 0, 0);
    if (count) count.textContent = `${state.stats.drawn} of ${state.stats.triangles} triangles face you`;
    if (state.hover) readPixel(state.hover.x, state.hover.y);
  }
  const schedule = () => { if (!state.raf) state.raf = requestAnimationFrame(paint); };

  // steps that the current mode actually runs
  const active = () => (state.stage === 0 ? [0] : state.stage === 1 ? [0, 1] : [0, 1, 2, 3]);
  function show() {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.stage) === state.stage)));
    imgs.forEach((im) => im.classList.toggle('is-on', Number(im.dataset.stageImg) === state.stage));
    if (label) label.textContent = LABELS[state.stage];
    const on = active();
    steps.forEach((li, i) => li.classList.toggle('is-off', !on.includes(i)));
    if (state.mesh) canvas.setAttribute('aria-label', imgs[state.stage].alt);
    if (state.stage !== 2) clearProbe();
    schedule();
  }
  function setStage(i) { state.stage = Math.max(0, Math.min(2, i)); show(); }

  /* ---------- the pixel probe ---------- */
  function clearProbe() {
    state.hover = null;
    if (probe) probe.hidden = true;
    live.forEach((n, i) => { n.innerHTML = idle[i]; });
    root.classList.remove('is-probing');
  }
  function readPixel(x, y) {
    const r = raster.inspect(x, y);
    if (!r) { live.forEach((n, i) => { n.innerHTML = idle[i]; }); root.classList.remove('is-probing'); probe?.classList.add('is-miss'); return; }
    probe?.classList.remove('is-miss');
    root.classList.add('is-probing');
    const [w0, w1, w2] = r.w;
    const f = 1 / Math.tan((FOV * Math.PI) / 360);
    live[0].innerHTML = `pixel (${x}, ${y}) · f = ${f.toFixed(3)} at ${FOV}°`;
    live[1].innerHTML = `w = (${f2(w0)}, ${f2(w1)}, ${f2(w2)}) · Σ = ${(w0 + w1 + w2).toFixed(2)} · triangle #${r.face}`;
    live[2].innerHTML = `z = ${f2(w0)}·${r.a[2].toFixed(4)} + ${f2(w1)}·${r.b[2].toFixed(4)} + ${f2(w2)}·${r.c[2].toFixed(4)} = ${r.z.toFixed(4)}`;
    live[3].innerHTML = `n̂·l̂ = ${r.lambert.toFixed(3)} → k = ${r.k.toFixed(3)}`;
  }
  function toPixel(e) {
    const rect = canvas.getBoundingClientRect();
    // the canvas is drawn with object-fit: contain inside a square box
    const side = Math.min(rect.width, rect.height);
    const ox = rect.left + (rect.width - side) / 2, oy = rect.top + (rect.height - side) / 2;
    const x = Math.floor(((e.clientX - ox) / side) * SIZE), y = Math.floor(((e.clientY - oy) / side) * SIZE);
    return { x, y, cx: e.clientX - frame.getBoundingClientRect().left, cy: e.clientY - frame.getBoundingClientRect().top };
  }

  /* ---------- drag to turn ---------- */
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch, moved: false };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      state.yaw = drag.yaw + dx * 0.01;
      state.pitch = Math.max(-1.2, Math.min(1.2, drag.pitch + dy * 0.01));
      root.classList.add('is-dragging');
    }
    if (state.stage === 2 && e.pointerType !== 'touch') {
      const p = toPixel(e);
      state.hover = { x: p.x, y: p.y };
      if (probe) { probe.hidden = false; probe.style.transform = `translate(${p.cx}px, ${p.cy}px)`; }
      if (!drag) readPixel(p.x, p.y);
    }
    schedule();
  });
  const endDrag = () => { drag = null; root.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { if (!drag) clearProbe(); });
  canvas.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft') state.yaw -= 0.12;
    else if (k === 'ArrowRight') state.yaw += 0.12;
    else if (k === 'ArrowUp') state.pitch = Math.max(-1.2, state.pitch - 0.12);
    else if (k === 'ArrowDown') state.pitch = Math.min(1.2, state.pitch + 0.12);
    else if (k >= '1' && k <= '3') { setStage(+k - 1); }
    else return;
    e.preventDefault();
    schedule();
  });

  buttons.forEach((b) => b.addEventListener('click', () => setStage(Number(b.dataset.stage))));
  show();

  async function goLive() {
    try {
      const res = await fetch(root.dataset.mesh);
      if (!res.ok) throw new Error(`mesh ${res.status}`);
      state.mesh = await res.json();
      canvas.width = SIZE; canvas.height = SIZE;
      ctx = canvas.getContext('2d');
      raster = createRasterizer(SIZE, SIZE, { accent: '#F0F0F0', ink: '#A4C8E1', background: '#0F2236', fovDegrees: FOV });
      image = ctx.createImageData(SIZE, SIZE);
      canvas.removeAttribute('aria-hidden');
      canvas.setAttribute('role', 'img');
      canvas.hidden = false;
      imgs.forEach((im) => { im.hidden = true; });
      root.classList.add('is-live');
      show();
    } catch (err) {
      console.warn('The Rasterix bench keeps its static stages.', err);
    }
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); goLive(); }
    }, { rootMargin: '400px 0px' });
    io.observe(root);
  } else {
    goLive();
  }

  root.pipeline = { setStage, state: () => ({ stage: state.stage, yaw: state.yaw, live: !!state.mesh }), probe: (x, y) => { state.hover = { x, y }; readPixel(x, y); return live.map((n) => n.textContent); } };
}

// The fluid frame sequence (Fig. 6): a range input picks one of the captured frames.
export function initSequence(root) {
  const frames = [...root.querySelectorAll('[data-frame]')];
  const input = root.querySelector('[data-seq-input]');
  const out = root.querySelector('[data-seq-out]');
  const numbers = frames.map((f) => f.src.match(/(\d+)\.webp$/)?.[1].replace(/^0+/, '') || '');
  function set(i) {
    const k = Math.max(0, Math.min(frames.length - 1, i));
    frames.forEach((f, j) => f.classList.toggle('is-on', j === k));
    if (Number(input.value) !== k) input.value = String(k);
    out.textContent = numbers[k];
    thumbs.forEach((t) => t.setAttribute('aria-pressed', String(Number(t.dataset.seqThumb) === k)));
    input.setAttribute('aria-valuetext', `Frame ${numbers[k]} of the run`);
  }
  // contact sheet thumbnails (siblings of the figure in the same article)
  const thumbs = [...(root.closest('article') || root).querySelectorAll('[data-seq-thumb]')];
  thumbs.forEach((t) => t.addEventListener('click', () => set(Number(t.dataset.seqThumb))));
  input.addEventListener('input', () => set(Number(input.value)));
  set(Number(input.value));
  root.sequence = { set, count: frames.length };
}

// Concept labels (Rasterix steps and prints): tap or click opens the maths; one open per group.
export function initReveals(scope = document) {
  const items = [...scope.querySelectorAll('[data-reveal]')];
  const set = (el, open) => {
    el.classList.toggle('is-open', open);
    el.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', String(open));
  };
  items.forEach((el) => {
    const btn = el.querySelector('[aria-expanded]');
    btn?.addEventListener('click', () => {
      const open = !el.classList.contains('is-open');
      const group = el.parentElement.closest('.ras-ledger, .ras-prints') || el.parentElement;
      items.filter((o) => o !== el && group.contains(o)).forEach((o) => set(o, false));
      set(el, open);
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(el, false); btn?.focus(); } });
  });
  document.addEventListener('click', (e) => {
    items.forEach((el) => { if (el.classList.contains('is-open') && !el.contains(e.target) && el.closest('.ras-prints')) set(el, false); });
  });
}
