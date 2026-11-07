// collage.js: prints and polaroids are laid down on the page as they scroll into view.
// Timing comes from Motion (motion.dev, vendored, MIT): each piece drops from a little above,
// over-rotated, and settles onto its resting angle (--r) with a spring. Without Motion, or with
// reduced motion, everything is simply in place.
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadMotion() {
  if (window.Motion) return Promise.resolve(window.Motion);
  return new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = new URL('../assets/vendor/motion-11.11.17.js', import.meta.url).href;
    sc.onload = () => (window.Motion ? resolve(window.Motion) : reject(new Error('Motion missing')));
    sc.onerror = reject;
    document.head.append(sc);
  });
}

export function initCollage(groups) {
  if (reduce() || !('IntersectionObserver' in window)) return;
  loadMotion().then(({ animate, inView, stagger }) => {
    groups.forEach(({ root, items }) => {
      const els = [...root.querySelectorAll(items)];
      if (!els.length) return;
      // only hide what is still below the fold, so nothing already visible blinks
      const below = els.filter((el) => el.getBoundingClientRect().top > innerHeight * 0.9);
      below.forEach((el) => { el.style.opacity = '0'; el.style.translate = '0 34px'; el.style.rotate = `${(Math.random() - 0.5) * 8}deg`; });
      inView(root, () => {
        animate(below, { opacity: 1, translate: '0 0px', rotate: '0deg' }, {
          delay: stagger(0.08),
          opacity: { duration: 0.35 },
          translate: { type: 'spring', stiffness: 220, damping: 20 },
          rotate: { type: 'spring', stiffness: 180, damping: 12 },
        });
      }, { amount: 0.15 });
    });
  }).catch(() => {});
}
