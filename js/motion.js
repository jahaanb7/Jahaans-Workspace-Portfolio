// motion.js: scroll motion for large screens. Loaded only when it can run.
//
// Everything here sits inside gsap.matchMedia() conditions, so when the screen narrows
// or the visitor turns on reduced motion, GSAP reverts every tween and pin and the page
// is back to its static layout.
//
// Lead moment: the workbench line studies plot themselves in (js/workbench.js, CSS only).
// Supporting: the Orion print (hero.js, its own loop) and the scratchbook page turn
// (notebook.js, explicit input only). Secondary: fluid frames follow scroll, prints drift slightly.

export const MOTION = {
  fast: 0.18,
  base: 0.26,
  reveal: 0.6,
  turn: 0.9,
  ease: 'power2.out',
  query: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
  desktop: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
  tablet: '(min-width: 768px) and (max-width: 1023px) and (prefers-reduced-motion: no-preference)',
};

const base = new URL('../assets/vendor/', import.meta.url).href;
function script(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = base + src;
    s.async = false;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.append(s);
  });
}

export async function initMotion() {
  if (!window.matchMedia(MOTION.query).matches) {
    // Load later if the window grows into the desktop layout.
    const mq = window.matchMedia(MOTION.query);
    const once = (e) => { if (e.matches) { mq.removeEventListener('change', once); initMotion(); } };
    mq.addEventListener('change', once);
    return;
  }
  if (!window.gsap) {
    await script('gsap-3.12.5.min.js');
    await script('ScrollTrigger-3.12.5.min.js');
  }
  if (!window.Lenis) await script('lenis-1.1.20.min.js').catch(() => {});
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: MOTION.ease, duration: MOTION.reveal });

  const mm = gsap.matchMedia();

  /* Lenis smooth scroll (darkroomengineering/lenis), driven by GSAP's ticker so
     ScrollTrigger reads the same scroll position every frame. */
  mm.add(MOTION.query, () => {
    if (!window.Lenis) return;
    const lenis = new window.Lenis({ lerp: 0.1, anchors: { offset: -64 }, prevent: (n) => n.closest?.('.nav, .sheet-scroll, [data-lenis-prevent]') });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (t) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(tick); lenis.destroy(); };
  });

  /* Section titles blur in word by word (react-bits BlurText, rebuilt on GSAP). */
  mm.add(MOTION.query, () => {
    const tweens = [];
    document.querySelectorAll('.display-title').forEach((h) => {
      const words = splitWords(h);
      tweens.push(gsap.from(words, {
        opacity: 0, y: 18, filter: 'blur(10px)', duration: 0.7, stagger: 0.06, ease: 'power3.out',
        scrollTrigger: { trigger: h, start: 'top 85%', once: true },
        onComplete: () => gsap.set(words, { clearProps: 'filter,transform' }),
      }));
    });
    return () => document.querySelectorAll('.display-title[data-split]').forEach(unsplit);
  });

  /* Primary buttons lean toward the pointer (react-bits Magnet). */
  mm.add(`${MOTION.desktop} and (pointer: fine)`, () => {
    const off = [];
    document.querySelectorAll('.btn-ink, .nav-cta').forEach((b) => {
      const x = gsap.quickTo(b, 'x', { duration: 0.4, ease: 'power3.out' });
      const y = gsap.quickTo(b, 'y', { duration: 0.4, ease: 'power3.out' });
      const move = (e) => {
        const r = b.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.3);
        y((e.clientY - (r.top + r.height / 2)) * 0.3);
      };
      const leave = () => { x(0); y(0); };
      b.addEventListener('pointermove', move);
      b.addEventListener('pointerleave', leave);
      off.push(() => { b.removeEventListener('pointermove', move); b.removeEventListener('pointerleave', leave); gsap.set(b, { clearProps: 'transform' }); });
    });
    return () => off.forEach((f) => f());
  });

  mm.add(MOTION.desktop, () => {
    /* fluid frames follow the plate through the viewport */
    const seq = document.querySelector('[data-sequence]');
    if (seq?.sequence) {
      let lastFrame = -1;
      ScrollTrigger.create({
        trigger: seq, start: 'top 70%', end: 'bottom 40%',
        onUpdate: (self) => {
          const f = Math.round(self.progress * (seq.sequence.count - 1));
          if (f !== lastFrame) { lastFrame = f; seq.sequence.set(f); }
        },
      });
    }

    /* prints and scraps drift a little against the page */
    gsap.utils.toArray('.ref-print, .scrap').forEach((n, i) => {
      const d = 10 + (i % 3) * 6;
      gsap.fromTo(n, { y: d }, { y: -d, ease: 'none', scrollTrigger: { trigger: n, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* a few entries (body text stays put) */
    gsap.utils.toArray('.clip, .small-fig').forEach((n) => {
      gsap.from(n, { opacity: 0, y: 24, duration: MOTION.reveal, scrollTrigger: { trigger: n, start: 'top 90%', once: true } });
    });

  });

  // Images and fonts change heights; recalculate trigger positions once they settle.
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  // Lazy images, the scratchbook and the print pile change the page height after start-up;
  // re-measure whenever the document's height settles at a new value.
  let lastH = document.body.scrollHeight;
  let rt = 0;
  new ResizeObserver(() => {
    const h = document.body.scrollHeight;
    if (Math.abs(h - lastH) < 4) return;
    lastH = h;
    clearTimeout(rt);
    rt = setTimeout(() => ScrollTrigger.refresh(), 200);
  }).observe(document.body);
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

// Wrap each word of a heading in an inline-block span, keeping child elements like <em>.
function splitWords(el) {
  if (!el.dataset.split) {
    el.dataset.split = el.innerHTML;
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walk.nextNode()) nodes.push(walk.currentNode);
    nodes.forEach((t) => {
      const frag = document.createDocumentFragment();
      t.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(part); return; }
        const s = document.createElement('span');
        s.className = 'bw';
        s.textContent = part;
        frag.append(s);
      });
      t.replaceWith(frag);
    });
  }
  return el.querySelectorAll('.bw');
}
function unsplit(el) { el.innerHTML = el.dataset.split; delete el.dataset.split; }
