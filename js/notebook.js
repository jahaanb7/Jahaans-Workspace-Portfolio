// notebook.js: the scratchbook of smaller experiments.
//
// The page ships a plain reading view: one <article> per experiment, generated from
// data/experiments.json. This module turns the same nodes into a book. It moves (never
// copies) each article's two halves onto two pages, so there is only one copy of the
// content in the document; switching to the reading view puts every node back.
//
// One landscape spread per experiment: words on the left page, the taped figure on the right.
// The page turn is this file's own leaf engine; its timing is a Motion (motion.dev) spring
// when the vendored library is available, and a cubic ease when it is not:
//   wide stage (>= SPREAD_MIN)  two-page spreads; a leaf lifts, bends and turns about the spine
//   narrow stage                a landscape notepad; the sheet turns over its left edge
//   reduced motion              pages change instantly, every control stays
// A short page-flip sound (Kenney, CC0) plays on each turn; the speaker button mutes it.
// The leaf can be dragged: from a page corner with a mouse, or with a horizontal swipe on
// touch. Vertical scrolling and text selection keep working (touch-action: pan-y, and mouse
// drags only start in the corners). Pages that are not visible are inert.

const TURN_MS = 1500; // fallback turn length when Motion is unavailable
const STRIPS = 22; // the turning leaf is drawn as a chain of hinged strips, so it can curl
const CURL = 70; // degrees of bend at the middle of a turn, spread toward the free edge
const SPREAD_MIN = 820; // stage width (px) from which two-page spreads are shown
const EDGE = 0.34; // a mouse drag can start in the outer third of either page

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

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

  /* ---------- Motion (motion.dev), loaded on demand ---------- */
  let motion = window.Motion || null;
  if (!motion) {
    const sc = document.createElement('script');
    sc.src = new URL('../assets/vendor/motion-11.11.17.js', import.meta.url).href;
    sc.onload = () => { motion = window.Motion || null; };
    document.head.append(sc);
  }

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
  const shade = el('div', 'nb-shade');

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

  /* ---------- the turn ---------- */
  // A turn is described by the pages under the leaf and on its two faces, and by the
  // direction. setProgress(p) poses the leaf for p in [0, 1].
  function prepareTurn(from, to) {
    const fv = spreadOf(from), tv = spreadOf(to);
    const fwd = tv[0] > fv[0];
    const t = { fwd, tv, spread };
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
      bookEl.classList.toggle('is-closed', false);
      bookEl.classList.toggle('is-closed-back', false);
      faceA.classList.toggle('is-empty', !faceA.firstChild);
      faceB.classList.toggle('is-empty', !faceB.firstChild);
    } else {
      // pad: the current sheet lifts up and away (forward), or the previous one comes down
      show(fwd ? tv[0] : fv[0], slotR);
      show(fwd ? fv[0] : tv[0], faceA);
      faceB.classList.add('is-empty');
      faceA.classList.remove('is-empty');
    }
    leaf.className = `nb-leaf ${spread ? 'is-spine' : 'is-side'}`;
    bookEl.append(leaf, shade);
    leaf.hidden = false;
    shade.hidden = false;
    buildStrips(t);
    return t;
  }

  /* ---------- the curling leaf ----------
     The real page nodes sit (hidden) on faceA/faceB. For the turn, each strip shows a slice of a
     copy of the front page and, on its back, the matching slice of the back page. Each strip
     hinges on the far edge of the one before it: small extra angles add up to a smooth curl.
     Strips are siblings placed in 3D by this code (WebKit flattens deep nested 3D chains), and
     each is shaded, and shows its front or back, by its own angle to the viewer. */
  const curlEl = el('div', 'nb-curl');
  let strips = [];
  function sliceOf(src, offset, w, h) {
    const box = el('div', 'nb-slice-in');
    box.style.cssText = `width:${w}px;height:${h}px;transform:translateX(${-offset}px)`;
    if (src.firstChild) {
      const c = src.firstChild.cloneNode(true);
      c.hidden = false;
      c.removeAttribute('id');
      c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      box.append(c);
    }
    return box;
  }
  function buildStrips(t) {
    const w = leaf.offsetWidth || bookEl.offsetWidth / (spread ? 2 : 1);
    const h = bookEl.offsetHeight;
    const sw = w / STRIPS;
    curlEl.textContent = '';
    strips = [];
    curlEl.dataset.sw = String(sw);
    for (let k = 0; k < STRIPS; k++) {
      const s = el('div', 'nb-strip');
      s.style.cssText = `width:${sw + 0.8}px;left:0`;
      const front = el('div', `nb-sface nb-sface-f${faceA.classList.contains('is-empty') ? ' is-empty' : ''}`);
      const back = el('div', `nb-sface nb-sface-b${faceB.classList.contains('is-empty') ? ' is-empty' : ''}`);
      front.append(sliceOf(faceA, k * sw, w, h));
      back.append(sliceOf(faceB, w - (k + 1) * sw, w, h));
      s.append(front, back);
      s._f = front; s._b = back;
      curlEl.append(s);
      strips.push(s);
    }
    leaf.append(curlEl);
    leaf.classList.add('is-curling');
  }
  function poseStrips(a, dir, z0 = 0) {
    // dir -1: the free edge leads toward the left (turning forward); +1: toward the right
    const bend = CURL * Math.sin(Math.PI * Math.min(1, Math.max(0, a)));
    let total = 0;
    const weights = strips.map((_, k) => (k === 0 ? 0 : (k / STRIPS) ** 1.6));
    const sum = weights.reduce((x, y) => x + y, 0) || 1;
    const root = -180 * a - dir * bend * 0.5;
    const sw = Number(curlEl.dataset.sw) || 1;
    let hx = 0, hz = z0; // hinge of the current strip, in the leaf's 3D space
    strips.forEach((s, k) => {
      const d = k === 0 ? root : dir * bend * (weights[k] / sum);
      total += d;
      s.style.transform = `translate3d(${hx.toFixed(2)}px,0,${hz.toFixed(2)}px) rotateY(${total.toFixed(2)}deg)`;
      const rad = (total * Math.PI) / 180;
      hx += sw * Math.cos(rad);
      hz -= sw * Math.sin(rad);
      // light falls off as a strip turns away from the viewer, on either face
      const c = Math.cos((total * Math.PI) / 180);
      s.style.setProperty('--sh', (1 - Math.abs(c)).toFixed(3));
      // pick the visible face from the strip's own angle (WebKit ignores nested backface-visibility)
      const front = c >= 0;
      if (s._front !== front) { s._front = front; s._f.style.visibility = front ? '' : 'hidden'; s._b.style.visibility = front ? 'hidden' : ''; }
    });
  }
  function pose(t, p) {
    // p = 0 at the start of the turn, 1 at the end
    const a = t.fwd ? p : 1 - p; // 0: leaf flat on the right (or on the pad); 1: turned over
    // the sheet lifts off the book as it turns, flexes a little, and settles
    const lift = Math.sin(Math.PI * Math.min(1, Math.max(0, a)));
    const flex = (t.fwd ? 1 : -1) * lift * 7;
    void flex;
    poseStrips(t.spread ? a : a * 0.96, t.dir ?? (t.fwd ? -1 : 1), lift * lift * (t.spread ? 24 : 16));
    leaf.style.setProperty('--a', a.toFixed(3));
    leaf.style.setProperty('--lift', lift.toFixed(3));
    bookEl.style.setProperty('--a', a.toFixed(3));
    bookEl.style.setProperty('--lift', lift.toFixed(3));
    if (!t.spread) leaf.style.opacity = a > 0.86 ? String(Math.max(0, (1 - a) / 0.14)) : '1';
  }
  function finishTurn(t, done) {
    leaf.classList.remove('is-curling');
    curlEl.remove();
    strips = [];
    leaf.hidden = true;
    shade.hidden = true;
    leaf.style.transform = '';
    leaf.style.opacity = '';
    if (done) idx = t.tv[0];
    busy = false;
    render();
    stage.classList.remove('is-turning');
    if (pending) { const a = pending; pending = null; a(); }
  }
  function animate(t, p0, p1, then) {
    // Motion spring: a quick lift, a soft landing and a tiny settle past flat
    if (motion?.animate) {
      let done = false;
      const finish = () => { if (done) return; done = true; pose(t, p1); then(); };
      try {
        motion.animate(p0, p1, {
          type: 'spring', stiffness: 30, damping: 11, mass: 1.2, restDelta: 0.002,
          velocity: (p1 - p0) * 0.6,
          onUpdate: (v) => pose(t, Math.max(-0.02, Math.min(1.02, v))),
          onComplete: finish,
        });
        setTimeout(finish, TURN_MS * 2.4); // never leave a turn hanging
        return;
      } catch { /* fall through to the built-in ease */ }
    }
    const dur = TURN_MS * Math.max(0.25, Math.abs(p1 - p0));
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      pose(t, p0 + (p1 - p0) * ease(k));
      if (k < 1) requestAnimationFrame(step); else then();
    };
    requestAnimationFrame(step);
  }

  function turnTo(target) {
    const cur = spreadOf(idx), tv = spreadOf(target);
    if (tv[0] === cur[0]) { refresh(); return; }
    if (reduce.matches) { idx = tv[0]; render(); return; }
    busy = true;
    stage.classList.add('is-turning');
    refresh();
    const t = prepareTurn(idx, target);
    pose(t, 0);
    playFlip();
    animate(t, 0, 1, () => finishTurn(t, true));
  }

  function run(action) {
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
     With a mouse the leaf's free edge stays under the pointer: its angle comes from the pointer's
     distance to the spine, so the page stops wherever the mouse stops. Hovering near an outer
     edge lifts the corner a little (a peek); pressing there turns the peek into a drag.
     Touch uses a horizontal swipe, so vertical scrolling keeps working. */
  let drag = null;
  let peek = null; // { t, cur, goal, raf, leaving }
  function geo(clientX) {
    const r = bookEl.getBoundingClientRect();
    if (spread) {
      const w = r.width / 2;
      return { X: clientX - (r.left + w), w, r };
    }
    return { X: clientX - r.left, w: r.width, r };
  }
  // leaf state a (0 flat on the right, 1 turned over) that puts the free edge under the pointer
  function aAt(clientX) {
    const { X, w } = geo(clientX);
    const u = spread ? X / w : 2 * X / w - 1;
    return Math.acos(Math.max(-1, Math.min(1, u))) / Math.PI;
  }
  function zone(e) {
    const { X, w, r } = geo(e.clientX);
    if (e.clientY < r.top || e.clientY > r.bottom) return 0;
    const edge = spread ? Math.abs(X) / w : Math.abs(2 * X / w - 1);
    if (edge < 1 - EDGE || edge > 1.02) return 0;
    return (spread ? X : X - w / 2) > 0 ? 1 : -1; // 1: next (right edge), -1: previous (left edge)
  }
  function startTurn(target, dir) {
    busy = true;
    stage.classList.add('is-turning');
    refresh();
    const t = prepareTurn(idx, target);
    t.dir = dir;
    return t;
  }
  function peekLoop() {
    if (!peek) return;
    peek.cur += (peek.goal - peek.cur) * 0.18;
    pose(peek.t, peek.cur);
    if (peek.leaving && peek.cur < 0.004) { const t = peek.t; peek = null; finishTurn(t, false); return; }
    peek.raf = requestAnimationFrame(peekLoop);
  }
  function peekAt(e) {
    if (mode !== 'book' || drag || reduce.matches || e.pointerType !== 'mouse') return;
    const z = zone(e);
    const target = z > 0 ? nextTarget() : z < 0 ? prevTarget() : null;
    if (peek && (!z || (peek.z !== z))) { peek.leaving = true; peek.goal = 0; return; }
    if (!z || target == null) return;
    if (!peek) {
      if (busy) return;
      peek = { t: startTurn(target, z > 0 ? -1 : 1), z, cur: 0, goal: 0, leaving: false };
      peek.raf = requestAnimationFrame(peekLoop);
    }
    peek.leaving = false;
    const a = aAt(e.clientX);
    const p = peek.t.fwd ? a : 1 - a;
    peek.goal = Math.min(0.085, Math.max(0.015, p));
  }

  function onDown(e) {
    if (mode !== 'book' || e.button > 0) return;
    if (e.target.closest('a, button, input, pre, select, textarea')) return;
    if (e.pointerType === 'mouse') {
      const z = zone(e);
      if (!z) return;
      e.preventDefault();
      if (peek) {
        cancelAnimationFrame(peek.raf);
        const t = peek.t;
        drag = { id: e.pointerId, mouse: true, started: true, t, p: peek.cur, x0: e.clientX, y0: e.clientY };
        peek = null;
        playFlip();
        try { bookEl.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
        return;
      }
      if (busy) return;
      const target = z > 0 ? nextTarget() : prevTarget();
      if (target == null || reduce.matches) return;
      const t = startTurn(target, z > 0 ? -1 : 1);
      drag = { id: e.pointerId, mouse: true, started: true, t, p: 0, x0: e.clientX, y0: e.clientY };
      playFlip();
      try { bookEl.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      onMove(e);
      return;
    }
    if (busy) return;
    const r = bookEl.getBoundingClientRect();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, w: spread ? r.width / 2 : r.width, started: false, t: null, p: 0, type: e.pointerType };
  }
  function onMove(e) {
    if (!drag) { peekAt(e); return; }
    if (e.pointerId !== drag.id) return;
    if (drag.mouse) {
      const a = aAt(e.clientX);
      drag.p = Math.max(0, Math.min(1, drag.t.fwd ? a : 1 - a));
      drag.lastX = e.clientX;
      drag.lastT = performance.now();
      drag.vx = e.movementX || 0;
      pose(drag.t, drag.p);
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
        drag.started = true;
        drag.t = startTurn(target, dx < 0 ? -1 : 1);
        playFlip();
        try { bookEl.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      }
    }
    if (drag?.started) {
      drag.p = Math.max(0, Math.min(1, Math.abs(dx) / (drag.w * (spread ? 2 : 1.2))));
      drag.lastX = e.clientX;
      drag.lastT = performance.now();
      pose(drag.t, drag.p);
    }
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.reduced != null && Math.abs(e.clientX - d.x0) > 50) { idx = spreadOf(d.reduced)[0]; render(); return; }
    if (!d.started) { if (pending) { const a = pending; pending = null; a(); } return; }
    const moving = d.lastT && performance.now() - d.lastT < 80;
    const flickToward = moving && Math.abs(e.clientX - (d.lastX ?? e.clientX)) >= 0 && Math.abs(d.vx || 0) > 6
      && ((d.t.dir < 0 && d.vx < 0) || (d.t.dir > 0 && d.vx > 0));
    const complete = d.p > 0.5 || flickToward || (!d.mouse && (d.p > 0.33 || (moving && Math.abs(e.clientX - d.x0) > 40)));
    animate(d.t, d.p, complete ? 1 : 0, () => finishTurn(d.t, complete));
  }
  function onCancel(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.started) animate(d.t, d.p, 0, () => finishTurn(d.t, false));
  }
  bookEl.addEventListener('pointerleave', (e) => { if (peek && !drag) peekAt({ ...e, clientX: -1e6, clientY: -1e6, pointerType: 'mouse' }); });
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
    shade.hidden = true;
    measure();
    render();
    shell.dataset.engine = reduce.matches ? 'instant' : 'leaf';
    requestAnimationFrame(() => window.ScrollTrigger?.refresh());
  }

  function toReading({ focus = false } = {}) {
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
