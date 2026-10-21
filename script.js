/* ==========================================================================
   Aurelia Studio — Interactions
   Vanilla JS · no dependencies
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  // Tells the safety-net timer in <head> that the script loaded
  root.classList.add('js-ready');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const desktopNav = window.matchMedia('(min-width: 56em)');

  const header = document.querySelector('[data-header]');
  const nav = document.querySelector('[data-nav]');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navMenu = document.getElementById('nav-menu');

  /* ------------------------------------------------------------------
     1. Header state on scroll (rAF-throttled, passive listener)
     ------------------------------------------------------------------ */
  const initHeader = () => {
    if (!header) return;
    let ticking = false;

    const update = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });

    update();
  };

  /* ------------------------------------------------------------------
     2. Mobile navigation
     ------------------------------------------------------------------ */
  const isMenuOpen = () => nav && nav.classList.contains('is-open');

  const setMenu = (open, { returnFocus = false } = {}) => {
    if (!nav || !navToggle) return;

    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Затвори менюто' : 'Отвори менюто');
    document.body.classList.toggle('menu-open', open);

    if (open) {
      const firstLink = navMenu && navMenu.querySelector('a');
      if (firstLink) {
        // Wait for visibility transition to start so the link is focusable
        window.requestAnimationFrame(() => firstLink.focus({ preventScroll: true }));
      }
    } else if (returnFocus) {
      navToggle.focus({ preventScroll: true });
    }
  };

  const initNav = () => {
    if (!nav || !navToggle || !navMenu) return;

    navToggle.addEventListener('click', () => setMenu(!isMenuOpen()));

    document.addEventListener('keydown', (event) => {
      if (!isMenuOpen()) return;

      if (event.key === 'Escape') {
        setMenu(false, { returnFocus: true });
        return;
      }

      // Keep keyboard focus inside the open menu (toggle + links)
      if (event.key === 'Tab') {
        const focusables = [navToggle, ...navMenu.querySelectorAll('a')];
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    // Close the overlay when switching to the desktop layout
    const onBreakpoint = (mq) => {
      if (mq.matches && isMenuOpen()) setMenu(false);
    };

    if (typeof desktopNav.addEventListener === 'function') {
      desktopNav.addEventListener('change', onBreakpoint);
    } else {
      desktopNav.addListener(onBreakpoint);
    }
  };

  /* ------------------------------------------------------------------
     3. Smooth scrolling for in-page anchors (header-offset aware)
     ------------------------------------------------------------------ */
  const initSmoothScroll = () => {
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest('a[href^="#"]');
      if (!link) return;

      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;

      let id;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch (error) {
        return; // malformed %-sequence: let the browser handle it
      }

      const target = document.getElementById(id);
      if (!target) return;

      event.preventDefault();

      if (isMenuOpen()) setMenu(false);

      const behavior = reducedMotion.matches ? 'auto' : 'smooth';
      const isTop = target === header;
      const headerOffset = header ? header.offsetHeight : 0;
      const top = isTop
        ? 0
        : Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerOffset - 16);

      window.scrollTo({ top, behavior });

      if (window.history && typeof window.history.pushState === 'function') {
        window.history.pushState(null, '', isTop ? window.location.pathname + window.location.search : hash);
      }

      // Move focus for keyboard & screen-reader users without a second jump
      const focusTarget = isTop ? document.getElementById('main') : target;
      if (focusTarget) {
        if (!focusTarget.hasAttribute('tabindex') && !focusTarget.matches('a, button, input, select, textarea')) {
          focusTarget.setAttribute('tabindex', '-1');
        }
        focusTarget.focus({ preventScroll: true });
      }
    });
  };

  /* ------------------------------------------------------------------
     4. Reveal-on-scroll (IntersectionObserver)
     ------------------------------------------------------------------ */
  const initReveal = () => {
    const elements = document.querySelectorAll('.reveal');
    if (!elements.length) return;

    const showAll = () => elements.forEach((el) => el.classList.add('is-visible'));

    if (!('IntersectionObserver' in window) || reducedMotion.matches) {
      showAll();
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, {
      root: null,
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.12
    });

    elements.forEach((el) => observer.observe(el));
  };

  /* ------------------------------------------------------------------
     5. Card spotlight (pointer-following glow)
     ------------------------------------------------------------------ */
  const initCardSpotlight = () => {
    if (!finePointer.matches) return;

    document.querySelectorAll('.card').forEach((card) => {
      let frame = null;
      let pointerX = 0;
      let pointerY = 0;

      // Throttle to one layout read + style write per frame
      card.addEventListener('pointermove', (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (frame !== null) return;

        frame = window.requestAnimationFrame(() => {
          frame = null;
          const rect = card.getBoundingClientRect();
          card.style.setProperty('--mx', `${pointerX - rect.left}px`);
          card.style.setProperty('--my', `${pointerY - rect.top}px`);
        });
      }, { passive: true });
    });
  };

  /* ------------------------------------------------------------------
     5b. Pause hero background animations while off-screen
     ------------------------------------------------------------------ */
  const initHeroPause = () => {
    const hero = document.querySelector('.hero');
    if (!hero || !('IntersectionObserver' in window)) return;

    new IntersectionObserver(([entry]) => {
      hero.classList.toggle('is-paused', !entry.isIntersecting);
    }).observe(hero);
  };

  /* ------------------------------------------------------------------
     6. Custom cursor (desktop / fine pointers only)
     ------------------------------------------------------------------ */
  const initCursor = () => {
    const cursor = document.querySelector('.cursor');
    if (!cursor || !finePointer.matches) return;

    const dot = cursor.querySelector('.cursor__dot');
    const ring = cursor.querySelector('.cursor__ring');
    if (!dot || !ring) return;

    const INTERACTIVE = 'a, button, [role="button"], input, textarea, select, label, summary, [data-cursor]';
    const EASE = 0.18;

    let mouseX = -100;
    let mouseY = -100;
    let ringX = mouseX;
    let ringY = mouseY;
    let rafId = null;

    root.classList.add('has-cursor');

    // One DOM write per frame for both elements, however fast the mouse reports
    const render = () => {
      const smoothing = reducedMotion.matches ? 1 : EASE;
      ringX += (mouseX - ringX) * smoothing;
      ringY += (mouseY - ringY) * smoothing;
      dot.style.translate = `${mouseX}px ${mouseY}px`;
      ring.style.translate = `${ringX}px ${ringY}px`;

      // Stop the loop once the ring has caught up to save CPU
      if (Math.abs(mouseX - ringX) < 0.1 && Math.abs(mouseY - ringY) < 0.1) {
        rafId = null;
        return;
      }
      rafId = window.requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (rafId === null) rafId = window.requestAnimationFrame(render);
    };

    window.addEventListener('pointermove', (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;

      mouseX = event.clientX;
      mouseY = event.clientY;

      if (cursor.classList.contains('is-hidden')) {
        // Snap the ring on first appearance instead of flying in from a corner
        ringX = mouseX;
        ringY = mouseY;
        cursor.classList.remove('is-hidden');
      }
      startLoop();
    }, { passive: true });

    document.addEventListener('pointerover', (event) => {
      const interactive = event.target instanceof Element && event.target.closest(INTERACTIVE);
      cursor.classList.toggle('is-hover', Boolean(interactive));
    }, { passive: true });

    document.addEventListener('pointerdown', () => cursor.classList.add('is-down'), { passive: true });
    document.addEventListener('pointerup', () => cursor.classList.remove('is-down'), { passive: true });

    root.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
    root.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'));
    window.addEventListener('blur', () => cursor.classList.add('is-hidden'));
  };

  /* ------------------------------------------------------------------
     7. Dynamic copyright year
     ------------------------------------------------------------------ */
  const initYear = () => {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-year]').forEach((el) => {
      el.textContent = year;
    });
  };

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  initHeader();
  initNav();
  initSmoothScroll();
  initReveal();
  initCardSpotlight();
  initHeroPause();
  initCursor();
  initYear();
})();
