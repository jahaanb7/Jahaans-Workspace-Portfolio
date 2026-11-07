// workbench.js: the Workbench cards.
//
// - Line studies plot themselves in when they come into view (CSS stroke-dashoffset on a
//   normalised pathLength), view by view. Re-selecting the tab plots them again.
// - The red handwritten note on each sheet gets a Rough Notation underline once it has been seen.
// - The "Patterns" tab runs a sand simulation on an ideal square plate. It only animates while
//   its panel is open and on screen; with reduced motion it jumps straight to the settled state.

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function plot(fig) {
  const svg = fig.querySelector('svg');
  if (!svg) return;
  svg.querySelectorAll('.v').forEach((p) => p.setAttribute('pathLength', '1'));
  if (reduce()) { fig.classList.add('is-plotted'); return; }
  fig.classList.remove('is-plotted');
  // two frames so the reset state is painted before the transition starts
  requestAnimationFrame(() => requestAnimationFrame(() => fig.classList.add('is-plotted')));
}

function initStudies(root) {
  const figs = [...root.querySelectorAll('[data-study]')];
  figs.forEach((f) => {
    f.classList.add('js-plot');
    f.querySelectorAll('svg .v').forEach((p) => p.setAttribute('pathLength', '1'));
  });
  if (!('IntersectionObserver' in window)) { figs.forEach(plot); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { io.unobserve(e.target); plot(e.target); }
    });
  }, { rootMargin: '0px 0px -18% 0px' });
  figs.forEach((f) => io.observe(f));
  root.querySelectorAll('[data-paper]').forEach((paper) => {
    paper.addEventListener('tabs:change', (e) => {
      const fig = e.detail.panel.querySelector('[data-study]');
      if (fig) { io.unobserve(fig); plot(fig); }
    });
  });
}

function initNotes(root, { whenNear, loadRoughNotation }) {
  root.querySelectorAll('[data-note]').forEach((note) => {
    whenNear(note, () => {
      if (reduce()) { note.classList.add('is-marked'); return; }
      loadRoughNotation().then((RN) => {
        const a = RN.annotate(note, { type: 'underline', color: getComputedStyle(document.documentElement).getPropertyValue('--pencil').trim() || '#B9B9BE', strokeWidth: 1.6, padding: 2, iterations: 1, animationDuration: 700 });
        setTimeout(() => a.show(), 900);
      }).catch(() => note.classList.add('is-marked'));
    }, '-25% 0px');
  });
}

/* ---------- sand on an ideal square plate ---------- */
// Displacement of mode (n, m) on a free square plate, in the classic Chladni approximation:
//   u(x, y) = cos(nπx) cos(mπy) − cos(mπx) cos(nπy),  x, y in [0, 1].
// Sand is kicked in proportion to |u| and comes to rest on the nodal lines (u = 0).
function initSand(box) {
  const canvas = box.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const read = box.querySelector('[data-sand-read]');
  const modeBtns = [...box.querySelectorAll('[data-mode]')];
  const N = 5200;
  const xs = new Float32Array(N), ys = new Float32Array(N);
  let n = 1, m = 2, raf = 0, running = false, visible = false, open = false, settle = 0;
  const PI = Math.PI;
  const amp = (x, y) => Math.cos(n * PI * x) * Math.cos(m * PI * y) - Math.cos(m * PI * x) * Math.cos(n * PI * y);

  function scatter() {
    for (let i = 0; i < N; i++) { xs[i] = Math.random(); ys[i] = Math.random(); }
    settle = 0;
  }
  function step(k = 1) {
    for (let s = 0; s < k; s++) {
      const kick = 0.018 * Math.max(0.25, 1 - settle / 900);
      for (let i = 0; i < N; i++) {
        const a = Math.abs(amp(xs[i], ys[i]));
        const r = kick * a + 0.0004;
        let x = xs[i] + (Math.random() - 0.5) * r * 2;
        let y = ys[i] + (Math.random() - 0.5) * r * 2;
        if (x < 0) x = -x; else if (x > 1) x = 2 - x;
        if (y < 0) y = -y; else if (y > 1) y = 2 - y;
        xs[i] = x; ys[i] = y;
      }
      settle++;
    }
  }
  function draw() {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#0F2236';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#A4C8E1';
    for (let i = 0; i < N; i++) ctx.fillRect(xs[i] * (w - 2), ys[i] * (h - 2), 1.6, 1.6);
  }
  function frame() {
    if (!running) return;
    step(2);
    draw();
    if (settle > 1600) { running = false; return; } // settled: stop spending frames
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    const go = visible && open && settle <= 1600 && !reduce() && document.visibilityState === 'visible';
    if (go && !running) { running = true; raf = requestAnimationFrame(frame); }
    if (!go && running) { running = false; cancelAnimationFrame(raf); }
  }
  function setMode(btn) {
    [n, m] = btn.dataset.mode.split(',').map(Number);
    modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    read.textContent = `mode (${n}, ${m}) · computed`;
    scatter();
    if (reduce()) { step(700); draw(); } else { draw(); sync(); }
  }

  modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b)));
  box.querySelector('[data-shake]').addEventListener('click', () => {
    scatter();
    if (reduce()) step(700);
    draw();
    sync();
  });
  const panel = box.closest('[role="tabpanel"]');
  open = !panel.hidden;
  panel.closest('[data-tabs]').addEventListener('tabs:change', () => { open = !panel.hidden; sync(); });
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; sync(); }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  scatter();
  step(reduce() ? 700 : 0);
  draw();
}

export function initWorkbench(root, helpers) {
  initStudies(root);
  initNotes(root, helpers);
  const sand = root.querySelector('[data-sand]');
  if (sand) initSand(sand);
}
