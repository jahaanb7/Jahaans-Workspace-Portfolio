// site.js: small enhancements shared by every page. Plain script, no modules,
// so the menu, tabs and matrix work even where the module scripts do not load.
(function () {
  var doc = document.documentElement;
  doc.classList.remove('no-js');
  doc.classList.add('js');

  // Mobile menu
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    var mq = window.matchMedia('(max-width: 1080px)');
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.dataset.open = String(open);
      toggle.textContent = open ? 'Close' : 'Menu';
    };
    setOpen(false);
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a') && mq.matches) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // Show the compact brand in the sticky bar once the masthead has scrolled away.
  var bar = document.querySelector('[data-navbar]');
  var mast = document.querySelector('.masthead');
  if (bar && mast && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-stuck', !entries[entries.length - 1].isIntersecting);
    }).observe(mast);
  }

  // Mark the nav link for the section in view.
  var links = nav ? Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]')) : [];
  if (links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        var a = byId[entry.target.id];
        if (a) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });
  }

  // Theme: dark by default; the choice is remembered. Canvases listen for 'themechange'.
  var themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn) {
    var root = document.documentElement;
    var meta = document.querySelector('meta[name="theme-color"]');
    var apply = function (t) {
      root.dataset.theme = t;
      themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      if (meta) meta.setAttribute('content', t === 'dark' ? '#0D0D0E' : '#EDEDEB');
    };
    apply(root.dataset.theme === 'light' ? 'light' : 'dark');
    themeBtn.addEventListener('click', function () {
      var next = root.dataset.theme === 'light' ? 'dark' : 'light';
      apply(next);
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode: the choice lasts for this page only */ }
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    });
  }

  // Tabs (workbench sheets). Arrow keys move between tabs; Home and End jump.
  document.querySelectorAll('[data-tabs]').forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    var select = function (tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
      root.dispatchEvent(new CustomEvent('tabs:change', { detail: { tab: tab, panel: document.getElementById(tab.getAttribute('aria-controls')) } }));
    };
    // Workbench tabs are deep-linkable: #orion-tab-cad opens that tab; choosing a tab updates the URL.
    var linkable = root.hasAttribute('data-paper');
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        select(tab, false);
        if (linkable && history.replaceState) history.replaceState(null, '', '#' + tab.id);
      });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) {
          e.preventDefault(); select(next, true);
          if (linkable && history.replaceState) history.replaceState(null, '', '#' + next.id);
        }
      });
    });
    if (linkable && location.hash) {
      var want = root.querySelector('[role="tab"]' + location.hash.replace(/[^#\w-]/g, ''));
      if (want) {
        select(want, false);
        // fonts, images and the pinned pipeline change the layout after start-up; scroll once it settles
        var go = function () { want.scrollIntoView({ block: 'center' }); };
        if (document.readyState === 'complete') setTimeout(go, 300);
        else window.addEventListener('load', function () { setTimeout(go, 300); }, { once: true });
      }
    }
  });

  // Tool matrix: hovering or focusing a tool lights its row, its projects and its entry in the groups.
  var matrix = document.querySelector('.matrix');
  if (matrix) {
    var pinned = null;
    var evidence = document.querySelector('[data-evidence]');
    var clear = function () {
      document.querySelectorAll('.is-lit').forEach(function (el) { el.classList.remove('is-lit'); });
      if (pinned) lightOnly(pinned);
    };
    var lightOnly = function (key) {
      var row = matrix.querySelector('tr[data-tool="' + key + '"]');
      if (!row) return;
      row.classList.add('is-lit');
      row.querySelectorAll('td.on').forEach(function (td) {
        var th = matrix.querySelector('thead th[data-col="' + td.dataset.col + '"]');
        if (th) th.classList.add('is-lit');
      });
      document.querySelectorAll('.inst-tools li[data-tool="' + key + '"]').forEach(function (li) { li.classList.add('is-lit'); });
    };
    // Pick a tool: keep it lit and show where it was used, with links to the evidence.
    var pick = function (key) {
      pinned = pinned === key ? null : key;
      document.querySelectorAll('[data-pick]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.pick === pinned)); });
      document.querySelectorAll('.is-lit').forEach(function (el) { el.classList.remove('is-lit'); });
      if (!evidence) return;
      if (!pinned) { evidence.innerHTML = '<p class="ev-empty">Pick a tool to see where it was used.</p>'; return; }
      lightOnly(pinned);
      var li = document.querySelector('.inst-tools li[data-tool="' + pinned + '"]');
      var name = li.querySelector('.inst-name').textContent;
      var use = li.querySelector('.inst-use').textContent;
      var links = li.querySelector('.inst-proj').cloneNode(true);
      links.querySelectorAll('.visually-hidden').forEach(function (n) { n.remove(); });
      evidence.innerHTML = '';
      var h = document.createElement('p'); h.className = 'ev-tool'; h.textContent = name;
      var u = document.createElement('p'); u.className = 'ev-use'; u.textContent = use;
      var l = document.createElement('p'); l.className = 'ev-links'; l.append('Evidence: '); while (links.firstChild) l.append(links.firstChild);
      evidence.append(h, u, l);
    };
    document.querySelectorAll('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () { pick(b.dataset.pick); });
    });
    var lightTool = function (key) {
      document.querySelectorAll('.is-lit').forEach(function (el) { el.classList.remove('is-lit'); });
      lightOnly(key);
    };
    var lightCol = function (col) {
      document.querySelectorAll('.is-lit').forEach(function (el) { el.classList.remove('is-lit'); });
      matrix.querySelectorAll('[data-col="' + col + '"]').forEach(function (c) { c.classList.add('is-lit'); });
    };
    matrix.addEventListener('pointerover', function (e) {
      var tr = e.target.closest('tbody tr[data-tool]');
      var th = e.target.closest('thead th[data-col]');
      if (tr) lightTool(tr.dataset.tool); else if (th) lightCol(th.dataset.col);
    });
    matrix.addEventListener('pointerleave', clear);
    matrix.addEventListener('focusin', function (e) {
      var tr = e.target.closest('tbody tr[data-tool]');
      var th = e.target.closest('thead th[data-col]');
      if (tr) lightTool(tr.dataset.tool); else if (th) lightCol(th.dataset.col);
    });
    matrix.addEventListener('focusout', clear);
    document.querySelectorAll('.inst-tools li[data-tool]').forEach(function (li) {
      li.addEventListener('pointerenter', function () { lightTool(li.dataset.tool); });
      li.addEventListener('pointerleave', clear);
    });
  }

  // Copyright year (static year in markup is the fallback)
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
