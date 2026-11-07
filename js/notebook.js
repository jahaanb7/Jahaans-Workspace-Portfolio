// notebook.js: the scratchbook of smaller experiments.
//
// The page ships a plain reading view: one <article> per experiment, generated from
// data/experiments.json. This module turns the same nodes into a book. It moves (never
// copies) each article's two halves onto two pages, so there is only one copy of the
// content in the document; switching to the reading view puts every node back.
//
// One landscape spread per experiment: words on the left page, the taped figure on the right.
// The page turn is this file's own leaf engine: the sheet stays hinged at its binding and bends
// as it turns, drawn as a chain of thin 3D strips that carry inert copies of the two pages:
//   wide stage (>= SPREAD_MIN)  two-page spreads; the right leaf turns over the spine, bending as it goes
//   narrow stage                a notepad bound at the top; the sheet flips up over the binding
//   reduced motion              pages change instantly, every control stays
// A short page-flip sound (Kenney, CC0) plays on each turn; the speaker button mutes it.
// The leaf can be dragged: from a page's outer edge with a mouse (the bottom of the notepad),
// or with a horizontal swipe on touch. Vertical scrolling and text selection keep working
// (touch-action: pan-y, and mouse drags only start near the edges). Pages that are not visible are inert.

const TURN_MS = 1350; // length of a turn started by a button, key or tab
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
    bookEl.style.perspective = `${pageW * 7}px`; // in px: Safari ignores calc() here
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
  leaf.setAttribute('aria-hidden', 'true');
  const slotL = el('div', 'nb-slot nb-slot-l');
  const slotR = el('div', 'nb-slot nb-slot-r');
  const castL = el('div', 'nb-cast nb-cast-l'); // shadow the lifted sheet throws on the page beneath
  const castR = el('div', 'nb-cast nb-cast-r');

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
     left page of the next spread. A backward turn is the same leaf laid back down.
     The sheet is hinged at the spine and bends like paper: it is cut into narrow vertical strips
     that are chained edge to edge in 3D (the book has perspective), so it can never come away
     from the spine. Each strip carries a slice of the front and back page (inert copies, the real
     pages stay where they are) and its own shading, so the curl reads as light, not as facets.
     Progress p runs from 0 (flat on the right) to 1 (flat on the left). Early in a turn the free
     edge leads and the spine side follows; late in a turn the spine side lands first and the free
     edge floats down after it. Coordinates: origin at the top of the spine (or the pad's left
     edge), x toward the outer edge, z toward the viewer. */
  const STRIPS = 22;
  const PAD_END = 0.52; // how far a notepad sheet turns before it has gone over the top
  const LEAD = 0.15; // how far the free edge leads (then trails) the spine side, as a share of a turn
  const PI = Math.PI;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function inertCopy(n, w) {
    const c = pages[n].cloneNode(true);
    c.hidden = false;
    c.removeAttribute('aria-hidden');
    c.style.cssText = '';
    c.querySelectorAll('a, button, [tabindex]').forEach((x) => x.setAttribute('tabindex', '-1'));
    return c;
  }

  function prepareTurn(from, to) {
    const fv = spreadOf(from), tv = spreadOf(to);
    const fwd = tv[0] > fv[0];
    pages.forEach((p) => { p.hidden = true; });
    slotL.textContent = '';
    slotR.textContent = '';
    const show = (n, into) => { if (n == null) return; pages[n].hidden = false; into.append(pages[n]); };
    let front = null, back = null;
    if (spread) {
      if (fwd) { show(leftOf(fv), slotL); show(rightOf(tv), slotR); front = rightOf(fv); back = leftOf(tv); }
      else { show(leftOf(tv), slotL); show(rightOf(fv), slotR); front = rightOf(tv); back = leftOf(fv); }
    } else {
      // pad: the current sheet lifts away over its left edge (forward), or the previous one comes back
      show(fwd ? tv[0] : fv[0], slotR);
      front = fwd ? fv[0] : tv[0];
    }
    leaf.className = `nb-leaf ${spread ? 'is-spine' : 'is-side'}`;
    leaf.textContent = '';
    leaf.style.opacity = '';
    bookEl.append(castL, castR, leaf);
    leaf.hidden = false;
    castL.hidden = !spread;
    castR.hidden = false;
    const w = leaf.offsetWidth, h = leaf.offsetHeight;
    // spreads bend across the width (vertical strips); the notepad flips over its top edge (horizontal strips)
    const len = spread ? w : h;
    const sw = len / STRIPS;
    const frontCopy = front != null ? inertCopy(front, w) : null;
    const backCopy = back != null ? inertCopy(back, w) : null;
    const strips = [];
    for (let i = 0; i < STRIPS; i++) {
      const wid = i === STRIPS - 1 ? sw : sw + 1.5; // a hair of overlap: no cracks at the joints
      const st = el('div', 'nb-strip');
      if (spread) st.style.width = `${wid}px`; else st.style.height = `${wid}px`;
      const mk = (copy, cls, offset) => {
        const face = el('div', `nb-sface ${cls}`);
        if (copy) {
          const c = el('div', 'nb-scontent');
          if (spread) { c.style.left = `${offset}px`; c.style.width = `${w}px`; }
          else { c.style.top = `${offset}px`; c.style.height = `${h}px`; }
          c.append(i === 0 ? copy : copy.cloneNode(true));
          face.append(c);
        } else face.classList.add('is-empty');
        const shade = el('div', 'nb-shade');
        face.append(shade);
        st.append(face);
        return [face, shade];
      };
      const [fFace, fShade] = mk(frontCopy, 'nb-face-front', -i * sw);
      const [bFace, bShade] = mk(spread ? backCopy : null, 'nb-face-back nb-sback', -(w - i * sw - wid));
      leaf.append(st);
      strips.push({ st, fFace, bFace, fShade, bShade, up: null });
    }
    const end = spread ? 1 : PAD_END; // a notepad sheet is gone once it is over the binding
    const t = { fwd, tv, spread, w, h, len, sw, strips, end, p: fwd ? 0 : end };
    setP(t, t.p);
    return t;
  }

  // angle of the sheet at the spine and at the free edge, for progress p
  function edgeAngles(p) {
    const s = LEAD * Math.sin(2 * PI * p);
    return [PI * (p - s), PI * (p + s)];
  }
  // brightness of a face turned by phi: full when it faces the reader, darker as it tilts away
  const shadeOf = (phi) => {
    const c = Math.abs(Math.cos(phi));
    return 0.42 * (1 - c) * (1 - c * 0.35);
  };

  function setP(t, p) {
    t.p = p = clamp01(p);
    const { len, sw, strips } = t;
    const w = len;
    const [as, at] = edgeAngles(p);
    const phis = strips.map((_, i) => {
      const u = (i + 0.5) / STRIPS;
      return Math.max(0, Math.min(PI, as + (at - as) * u ** 1.6));
    });
    let x = 0, z = 0, minX = 0, maxX = 0;
    const flat = p <= 0.0005 || p >= 0.9995;
    strips.forEach((s, i) => {
      const phi = phis[i];
      s.st.style.transform = t.spread
        ? `translate3d(${x.toFixed(2)}px,0,${z.toFixed(2)}px) rotateY(${(-phi).toFixed(4)}rad)`
        : `translate3d(0,${x.toFixed(2)}px,${z.toFixed(2)}px) rotateX(${phi.toFixed(4)}rad)`;
      // which side of the strip faces the reader (chosen here, not by backface-visibility,
      // which Safari gets wrong inside nested 3D)
      const up = phi <= PI / 2;
      if (up !== s.up) {
        s.up = up;
        s.fFace.style.visibility = up ? '' : 'hidden';
        s.bFace.style.visibility = up ? 'hidden' : '';
      }
      // shade across the strip, from the joint on its spine side to the joint on its outer side
      const a0 = i ? (phis[i - 1] + phi) / 2 : phi;
      const a1 = i < STRIPS - 1 ? (phis[i + 1] + phi) / 2 : phi;
      const d0 = flat ? 0 : shadeOf(a0), d1 = flat ? 0 : shadeOf(a1);
      const dir = t.spread ? '90deg' : '180deg';
      s.fShade.style.background = `linear-gradient(${dir}, rgba(20,18,14,${d0.toFixed(3)}), rgba(20,18,14,${d1.toFixed(3)}))`;
      s.bShade.style.background = `linear-gradient(${dir}, rgba(20,18,14,${d1.toFixed(3)}), rgba(20,18,14,${d0.toFixed(3)}))`;
      x += sw * Math.cos(phi);
      z += sw * Math.sin(phi);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    });

    // the shadow the raised sheet casts on the page it is uncovering (right) or about to cover (left)
    const lift = flat ? 0 : Math.sqrt(Math.sin(PI * p));
    const gapR = w - maxX, gapL = minX + w;
    const fade = t.spread ? 1 : clamp01((PAD_END - p) / 0.14);
    const aR = 0.34 * lift * fade * clamp01(gapR / 50), aL = 0.34 * lift * clamp01(gapL / 50);
    const spreadR = 24 + gapR * 0.35, spreadL = 24 + gapL * 0.35;
    if (t.spread) {
      castR.style.background = `linear-gradient(90deg, transparent ${maxX.toFixed(1)}px, rgba(0,0,0,${aR.toFixed(3)}) ${maxX.toFixed(1)}px, rgba(0,0,0,0) ${(maxX + spreadR).toFixed(1)}px)`;
      castL.style.background = `linear-gradient(270deg, transparent ${(-minX).toFixed(1)}px, rgba(0,0,0,${aL.toFixed(3)}) ${(-minX).toFixed(1)}px, rgba(0,0,0,0) ${(-minX + spreadL).toFixed(1)}px)`;
    } else {
      castR.style.background = `linear-gradient(180deg, transparent ${maxX.toFixed(1)}px, rgba(0,0,0,${aR.toFixed(3)}) ${maxX.toFixed(1)}px, rgba(0,0,0,0) ${(maxX + spreadR).toFixed(1)}px)`;
      // the notepad sheet fades as it goes over the top of the pad, where the next sheet would hide it
      leaf.style.opacity = String(fade);
    }
  }

  function finishTurn(t, done) {
    leaf.hidden = true;
    leaf.textContent = '';
    leaf.style.opacity = '';
    castL.hidden = true;
    castR.hidden = true;
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
  const turnEase = bezier(0.45, 0.05, 0.25, 1); // an unhurried lift, a smooth sweep, a soft landing
  const releaseEase = bezier(0.22, 0.6, 0.3, 1); // carries the hand's speed, then settles

  let anim = 0;
  function animate(t, p1, dur, ease, then) {
    cancelAnimationFrame(anim);
    const p0 = t.p, start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      setP(t, p0 + (p1 - p0) * ease(k));
      if (k < 1) anim = requestAnimationFrame(step); else then();
    };
    anim = requestAnimationFrame(step);
  }
  // from wherever the sheet is now to where it started (done = false) or turned over (done = true)
  function settle(t, done) {
    const goal = t.fwd === done ? t.end : 0;
    const dist = Math.abs(goal - t.p);
    animate(t, goal, 320 + 820 * dist / t.end, releaseEase, () => finishTurn(t, done));
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
    animate(t, t.fwd ? t.end : 0, spread ? TURN_MS : TURN_MS * 0.7, turnEase, () => finishTurn(t, true));
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
     With a mouse the sheet follows the pointer (eased a little each frame), so it lifts as far as
     the hand goes and stops where it stops. Hovering near a page's outer edge lifts it slightly
     (a peek); pressing there turns the peek into a drag. Touch uses a horizontal swipe, so
     vertical scrolling keeps working. */
  let drag = null;
  let peek = null; // { t, z, goal, raf, leaving }
  // pointer → book coordinates: x from the spine (spread) or from the pad's left edge
  function local(e) {
    const r = bookEl.getBoundingClientRect();
    if (spread) return { x: e.clientX - (r.left + r.width / 2), y: e.clientY - r.top, w: r.width / 2, h: r.height };
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }
  function zone(e) {
    const { x, y, w, h } = local(e);
    if (y < 0 || y > h) return 0;
    if (!spread) { // notepad: lift the bottom of the sheet to turn on, the top to bring the last one back
      if (x < 0 || x > w) return 0;
      return y > h * (1 - EDGE * 0.8) ? 1 : y < h * 0.16 ? -1 : 0;
    }
    const u = Math.abs(x) / w;
    if (u < 1 - EDGE || u > 1.02) return 0;
    return x > 0 ? 1 : -1; // 1: next (right edge), -1: previous (left edge)
  }
  // progress of a sheet held at pointer x: 0 at the right page's outer edge, 1 at the left page's
  const progressAt = ({ x, y, w, h }) => (spread ? clamp01((w - x) / (2 * w)) : clamp01((h - y) / h) * PAD_END * 1.2);
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
    const p = peek.t.p, g = peek.goal;
    const np = p + (g - p) * 0.14;
    setP(peek.t, np);
    if (peek.leaving && Math.abs(g - np) < 0.0008) { const t = peek.t; peek = null; finishTurn(t, false); return; }
    peek.raf = requestAnimationFrame(peekLoop);
  }
  function leavePeek() {
    if (!peek) return;
    peek.leaving = true;
    peek.goal = peek.t.fwd ? 0 : peek.t.end;
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
    if (peek && (!z || peek.z !== z)) { leavePeek(); return; }
    const target = z > 0 ? nextTarget() : z < 0 ? prevTarget() : null;
    if (!z || target == null) return;
    if (!peek) {
      if (busy) return;
      peek = { t: startTurn(target, z > 0 ? -1 : 1), z, goal: 0, leaving: false };
      peek.raf = requestAnimationFrame(peekLoop);
    }
    peek.leaving = false;
    // the closer to the edge, the more the sheet lifts, but only ever a little
    const { x, y, w, h } = local(e);
    const edge = spread ? Math.abs(x) / w : z > 0 ? y / h : 1 - y / h;
    const lift = 0.035 + 0.045 * clamp01((edge - (1 - EDGE)) / EDGE);
    peek.goal = peek.t.fwd ? lift : peek.t.end - (spread ? lift : lift * 2.5);
  }

  function follow() {
    if (!drag?.started) return;
    const p = drag.t.p;
    setP(drag.t, p + (drag.goal - p) * 0.22);
    drag.raf = requestAnimationFrame(follow);
  }
  function beginDrag(e, t, extra) {
    drag = { id: e.pointerId, started: true, t, x0: e.clientX, y0: e.clientY, goal: t.p, ...extra };
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
      if (peek && peek.z === z) {
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
      beginDrag(e, startTurn(target, z > 0 ? -1 : 1), { mouse: true });
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
      const p = progressAt(local(e));
      // a drag from the left page starts from its own edge, wherever the pointer is
      drag.goal = drag.t.fwd ? Math.max(p, 0.02) : Math.min(p, drag.t.end - 0.02);
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
      const k = clamp01(Math.abs(dx) / (drag.w * (spread ? 1.6 : 1.1)));
      drag.goal = (drag.t.fwd ? k : 1 - k) * drag.t.end;
      drag.vx = e.movementX || dx - (drag.lastDx ?? 0);
      drag.lastDx = dx;
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
    const turned = d.t.fwd ? d.goal / d.t.end : 1 - d.goal / d.t.end;
    const moving = d.lastT && performance.now() - d.lastT < 80;
    const flickToward = moving && Math.abs(d.vx || 0) > 6 && ((d.t.dir < 0 && d.vx < 0) || (d.t.dir > 0 && d.vx > 0));
    const complete = turned > 0.5 || flickToward || (!d.mouse && (turned > 0.3 || (moving && Math.abs(e.clientX - d.x0) > 40)));
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
  shell.notebook = { state: () => ({ idx, spread, busy, visible: spreadOf(idx), mode }), next, prev, go,
    // hold a forward turn at progress p (0–1), for checking frames; pose(null) puts it back
    pose(p) {
      if (p == null) { if (posed) { finishTurn(posed, false); posed = null; } return; }
      if (!posed) { const n = nextTarget(); if (n == null) return; busy = true; posed = prepareTurn(idx, n); }
      setP(posed, p);
    } };
  let posed = null;
}
