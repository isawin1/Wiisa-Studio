gsap.registerPlugin(ScrollTrigger);

const nav = document.getElementById('nav');
const cursorDot = document.getElementById('cursorDot');
const cursorRing = document.getElementById('cursorRing');

// .hero-mark is centered on the hero image's orb via left/top (CSS) +
// xPercent/yPercent (GSAP) instead of a CSS transform. This is a static
// layout offset, not motion, so it runs unconditionally — reduced-motion
// users still need the logo centered, just without the entrance tween.
gsap.set('.hero-mark', { xPercent: -50, yPercent: -50 });

/* ============================================
   NAV — transparent at top, compact + blurred
   past 80px. ScrollTrigger only toggles the class;
   the visual transition itself is a CSS transition
   (see .nav / .nav-scrolled in styles.css) so it
   stays off the main thread and off GSAP.
   ============================================ */
ScrollTrigger.create({
  trigger: document.body,
  start: 'top -80',
  onEnter: () => nav.classList.add('nav-scrolled'),
  onLeaveBack: () => nav.classList.remove('nav-scrolled'),
});

/* ============================================
   MOBILE NAV
   ============================================ */
const navBurger = document.getElementById('navBurger');
const navMobile = document.getElementById('navMobile');
navBurger.addEventListener('click', () => {
  const isOpen = navMobile.classList.toggle('open');
  navBurger.setAttribute('aria-expanded', String(isOpen));
});
navMobile.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navMobile.classList.remove('open');
    navBurger.setAttribute('aria-expanded', 'false');
  });
});

/* ============================================
   FAQ ACCORDION
   ============================================ */
document.querySelectorAll('.faq-question').forEach((btn) => {
  const answer = btn.nextElementSibling;
  gsap.set(answer, { height: 0 });

  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.4;

    document.querySelectorAll('.faq-question').forEach((other) => {
      if (other !== btn && other.getAttribute('aria-expanded') === 'true') {
        other.setAttribute('aria-expanded', 'false');
        gsap.to(other.nextElementSibling, { height: 0, duration, ease: 'power2.inOut' });
      }
    });

    btn.setAttribute('aria-expanded', String(!isOpen));
    gsap.to(answer, { height: isOpen ? 0 : 'auto', duration, ease: 'power2.inOut' });
  });
});

/* ============================================
   STAT COUNTERS — shared helper (used by both
   the reduced-motion and animated code paths)
   ============================================ */
function revealCounters(instant) {
  document.querySelectorAll('.stat-number').forEach((el) => {
    const target = parseFloat(el.dataset.countTo);
    const suffix = el.dataset.suffix || '';

    if (instant) {
      el.textContent = target + suffix;
      return;
    }

    const proxy = { val: 0 };
    gsap.to(proxy, {
      val: target,
      duration: 1.8,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = Math.round(proxy.val) + suffix;
      },
    });
  });
}

/* ============================================
   WORD SPLIT — wraps each word in a <span class="word-fade">,
   preserving existing <br> line breaks, so headline/tagline
   text can be revealed word-by-word instead of as one block.
   Only called on the no-reduced-motion path (see below); under
   reduced motion the original markup is left untouched.
   ============================================ */
function splitIntoWords(el) {
  const lines = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = lines
    .map((line) =>
      line
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => `<span class="word-fade">${word}</span>`)
        .join(' ')
    )
    .join('<br />');
  return el.querySelectorAll('.word-fade');
}

/* ============================================
   RESPONSIVE / ACCESSIBLE ANIMATION SETUP
   ============================================ */
const mm = gsap.matchMedia();

mm.add(
  {
    isDesktop: '(pointer: fine)',
    reduceMotion: '(prefers-reduced-motion: reduce)',
  },
  (context) => {
    const { isDesktop, reduceMotion } = context.conditions;

    /* ---------- Reduced motion: reveal everything, skip decorative motion ---------- */
    if (reduceMotion) {
      gsap.set('.reveal', { autoAlpha: 1, y: 0 });
      gsap.set('.timeline-fill', { width: '100%' });
      revealCounters(true);
      return;
    }

    /* ---------- Custom cursor (desktop only) ---------- */
    if (isDesktop) {
      const xTo = gsap.quickTo(cursorDot, 'x', { duration: 0.1, ease: 'power3.out' });
      const yTo = gsap.quickTo(cursorDot, 'y', { duration: 0.1, ease: 'power3.out' });
      const xToRing = gsap.quickTo(cursorRing, 'x', { duration: 0.35, ease: 'power3.out' });
      const yToRing = gsap.quickTo(cursorRing, 'y', { duration: 0.35, ease: 'power3.out' });

      const onMove = (e) => {
        document.body.classList.add('cursor-active');
        xTo(e.clientX);
        yTo(e.clientY);
        xToRing(e.clientX);
        yToRing(e.clientY);
      };
      const onEnter = () => cursorRing.classList.add('cursor-hover');
      const onLeave = () => cursorRing.classList.remove('cursor-hover');

      window.addEventListener('mousemove', onMove);
      const hoverTargets = document.querySelectorAll('[data-cursor="link"]');
      hoverTargets.forEach((el) => {
        el.addEventListener('mouseenter', onEnter);
        el.addEventListener('mouseleave', onLeave);
      });

      /* ---------- Magnetic buttons (desktop only) ---------- */
      const magneticCleanups = [];
      document.querySelectorAll('.btn-magnetic').forEach((btn) => {
        // quickTo instances are created ONCE per button, outside any
        // listener, and reused for every call (tracking AND the return
        // to origin). Mixing a quickTo-driven property with a separate
        // gsap.to() tween on that same property corrupts quickTo's
        // internal retarget/reset mechanism after the first cycle
        // (GSAP logs "x/y not eligible for reset" and the effect gets
        // stuck) — so the release must go through the same setters.
        const btnXTo = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'back.out(1.7)' });
        const btnYTo = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'back.out(1.7)' });
        const strength = 0.4;
        const maxOffset = 10; // px, per spec: max 8-12px displacement
        const extraRadius = 70; // proximity zone beyond the button's own edges
        let isInside = false;

        const onBtnMove = (e) => {
          const rect = btn.getBoundingClientRect();
          const dx = e.clientX - (rect.left + rect.width / 2);
          const dy = e.clientY - (rect.top + rect.height / 2);
          const activeRadius = Math.max(rect.width, rect.height) / 2 + extraRadius;
          const dist = Math.hypot(dx, dy);

          if (dist < activeRadius) {
            isInside = true;
            const pull = 1 - dist / activeRadius;
            btnXTo(gsap.utils.clamp(-maxOffset, maxOffset, dx * strength * pull));
            btnYTo(gsap.utils.clamp(-maxOffset, maxOffset, dy * strength * pull));
          } else if (isInside) {
            isInside = false;
            btnXTo(0);
            btnYTo(0);
          }
        };

        const onBtnLeave = () => {
          isInside = false;
          btnXTo(0);
          btnYTo(0);
        };

        window.addEventListener('mousemove', onBtnMove);
        document.addEventListener('mouseleave', onBtnLeave);
        magneticCleanups.push(() => {
          window.removeEventListener('mousemove', onBtnMove);
          document.removeEventListener('mouseleave', onBtnLeave);
        });
      });

      return () => {
        window.removeEventListener('mousemove', onMove);
        hoverTargets.forEach((el) => {
          el.removeEventListener('mouseenter', onEnter);
          el.removeEventListener('mouseleave', onLeave);
        });
        magneticCleanups.forEach((cleanup) => cleanup());
      };
    }
  }
);

mm.add('(prefers-reduced-motion: no-preference)', () => {
  /* ---------- Hero parallax: media slower, text layer faster ---------- */
  gsap.to('.hero-media', {
    yPercent: 18,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero-layer', {
    yPercent: -14,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  /* ---------- Hero entrance (load-time, not scroll-triggered) ---------- */
  gsap.set('.hero .reveal', { y: 20 });

  // Word-by-word reveal for the tagline and the main headline. Split
  // happens only here (no-reduced-motion path) so reduced-motion users
  // never get the extra span markup — their text just appears via the
  // '.reveal' autoAlpha set in the reduced-motion branch above.
  const taglineWords = splitIntoWords(document.querySelector('.hero-tagline'));
  const headlineWords = splitIntoWords(document.querySelector('.hero-bottom h1'));
  gsap.set([taglineWords, headlineWords], { opacity: 0, y: 20 });

  const wordReveal = { duration: 0.55, ease: 'power2.out', stagger: 0.045, opacity: 1, y: 0 };

  gsap.timeline({ delay: 0.15 })
    .to('.hero-tagline', { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' })
    .to(taglineWords, wordReveal, '<')
    .to('.hero-scroll', { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' }, '<0.1')
    .to('.hero-mark', { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }, '<0.1')
    .to('.hero-bottom', { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '<0.2')
    .to(headlineWords, wordReveal, '<');

  /* ---------- Scroll reveals with stagger (everything below the hero) ---------- */
  const batchTargets = gsap.utils.toArray('section:not(.hero) .reveal');
  gsap.set(batchTargets, { y: 36 });

  ScrollTrigger.batch(batchTargets, {
    start: 'top 88%',
    onEnter: (els) =>
      gsap.to(els, {
        autoAlpha: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.12,
        overwrite: true,
      }),
    once: true,
  });

  /* ---------- Process timeline fill ---------- */
  gsap.to('.timeline-fill', {
    width: '100%',
    ease: 'none',
    scrollTrigger: { trigger: '.timeline', start: 'top 75%', end: 'bottom 60%', scrub: 0.6 },
  });

  /* ---------- Stat counters: count up when the row enters the viewport ---------- */
  ScrollTrigger.create({
    trigger: '.stats',
    start: 'top 85%',
    once: true,
    onEnter: () => revealCounters(false),
  });
});

/* ============================================
   MARQUEE — infinite loop, pauses on hover
   Speed is derived from the rendered text width so
   it stays visually constant across screen sizes.
   ============================================ */
let marqueeTween = null;

function buildMarqueeTween() {
  const track = document.querySelector('.marquee-track');
  if (!track) return null;

  if (marqueeTween) marqueeTween.kill();
  gsap.set(track, { xPercent: 0 });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const itemWidth = track.children[0].offsetWidth;
  const pxPerSecond = 45; // slow, constant pace

  return gsap.to(track, {
    xPercent: -50,
    duration: itemWidth / pxPerSecond,
    ease: 'none',
    repeat: -1,
  });
}

const marqueeWrapper = document.querySelector('.marquee');
if (marqueeWrapper) {
  marqueeTween = buildMarqueeTween();

  window.addEventListener('load', () => {
    marqueeTween = buildMarqueeTween();
  });

  let marqueeResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(marqueeResizeTimer);
    marqueeResizeTimer = setTimeout(() => {
      marqueeTween = buildMarqueeTween();
    }, 300);
  });

  marqueeWrapper.addEventListener('mouseenter', () => marqueeTween && marqueeTween.pause());
  marqueeWrapper.addEventListener('mouseleave', () => marqueeTween && marqueeTween.play());
}

/* ---------- Recalculate after full load (hero image affects layout) ---------- */
window.addEventListener('load', () => ScrollTrigger.refresh());
