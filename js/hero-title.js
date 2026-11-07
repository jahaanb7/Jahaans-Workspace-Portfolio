// hero-title.js: the opening title drawn as an annotated figure.
//
// The words stay real text. Each letter gets a span so a few can be hatched and labelled; the
// guides (y = H, y = x, datum, descender) are measured from the live font, not hard-coded, so
// they stay on the letters at every size. Labels name a geometric feature the letter really has.

const LABELS = [
  // [line, letter index, text, side, anchor x (0-1 across the glyph), anchor y, tier, kind]
  [0, 0, 'Radius r', 'left', 0.3, 'base', 0],
  [0, 1, 'Area ∫ dA', 'top', 0.5, 'x', 0],
  [0, 7, 'Inflection', 'top', 0.5, 'xmid', 0],
  [1, 0, 'Vertex · θ', 'bottom', 0.27, 'base', 0],
  [1, 1, 'Centroid', 'bottom', 0.5, 'xmid', 1, 'centroid'],
  [1, 3, 'Node', 'bottom', 0.42, 'xmid', 0],
  [1, 5, 'y < 0', 'bottom', 0.25, 'desc', 1],
  [1, 7, 'Arc · s = rθ', 'bottom', 0.4, 'base', 0],
  [1, 8, 'Chord', 'bottom', 0.5, 'xmid', 1],
];
const HATCH = [[0, 1], [1, 1], [1, 5], [1, 8]];
// label offset: -1 sits above the line, 1 below, so close pairs never touch
const GUIDES = [['cap', 'y = H', -1], ['x', 'y = x', 1], ['base', 'Datum · y = 0', -1], ['desc', 'y = −d', 1]];

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
};

export function initHeroTitle(h1) {
  if (!h1 || h1.dataset.anatomy) return;
  h1.dataset.anatomy = '1';
  h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());

  // split each line into letter spans, plus a zero-size marker that sits on the baseline
  const lines = [...h1.querySelectorAll('.line > span')].map((inner) => {
    const target = inner.querySelector('em') || inner;
    const text = target.textContent;
    target.textContent = '';
    const glyphs = [...text].map((ch) => {
      const s = document.createElement('span');
      s.className = 'g';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = ch;
      target.append(s);
      return s;
    });
    const mark = document.createElement('i');
    mark.className = 'g-base';
    mark.setAttribute('aria-hidden', 'true');
    target.append(mark);
    return { inner, glyphs, mark };
  });
  HATCH.forEach(([l, i]) => lines[l]?.glyphs[i]?.classList.add('hatch'));

  const svg = el('svg', { class: 'anatomy', 'aria-hidden': 'true' });
  h1.append(svg);

  function metrics(font) {
    const c = document.createElement('canvas').getContext('2d');
    c.font = font;
    const m = (s) => c.measureText(s);
    return { cap: m('H').actualBoundingBoxAscent, x: m('x').actualBoundingBoxAscent, desc: m('p').actualBoundingBoxDescent };
  }

  function draw() {
    svg.replaceChildren();
    // offsetLeft/Top ignore transforms, so the rise-in animation cannot skew the guides
    const rect = (n) => { let x = 0, y = 0, e = n; while (e && e !== h1) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { left: x, top: y, width: n.offsetWidth, right: x + n.offsetWidth }; };
    const cs = getComputedStyle(h1);
    const size = parseFloat(cs.fontSize);
    const m = metrics(`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`);
    const small = innerWidth < 760;
    const fs = Math.max(11, size * 0.15);
    svg.style.setProperty('--fs', `${fs}px`);
    let k = 0;
    const delay = () => `${(k++) * 70}ms`;

    const ys = lines.map(({ mark }) => {
      const base = rect(mark).top;
      return { base, x: base - m.x, cap: base - m.cap, desc: base + m.desc, mid: base - m.cap / 2, xmid: base - m.x / 2 };
    });

    // guides across the second line, labelled on the right
    const L = lines[1];
    const first = rect(L.glyphs[0]), last = rect(L.glyphs[L.glyphs.length - 1]);
    const x0 = first.left - size * 0.25, x1 = last.right + size * 0.25;
    GUIDES.forEach(([key, text, off]) => {
      const y = ys[1][key];
      el('line', { x1: x0, x2: x1, y1: y, y2: y, class: 'an-guide', style: `--d:${delay()}` }, svg);
      if (!small) el('text', { x: x1 + fs * 0.6, y: off < 0 ? y - fs * 0.3 : y + fs * 0.95, class: 'an-label', style: `--d:${delay()}` }, svg).textContent = text;
    });
    // a dimension for the x-height between datum and y = x
    if (!small) {
      const dx = x1 - size * 0.08;
      el('line', { x1: dx, x2: dx, y1: ys[1].x + 2, y2: ys[1].base - 2, class: 'an-dim', 'marker-start': 'url(#an-arrow)', 'marker-end': 'url(#an-arrow)', style: `--d:${delay()}` }, svg);
    }

    // centroid mark, leaders and labels on the letters
    const defs = el('defs', {}, svg);
    const mk = el('marker', { id: 'an-arrow', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0 2L5 5L0 8', class: 'an-arrowhead' }, mk);

    if (small) return;
    LABELS.forEach(([l, i, text, side, ax, ay, tier, kind]) => {
      const g = lines[l]?.glyphs[i];
      if (!g || (side === 'left' && innerWidth < 1200)) return;
      const r = rect(g);
      const px = r.left + r.width * ax;
      let py = ys[l][ay];
      if (kind === 'centroid') {
        py = ys[l].xmid;
        el('circle', { cx: px, cy: py, r: fs * 0.32, class: 'an-mark', style: `--d:${delay()}` }, svg);
        el('path', { d: `M${px - fs * 0.5} ${py}H${px + fs * 0.5}M${px} ${py - fs * 0.5}V${py + fs * 0.5}`, class: 'an-mark', style: `--d:${delay()}` }, svg);
      } else {
        el('circle', { cx: px, cy: py, r: 2.2, class: 'an-dot', style: `--d:${delay()}` }, svg);
      }
      const reach = size * 0.42 + tier * fs * 1.5;
      let tx = px, ty = py, anchor = 'middle', lx = px, ly = py;
      if (side === 'top') { ly = Math.min(py, ys[l].cap) - reach * 0.5; ty = ly - fs * 0.35; }
      if (side === 'bottom') { ly = Math.max(py, ys[l].desc) + reach * 0.45; ty = ly + fs * 1.0; }
      if (side === 'left') { lx = r.left - size * 0.18; tx = lx - fs * 0.4; ty = py + fs * 0.32; anchor = 'end'; ly = py; }
      el('line', { x1: px, y1: py, x2: lx, y2: ly, class: 'an-leader', style: `--d:${delay()}` }, svg);
      el('text', { x: tx, y: ty, 'text-anchor': anchor, class: 'an-label', style: `--d:${delay()}` }, svg).textContent = text;
    });
  }

  let raf = 0;
  const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
  (document.fonts?.ready || Promise.resolve()).then(() => { draw(); h1.classList.add('is-annotated'); });
  new ResizeObserver(redraw).observe(h1);
}
