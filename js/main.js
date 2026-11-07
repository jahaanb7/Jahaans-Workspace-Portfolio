// main.js: module entry for the home page. Each part fails on its own;
// the static markup underneath stays usable whatever happens here.
import './hero.js';
import { initPipeline, initSequence, initReveals } from './pipeline.js';
import { initCollage } from './collage.js';
import { initWorkbench } from './workbench.js';
import { initBackdrop } from './backdrop.js';
import { initHeroTitle } from './hero-title.js';

const safe = (name, fn) => {
  try { return fn(); } catch (err) { console.warn(`${name} unavailable`, err); return undefined; }
};
const vendor = new URL('../assets/vendor/', import.meta.url).href;
let roughNotation = null;
export function loadRoughNotation() {
  if (window.RoughNotation) return Promise.resolve(window.RoughNotation);
  roughNotation ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${vendor}rough-notation-0.5.1.iife.js`;
    s.onload = () => resolve(window.RoughNotation);
    s.onerror = reject;
    document.head.append(s);
  });
  return roughNotation;
}
const whenNear = (el, fn, margin = '600px 0px') => {
  if (!('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: margin });
  io.observe(el);
};

const pipe = document.querySelector('[data-pipeline]');
if (pipe) safe('pipeline', () => initPipeline(pipe));
safe('backdrop', () => initBackdrop());
safe('hero title', () => initHeroTitle(document.getElementById('hero-title')));
const fluid = document.querySelector('[data-fluid]');
if (fluid) whenNear(fluid, () => {
  import('../assets/fluid/fluid-view.js')
    .then((m) => m.createFluidView(fluid, { palette: 'sky', loadModule: () => import('../assets/fluid/fluid.mjs').then((f) => f.default()) }))
    .then(() => fluid.classList.add('is-live'))
    .catch((err) => { fluid.classList.add('is-static'); console.warn('fluid unavailable', err); });
}, '400px 0px');
safe('concept reveals', () => initReveals(document));
const seq = document.querySelector('[data-sequence]');
if (seq) safe('sequence', () => initSequence(seq));
// Rasterix prints and QuantumSim polaroids settle onto the page as they arrive (Motion springs).
safe('collage', () => initCollage([
  { root: document.querySelector('.ras-prints'), items: '.ras-print' },
  { root: document.querySelector('[data-qs-board]'), items: '.qs-item' },
].filter((g) => g.root)));

// Workbench: line studies draw themselves in, notes get a red underline, the sand plate runs
// only while its tab is open and on screen.
const bench = document.getElementById('workbench');
if (bench) safe('workbench', () => initWorkbench(bench, { whenNear, loadRoughNotation }));

// The scratchbook loads when the section is about to be seen.
const nb = document.getElementById('notebook');
if (nb) {
  const start = () => import('./notebook.js').then((m) => m.initNotebook(nb)).catch((err) => console.warn('scratchbook unavailable', err));
  if (/^#(notebook|xp-)/.test(location.hash)) start();
  else whenNear(nb, start, '900px 0px');
}

// Scroll motion on tablets and desktops without reduced motion; motion.js checks again.
import('./motion.js').then((m) => m.initMotion()).catch((err) => console.warn('motion unavailable', err));
