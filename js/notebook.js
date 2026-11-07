// notebook.js: the scratchbook of smaller experiments.
//
// The page ships a plain reading view: one <article> per experiment, generated from
// data/experiments.json. This module turns the same nodes into a book. It moves (never
// copies) each article's two halves onto two pages, so there is only one copy of the
// content in the document; switching to the reading view puts every node back.
//
// One landscape spread per experiment: words on the left page, the taped figure on the right.
// The page turn is this file's own leaf engine: a corner fold (flat paper folded along the
// perpendicular bisector of the corner and where it is pulled to, the technique behind
// turn.js and StPageFlip), drawn with one transform and clip-paths on the real page nodes:
//   wide stage (>= SPREAD_MIN)  two-page spreads; the right leaf peels from its corner over the spine
//   narrow stage                a landscape notepad; the sheet folds away over its left edge
//   reduced motion              pages change instantly, every control stays
// A short page-flip sound (Kenney, CC0) plays on each turn; the speaker button mutes it.
// The leaf can be dragged: from a page corner with a mouse, or with a horizontal swipe on
// touch. Vertical scrolling and text selection keep working (touch-action: pan-y, and mouse
// drags only start in the corners). Pages that are not visible are inert.

const TURN_MS = 900; // length of a turn started by a button, key or tab
const SPREAD_MIN = 820; // stage width (px) from which two-page spreads are shown
const EDGE = 0.34; // a mouse drag can start in the outer third of either page

export function initNotebook(section) {
  const shell = section.querySelector('[data-notebook]');
  const reading = section.querySelector('[data-reading]');
  if (!shell || !reading) return;
  const stage = shell.querySelector('[data-nb-stage]');
  const bookEl = shell.querySelector('[data-nb-book]');
  const tabsNav = shell.querySelector('[data-nb-tabs]');
  const controls = shell.querySelector('[data-nb-controls]');
  const prevBtn = shell.querySelector('[data-nb-prev]');
  const nextBtn = shell.querySelector('[data-nb-next]');
  const indicator = shell.querySelector('[data-nb-indicator]');
  const viewBtns = [...section.querySelectorAll('[data-view]')];
  const viewGroup = section.querySelector('[data-nb-views]');
  const soundBtn = shell.querySelector('[data-nb-sound]');
  const articles = [...reading.querySelectorAll('[data-xp]')];
  const openQ = reading.querySelector('.xp-open');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- page model ---------- */
  // two pages per experiment: 0–1 is the first spread, 2–3 the second, …
  const model = [];
  articles.forEach((a, i) => { model.push({ kind: 'xp-a', i }, { kind: 'xp-b', i }); });
  const last = model.length - 1;
  const titles = articles.map((a, i) => a.querySelector('.xp-sub')?.textContent.trim() || a.querySelector('h3')?.textContent.trim() || `Entry ${i + 1}`);
  const tabs = articles.map((a, i) => a.dataset.tab || titles[i]);
  const pad2 = (n) => String(n).padStart(2, '0');
  const pageOfXp = (i) => 2 * i;

  /* ---------- sound ---------- */
  let soundOn = true;
  try { soundOn = localStorage.getItem('nb-sound') !== 'off'; } catch { /* storage blocked */ }
  const flips = [1, 2, 3].map((n) => new URL(`../assets/audio/page-flip-${n}.m4a`, import.meta.url).href);
  let audio = null;
  function playFlip() {
    if (!soundOn) return;
    try {
      audio ??= flips.map((src) => { const a = new Audio(src); a.preload = 'auto'; a.volume = 0.45; return a; });
      const a = audio[Math.floor(Math.random() * audio.length)];
      a.currentTime = 0;
      a.playbackRate = 0.92 + Math.random() * 0.16;
      a.play().catch(() => {});
    } catch { /* no audio support */ }
  }
  function setSound(on) {
    soundOn = on;
    soundBtn?.setAttribute('aria-pressed', String(on));
    soundBtn?.setAttribute('aria-label', on ? 'Page sounds on' : 'Page sounds off');
    try { localStorage.setItem('nb-sound', on ? 'on' : 'off'); } catch { /* storage blocked */ }
  }
  soundBtn?.addEventListener('click', () => { setSound(!soundOn); if (soundOn) playFlip(); });
  setSound(soundOn);

  let pages = [];
  let borrowed = [];
  let mode = 'reading';
  let idx = 0; // first visible page
  let spread = true;
  let busy = false;
  let pending = null;
  let focusAfterTurn = null;

  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  function borrow(node, into) {
    borrowed.push([node, node.parentNode, node.nextSibling]);
    into.append(node);
  }
  function restore() {
    for (let k = borrowed.length - 1; k >= 0; k -= 1) {
      const [node, parent, next] = borrowed[k];
      parent.insertBefore(node, next && next.parentNode === parent ? next : null);
    }
    borrowed = [];
  }

  function buildPages() {
    pages = model.map((m, n) => {
      const page = el('div', 'nb-page');
      const inner = el('div', 'nb-page-inner');
      page.append(inner);
      page.dataset.index = String(n);
      page.dataset.kind = m.kind;
      {
        const art = articles[m.i];
        page.dataset.layout = art.dataset.layout || 'plain';
        page.classList.add(m.kind === 'xp-a' ? 'nb-left-part' : 'nb-right-part');
        const part = art.querySelector(m.kind === 'xp-a' ? '.xp-a' : '.xp-b');
        if (part) borrow(part, inner);
      }
      return page;
    });
  }

  /* ---------- geometry ---------- */
  function spreadOf(n) {
    n = Math.max(0, Math.min(last, n));
    if (!spread) return [n];
    const left = n - (n % 2);
    return [left, Math.min(left + 1, last)];
  }
  // slot of a page within its spread: 'L' or 'R'
  function sideOf(n) {
    if (!spread) return 'S';
    return n % 2 === 0 ? 'L' : 'R';
  }
  const leftOf = (v) => v.find((n) => sideOf(n) === 'L');
  const rightOf = (v) => v.find((n) => sideOf(n) === 'R');

  // Size every page to the tallest content, so nothing is clipped or scrolls inside a page.
  function measure() {
    const w = stage.clientWidth;
    spread = w >= SPREAD_MIN;
    const pageW = Math.min(spread ? Math.floor(w / 2) : w, spread ? 680 : 720);
    bookEl.style.setProperty('--page-w', `${pageW}px`);
    bookEl.classList.toggle('is-spread', spread);
    bookEl.classList.toggle('is-pad', !spread);
    let h = Math.round(pageW * (spread ? 0.8 : 0.72)); // landscape
    for (const p of pages) {
      const prev = [p.hidden, p.style.cssText];
      p.hidden = false;
      p.style.cssText = `position:absolute;visibility:hidden;width:${pageW}px;height:auto;transform:none;`;
      h = Math.max(h, Math.ceil(p.firstChild.scrollHeight));
      [p.hidden, p.style.cssText] = prev;
    }
    bookEl.style.setProperty('--page-h', `${h}px`);
  }

  /* ---------- rendering ---------- */
  const leaf = el('div', 'nb-leaf');
  const faceA = el('div', 'nb-face nb-face-front');
  const faceB = el('div', 'nb-face nb-face-back');
  leaf.append(faceA, faceB);
  leaf.setAttribute('aria-hidden', 'true');
  const slotL = el('div', 'nb-slot nb-slot-l');
  const slotR = el('div', 'nb-slot nb-slot-r');
  const under = el('div', 'nb-fold-under'); // the shadow in the crease, on the page being uncovered
  const shadeA = el('div', 'nb-fold-light');
  const shadeB = el('div', 'nb-fold-light');
  leaf.prepend(under);

  function place(v) {
    pages.forEach((p) => { p.hidden = true; });
    slotL.textContent = '';
    slotR.textContent = '';
    for (const n of v) {
      const p = pages[n];
      p.hidden = false;
      (sideOf(n) === 'L' ? slotL : slotR).append(p);
    }
  }

  function render() {
    const v = spreadOf(idx);
    idx = v[0];
    place(v);
    refresh();
  }

  const xpOf = (n) => model[Math.max(0, Math.min(last, n))].i;

  const tabButtons = [];
  function buildTabs() {
    tabsNav.textContent = '';
    tabButtons.length = 0;
    articles.forEach((a, i) => {
      const name = tabs[i], page = pageOfXp(i), n = i + 1;
      const b = el('button', null, `<span class="mono">${pad2(n)}</span>${name}`);
      b.type = 'button';
      b.dataset.page = String(page);
      b.addEventListener('click', () => go(page, { focus: true }));
      tabsNav.append(b);
      tabButtons.push(b);
    });
  }

  function refresh() {
    const v = spreadOf(idx);
    pages.forEach((p, n) => {
      const on = v.includes(n) && !busy;
      p.inert = !on;
      if (on) p.removeAttribute('aria-hidden'); else p.setAttribute('aria-hidden', 'true');
    });
    prevBtn.disabled = v[0] <= 0;
    nextBtn.disabled = v[v.length - 1] >= last;
    const xi = xpOf(v[0]);
    indicator.innerHTML = `Page ${pad2(xi + 1)} of ${pad2(articles.length)} <span>— ${titles[xi]}</span>`;
    tabButtons.forEach((b, i) => {
      if (i === xi) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    if (busy) return;
    if (focusAfterTurn != null) {
      const target = v.includes(focusAfterTurn) ? pages[focusAfterTurn] : pages[v[0]];
      const h = target.querySelector('h3') || target.querySelector('button, a');
      if (h) {
        if (h.tagName === 'H3') h.tabIndex = -1;
        h.focus({ preventScroll: true });
      }
      focusAfterTurn = null;
    }
    // Never leave focus on a page that has just become inert: move it to the visible heading.
    const active = document.activeElement;
    if (active && active !== document.body && active.closest?.('.nb-page')?.inert) {
      const h = pages[v[0]].querySelector('h3') || stage;
      if (h.tagName === 'H3') h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }

  /* ---------- the turn ----------
     The turning sheet is always the right-hand leaf: its front is a right page, its back the
     left page of the next spread. A backward turn is the same leaf being laid back down.
     The sheet is flat paper folded along one line, the way a real page peels from a corner:
     the corner C is pulled to a point P, the fold is the perpendicular bisector of C and P,
     the front is clipped to the spine side of the fold and the back is the cut-off flap
     reflected across it. Two real page nodes, one transform and two clip-paths per frame:
     no clones, no strips, no seams. Coordinates: origin at the top of the spine, x toward the
     outer edge, y down; the leaf element sits exactly there. */
  function prepareTurn(from, to) {
    const fv = spreadOf(from), tv = spreadOf(to);
    const fwd = tv[0] > fv[0];
    pages.forEach((p) => { p.hidden = true; });
    slotL.textContent = '';
    slotR.textContent = '';
    faceA.textContent = '';
    faceB.textContent = '';
    const show = (n, into) => { if (n == null) return; pages[n].hidden = false; into.append(pages[n]); };
    if (spread) {
      if (fwd) {
        show(leftOf(fv), slotL); show(rightOf(tv), slotR);
        show(rightOf(fv), faceA); show(leftOf(tv), faceB);
      } else {
        show(leftOf(tv), slotL); show(rightOf(fv), slotR);
        show(rightOf(tv), faceA); show(leftOf(fv), faceB);
      }
    } else {
      // pad: the current sheet folds away over its left edge (forward), or the previous one comes back
      show(fwd ? tv[0] : fv[0], slotR);
      show(fwd ? fv[0] : tv[0], faceA);
    }
    faceA.classList.toggle('is-empty', !faceA.firstChild);
    faceB.classList.toggle('is-empty', !faceB.firstChild);
    faceA.append(shadeA);
    faceB.append(shadeB);
    leaf.className = `nb-leaf ${spread ? 'is-spine' : 'is-side'}`;
    bookEl.append(leaf);
    leaf.hidden = false;
    const w = leaf.offsetWidth, h = leaf.offsetHeight;
    const t = { fwd, tv, spread, w, h, top: false, P: null };
    setP(t, fwd ? w : -w, h); // flat where it starts
    return t;
  }

  // where the corner is when the sheet is flat (a = 0) or turned over (a = 1)
  const rest = (t, a) => [a ? -t.w : t.w, t.top ? 0 : t.h];
  // the corner's path for a turn: it sweeps over the spine and lifts a little on the way
  function arc(t, a) {
    const lift = t.h * 0.2 * Math.sin(Math.PI * a);
    return [t.w * Math.cos(Math.PI * a), t.top ? lift : t.h - lift];
  }
  // how far over a corner position is: 0 flat, 1 turned
  const aOf = (t, x) => Math.acos(Math.max(-1, Math.min(1, x / t.w))) / Math.PI;

  // Paper does not stretch: the corner stays within a page width of the spine end on its own
  // edge, and within a diagonal of the other end.
  function constrain(t, x, y) {
    const { w, h } = t;
    const ay = t.top ? 0 : h, by = t.top ? h : 0, diag = Math.hypot(w, h);
    let d = Math.hypot(x, y - ay);
    if (d > w) { x *= w / d; y = ay + (y - ay) * (w / d); }
    d = Math.hypot(x, y - by);
    if (d > diag) { x *= diag / d; y = by + (y - by) * (diag / d); }
    return [x, y];
  }

  // the part of polygon `pts` on the side s·((q − m)·n) ≤ 0
  function clipHalf(pts, nx, ny, mx, my, s) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const fp = s * ((p[0] - mx) * nx + (p[1] - my) * ny);
      const fq = s * ((q[0] - mx) * nx + (q[1] - my) * ny);
      if (fp <= 0) out.push(p);
      if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
        const k = fp / (fp - fq);
        out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
      }
    }
    return out;
  }
  const polygon = (pts, flipW) => (pts.length < 3 ? 'polygon(0 0, 0 0, 0 0)'
    : `polygon(${pts.map(([x, y]) => `${(flipW ? flipW - x : x).toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`);
  // a linear gradient along unit direction (dx, dy) in a w×h box, stops in px from point (rx, ry)
  function gradient(dx, dy, rx, ry, w, h, stops) {
    const L = Math.abs(w * dx) + Math.abs(h * dy);
    const o = (rx - (w / 2 - (dx * L) / 2)) * dx + (ry - (h / 2 - (dy * L) / 2)) * dy;
    return `linear-gradient(${Math.atan2(dx, -dy).toFixed(4)}rad, ${stops.map(([px, c]) => `${c} ${(o + px).toFixed(1)}px`).join(', ')})`;
  }

  function setP(t, px, py) {
    const { w, h } = t;
    const [x, y] = constrain(t, px, py);
    t.P = [x, y];
    const cy = t.top ? 0 : h;
    const dx = w - x, dy = cy - y, len = Math.hypot(dx, dy);
    if (len < 0.5) { // flat: nothing folded
      faceA.style.clipPath = 'none';
      faceB.style.visibility = 'hidden';
      under.style.visibility = 'hidden';
      return;
    }
    faceB.style.visibility = '';
    under.style.visibility = '';
    const nx = dx / len, ny = dy / len; // fold normal, pointing at the corner
    const mx = (w + x) / 2, my = (cy + y) / 2; // a point on the fold
    const rect = [[0, 0], [w, 0], [w, h], [0, h]];
    const keep = clipHalf(rect, nx, ny, mx, my, 1);
    const flap = clipHalf(rect, nx, ny, mx - nx * 0.6, my - ny * 0.6, -1); // overlaps the fold by a hair: no hairline gap
    faceA.style.clipPath = polygon(keep);
    // back = reflection across the fold ∘ mirror of the page (back-local u ↦ paper x = w − u)
    const a = 1 - 2 * nx * nx, b = -2 * nx * ny, d = 1 - 2 * ny * ny, k = 2 * (mx * nx + my * ny);
    faceB.style.transform = `matrix(${(-a).toFixed(5)},${(-b).toFixed(5)},${b.toFixed(5)},${d.toFixed(5)},${(a * w + k * nx).toFixed(2)},${(b * w + k * ny).toFixed(2)})`;
    faceB.style.clipPath = polygon(flap, w);
    under.style.clipPath = polygon(flap);

    // light: strongest mid-turn, gone when the sheet is flat on either side
    const depth = len / 2;
    const [ex, ey] = rest(t, 1);
    const s = Math.min(1, depth / 50, Math.hypot(x - ex, y - ey) / 70);
    const cw = Math.min(depth, w * 0.45) + 8;
    under.style.background = gradient(nx, ny, mx, my, w, h, [
      [0, `rgba(0,0,0,${(0.42 * s).toFixed(3)})`], [cw * 0.35, `rgba(0,0,0,${(0.16 * s).toFixed(3)})`], [cw, 'rgba(0,0,0,0)']]);
    shadeB.style.background = gradient(-nx, ny, w - mx, my, w, h, [
      [0, `rgba(0,0,0,${(0.2 * s).toFixed(3)})`], [cw * 0.12, `rgba(255,255,255,${(0.2 * s).toFixed(3)})`],
      [cw * 0.5, `rgba(255,255,255,${(0.05 * s).toFixed(3)})`], [cw * 1.4, `rgba(0,0,0,${(0.07 * s).toFixed(3)})`]]);
    shadeA.style.background = gradient(-nx, -ny, mx, my, w, h, [
      [0, `rgba(0,0,0,${(0.1 * s).toFixed(3)})`], [cw * 0.6, 'rgba(0,0,0,0)']]);
    // the notepad sheet fades as it leaves over the left edge
    leaf.style.opacity = t.spread ? '' : String(Math.max(0, Math.min(1, (x + w) / (w * 0.45))));
  }

  function finishTurn(t, done) {
    leaf.hidden = true;
    leaf.style.opacity = '';
    faceA.style.clipPath = '';
    faceB.style.clipPath = '';
    faceB.style.transform = '';
    if (done) idx = t.tv[0];
    busy = false;
    render();
    stage.classList.remove('is-turning');
    if (pending) { const a = pending; pending = null; a(); }
  }

  // cubic-bezier easing (x1, y1, x2, y2), as in CSS
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return (u) => {
      let s = u;
      for (let i = 0; i < 6; i++) {
        const fx = ((ax * s + bx) * s + cx) * s - u, dfx = (3 * ax * s + 2 * bx) * s + cx;
        if (Math.abs(fx) < 1e-5 || !dfx) break;
        s = Math.max(0, Math.min(1, s - fx / dfx));
      }
      return ((ay * s + by) * s + cy) * s;
    };
  }
  const turnEase = bezier(0.42, 0.0, 0.22, 1); // a soft lift, a quick sweep, a gentle landing
  const releaseEase = bezier(0.2, 0.7, 0.25, 1); // carries the hand's speed, then settles

  let anim = 0;
  // move the corner along path(k) for k in [0, 1]
  function animate(t, path, dur, ease, then) {
    cancelAnimationFrame(anim);
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      const [x, y] = path(ease(k));
      setP(t, x, y);
      if (k < 1) anim = requestAnimationFrame(step); else then();
    };
    anim = requestAnimationFrame(step);
  }
  // from wherever the corner is now to flat (done = false) or turned over (done = true)
  function settle(t, done) {
    const turned = t.fwd ? done : !done;
    const [x0, y0] = t.P, [x1, y1] = rest(t, turned ? 1 : 0);
    const dist = Math.hypot(x1 - x0, y1 - y0) / (2 * t.w);
    const lift = t.h * 0.08 * Math.min(1, dist * 2) * (t.top ? 1 : -1);
    animate(t, (k) => [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k + lift * Math.sin(Math.PI * k)],
      260 + 520 * Math.min(1, dist), releaseEase, () => finishTurn(t, done));
  }

  function turnTo(target) {
    const cur = spreadOf(idx), tv = spreadOf(target);
    if (tv[0] === cur[0]) { refresh(); return; }
    if (reduce.matches) { idx = tv[0]; render(); return; }
    busy = true;
    stage.classList.add('is-turning');
    refresh();
    const t = prepareTurn(idx, target);
    playFlip();
    animate(t, (k) => arc(t, t.fwd ? k : 1 - k), TURN_MS, turnEase, () => finishTurn(t, true));
  }

  function run(action) {
    if (peek && !drag) dropPeek();
    if (busy || drag) { pending = action; return; }
    action();
  }
  const nextTarget = () => { const v = spreadOf(idx); return v[v.length - 1] >= last ? null : v[v.length - 1] + 1; };
  const prevTarget = () => { const v = spreadOf(idx); return v[0] <= 0 ? null : spreadOf(v[0] - 1)[0]; };
  const next = () => run(() => { const n = nextTarget(); if (n != null) turnTo(n); });
  const prev = () => run(() => { const n = prevTarget(); if (n != null) turnTo(n); });
  function go(n, { focus = false } = {}) {
    if (focus) focusAfterTurn = spreadOf(n).includes(n) ? n : spreadOf(n)[0];
    run(() => { if (spreadOf(n)[0] === spreadOf(idx)[0]) refresh(); else turnTo(n); });
  }

  /* ---------- dragging and peeling ----------
     With a mouse the sheet's corner follows the pointer (eased a little each frame), so the page
     folds wherever the hand goes and stops where it stops. Hovering near a page corner lifts it
     (a peek); pressing there turns the peek into a drag. Touch uses a horizontal swipe, so
     vertical scrolling keeps working. */
  let drag = null;
  let peek = null; // { t, z, goal, raf, leaving }
  // pointer → leaf coordinates (origin at the top of the spine)
  function local(e) {
    const r = bookEl.getBoundingClientRect();
    if (spread) return { x: e.clientX - (r.left + r.width / 2), y: e.clientY - r.top, w: r.width / 2, h: r.height };
    // notepad: the sheet's width maps onto the corner's whole sweep, right edge to far left
    return { x: 2 * (e.clientX - r.left) - r.width, y: e.clientY - r.top, w: r.width, h: r.height };
  }
  function zone(e) {
    const { x, y, w, h } = local(e);
    if (y < 0 || y > h) return 0;
    const u = Math.abs(x) / w;
    if (u < 1 - EDGE || u > 1.02) return 0;
    return x > 0 ? 1 : -1; // 1: next (right edge), -1: previous (left edge)
  }
  const topHalf = (e) => { const { y, h } = local(e); return y < h / 2; };
  function startTurn(target, dir, top = false) {
    busy = true;
    stage.classList.add('is-turning');
    refresh();
    const t = prepareTurn(idx, target);
    t.dir = dir;
    if (top) { t.top = true; setP(t, ...rest(t, t.fwd ? 0 : 1)); }
    return t;
  }

  function peekLoop() {
    if (!peek) return;
    const [x, y] = peek.t.P, [gx, gy] = peek.goal;
    const nx = x + (gx - x) * 0.2, ny = y + (gy - y) * 0.2;
    setP(peek.t, nx, ny);
    if (peek.leaving && Math.hypot(gx - nx, gy - ny) < 0.4) { const t = peek.t; peek = null; finishTurn(t, false); return; }
    peek.raf = requestAnimationFrame(peekLoop);
  }
  function leavePeek() {
    if (!peek) return;
    peek.leaving = true;
    peek.goal = rest(peek.t, peek.z > 0 ? 0 : 1);
  }
  function dropPeek() {
    if (!peek) return;
    cancelAnimationFrame(peek.raf);
    const t = peek.t;
    peek = null;
    finishTurn(t, false);
  }
  function peekAt(e) {
    if (mode !== 'book' || drag || reduce.matches || e.pointerType !== 'mouse') return;
    const z = zone(e);
    const top = z ? topHalf(e) : false;
    if (peek && (!z || peek.z !== z || peek.t.top !== top)) { leavePeek(); return; }
    const target = z > 0 ? nextTarget() : z < 0 ? prevTarget() : null;
    if (!z || target == null) return;
    if (!peek) {
      if (busy) return;
      peek = { t: startTurn(target, z > 0 ? -1 : 1, top), z, goal: null, leaving: false };
      peek.raf = requestAnimationFrame(peekLoop);
    }
    peek.leaving = false;
    // the corner lifts toward the pointer, by a small amount
    const t = peek.t;
    const [cx, cy] = rest(t, z > 0 ? 0 : 1);
    const { x, y } = local(e);
    let vx = (x - cx) * 0.45, vy = (y - cy) * 0.45;
    vx = z > 0 ? Math.min(vx, -54) : Math.max(vx, 54);
    vy = top ? Math.max(vy, 36) : Math.min(vy, -36);
    const m = Math.min(1, (t.w * 0.16) / Math.hypot(vx, vy));
    peek.goal = [cx + vx * m, cy + vy * m];
  }

  function follow() {
    if (!drag?.started) return;
    const [x, y] = drag.t.P, [gx, gy] = drag.goal;
    setP(drag.t, x + (gx - x) * 0.32, y + (gy - y) * 0.32);
    drag.raf = requestAnimationFrame(follow);
  }
  function beginDrag(e, t, extra) {
    drag = { id: e.pointerId, started: true, t, x0: e.clientX, y0: e.clientY, goal: t.P.slice(), ...extra };
    drag.raf = requestAnimationFrame(follow);
    playFlip();
    try { bookEl.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
  }

  function onDown(e) {
    if (mode !== 'book' || e.button > 0) return;
    if (e.target.closest('a, button, input, pre, select, textarea')) return;
    if (e.pointerType === 'mouse') {
      const z = zone(e);
      if (!z) return;
      e.preventDefault();
      if (peek && peek.z === z && peek.t.top === topHalf(e)) {
        cancelAnimationFrame(peek.raf);
        const t = peek.t;
        peek = null;
        beginDrag(e, t, { mouse: true });
        onMove(e);
        return;
      }
      dropPeek();
      if (busy) return;
      const target = z > 0 ? nextTarget() : prevTarget();
      if (target == null || reduce.matches) return;
      beginDrag(e, startTurn(target, z > 0 ? -1 : 1, topHalf(e)), { mouse: true });
      onMove(e);
      return;
    }
    if (busy) return;
    const r = bookEl.getBoundingClientRect();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, w: spread ? r.width / 2 : r.width, started: false, t: null };
  }
  function onMove(e) {
    if (!drag) { peekAt(e); return; }
    if (e.pointerId !== drag.id) return;
    if (drag.mouse) {
      const { x, y } = local(e);
      drag.goal = [x, y];
      drag.vx = e.movementX || 0;
      drag.lastT = performance.now();
      return;
    }
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.started) {
      if (Math.abs(dx) < 12) {
        if (Math.abs(dy) > 12) drag = null; // vertical: let the page scroll
        return;
      }
      if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      const target = dx < 0 ? nextTarget() : prevTarget();
      if (target == null || reduce.matches) {
        if (reduce.matches && target != null) drag.reduced = target; else { drag = null; return; }
      } else {
        const { w, x0, y0 } = drag;
        beginDrag(e, startTurn(target, dx < 0 ? -1 : 1), { w, x0, y0 });
      }
    }
    if (drag?.started) {
      const p = Math.max(0, Math.min(1, Math.abs(dx) / (drag.w * (spread ? 2 : 1.2))));
      drag.goal = arc(drag.t, drag.t.fwd ? p : 1 - p);
      drag.lastX = e.clientX;
      drag.lastT = performance.now();
    }
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    cancelAnimationFrame(d.raf);
    if (d.reduced != null && Math.abs(e.clientX - d.x0) > 50) { idx = spreadOf(d.reduced)[0]; render(); return; }
    if (!d.started) { if (pending) { const a = pending; pending = null; a(); } return; }
    const a = aOf(d.t, d.goal[0]);
    const p = d.t.fwd ? a : 1 - a;
    const moving = d.lastT && performance.now() - d.lastT < 80;
    const flickToward = moving && Math.abs(d.vx || 0) > 6 && ((d.t.dir < 0 && d.vx < 0) || (d.t.dir > 0 && d.vx > 0));
    const complete = p > 0.5 || flickToward || (!d.mouse && (p > 0.33 || (moving && Math.abs(e.clientX - d.x0) > 40)));
    settle(d.t, complete);
  }
  function onCancel(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    cancelAnimationFrame(d.raf);
    if (d.started) settle(d.t, false);
  }
  bookEl.addEventListener('pointerleave', () => { if (!drag) leavePeek(); });
  bookEl.addEventListener('pointerdown', onDown);
  // a native image/text drag would cancel the pointer stream (Firefox does this)
  bookEl.addEventListener('dragstart', (e) => { if (drag) e.preventDefault(); });
  bookEl.addEventListener('pointermove', onMove);
  bookEl.addEventListener('pointerup', onUp);
  bookEl.addEventListener('pointercancel', onCancel);
  bookEl.addEventListener('lostpointercapture', onCancel);

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  shell.addEventListener('keydown', (e) => {
    if (mode !== 'book' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"], [role="tablist"], pre')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === 'Home' && e.target === stage) { e.preventDefault(); go(0); }
    else if (e.key === 'End' && e.target === stage) { e.preventDefault(); go(last); }
  });

  /* ---------- views ---------- */
  function toBook() {
    if (mode === 'book') return;
    mode = 'book';
    setViewButtons();
    section.classList.add('is-book');
    buildPages();
    reading.hidden = true;
    [tabsNav, stage, controls].forEach((n) => { n.hidden = false; });
    bookEl.textContent = '';
    bookEl.append(slotL, slotR);
    pages.forEach((p) => { p.hidden = true; slotR.append(p); });
    leaf.hidden = true;
    measure();
    render();
    shell.dataset.engine = reduce.matches ? 'instant' : 'leaf';
    requestAnimationFrame(() => window.ScrollTrigger?.refresh());
  }

  function toReading({ focus = false } = {}) {
    cancelAnimationFrame(anim);
    if (peek) { cancelAnimationFrame(peek.raf); peek = null; }
    if (drag) cancelAnimationFrame(drag.raf);
    pending = null;
    busy = false;
    drag = null;
    bookEl.textContent = '';
    restore();
    pages = [];
    mode = 'reading';
    setViewButtons();
    section.classList.remove('is-book');
    reading.hidden = false;
    [tabsNav, stage, controls].forEach((n) => { n.hidden = true; });
    if (focus) reading.querySelector('h3')?.focus?.();
    requestAnimationFrame(() => window.ScrollTrigger?.refresh());
  }

  function setViewButtons() {
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === mode)));
  }
  viewBtns.forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.view === 'book') toBook(); else toReading();
  }));

  // Re-measure when the stage changes size, when fonts arrive and when images load.
  const relayout = () => {
    if (mode !== 'book' || busy) return;
    const wasSpread = spread;
    measure();
    if (wasSpread !== spread) idx = spreadOf(idx)[0];
    render();
  };
  let resizeT = 0;
  new ResizeObserver(() => { clearTimeout(resizeT); resizeT = setTimeout(relayout, 120); }).observe(stage);
  document.fonts?.ready.then(relayout);
  reading.querySelectorAll('img').forEach((img) => { if (!img.complete) img.addEventListener('load', relayout, { once: true }); });
  reduce.addEventListener('change', () => { shell.dataset.engine = reduce.matches ? 'instant' : 'leaf'; });

  // Links to an experiment (#xp-...) open the right page instead of a hidden article.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-xp-link], a[href^="#xp-"]');
    if (!a || mode !== 'book') return;
    const id = a.dataset.xpLink || a.getAttribute('href').slice(4);
    const i = articles.findIndex((x) => x.dataset.xp === id);
    if (i < 0) return;
    e.preventDefault();
    section.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
    go(pageOfXp(i), { focus: true });
    history.replaceState(null, '', `#xp-${id}`);
  });

  buildTabs();
  shell.hidden = false;
  if (viewGroup) viewGroup.hidden = false;
  toBook();
  const m = location.hash.match(/^#xp-(.+)$/);
  const i = m ? articles.findIndex((x) => x.dataset.xp === m[1]) : -1;
  if (i >= 0) { idx = spreadOf(pageOfXp(i))[0]; render(); }

  // test hook (read-only state)
  shell.notebook = { state: () => ({ idx, spread, busy, visible: spreadOf(idx), mode }), next, prev, go };
}
