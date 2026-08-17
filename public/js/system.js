/* ==========================================================================
   Nivasa — Matte System runtime

   Replaces what the brief specified as Framer Motion. Nivasa is server-
   rendered EJS, so the motion is CSS transitions driven by one
   IntersectionObserver. No dependencies, no build step.

   Owns three behaviours:
     1. scroll reveals   (.n-reveal -> .is-in, staggered via --i)
     2. hero load + parallax  (.n-matte -> .is-loaded)
     3. sliding filter pills  (.n-pillbar indicator)
   ========================================================================== */

(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 1. Scroll reveals ------------------------------------------------ */

  function initReveals() {
    const items = document.querySelectorAll(".n-reveal");
    if (!items.length) return;

    // Reduced motion: resolve everything to its final state, bind nothing.
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }

    // Stagger index is per-group, so each section counts from zero rather
    // than inheriting a page-wide offset.
    document.querySelectorAll("[data-reveal-group]").forEach((group) => {
      group.querySelectorAll(".n-reveal").forEach((el, i) => {
        el.style.setProperty("--i", i);
      });
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target); // reveal once, never re-run
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    items.forEach((el) => io.observe(el));
  }

  /* ---- 2. Hero load + parallax ------------------------------------------ */

  function initMattes() {
    const mattes = document.querySelectorAll(".n-matte");
    if (!mattes.length) return;

    // .is-loaded releases the 1.06 -> 1 scale. Fire it once the image has
    // decoded so the move isn't half over before anything is visible.
    mattes.forEach((matte) => {
      const media = matte.querySelector(".n-matte__media");

      if (!media) {
        matte.classList.add("is-loaded"); // gradient-only path
        return;
      }

      if (media.complete) {
        requestAnimationFrame(() => matte.classList.add("is-loaded"));
      } else {
        media.addEventListener(
          "load",
          () => matte.classList.add("is-loaded"),
          { once: true }
        );
        media.addEventListener(
          "error",
          () => matte.classList.add("is-loaded"), // fall back to the gradient
          { once: true }
        );
      }
    });

    if (reduced) return;

    // Parallax only while a matte is on screen, transform-only, rAF-throttled.
    const parallaxed = Array.from(
      document.querySelectorAll(".n-matte[data-parallax] .n-matte__media")
    );
    if (!parallaxed.length) return;

    let ticking = false;

    // Must match --n-parallax-range in system.css: the media is oversized by
    // this much on each edge, so drifting further would expose the gradient.
    function rangeOf(el) {
      const v = getComputedStyle(el).getPropertyValue("--n-parallax-range");
      return parseFloat(v) || 90;
    }

    function update() {
      parallaxed.forEach((media) => {
        const rect = media.parentElement.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        const max = rangeOf(media);
        const raw = rect.top * 0.15;
        const offset = Math.max(-max, Math.min(max, raw));
        media.style.setProperty("--n-parallax", offset.toFixed(2) + "px");
      });
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      },
      { passive: true }
    );

    update();
  }

  /* ---- 3. Sliding filter pills ------------------------------------------ */

  function initPillbars() {
    document.querySelectorAll(".n-pillbar").forEach((bar) => {
      const indicator = bar.querySelector(".n-pillbar__indicator");
      if (!indicator) return;

      function moveTo(pill, animate) {
        if (!pill) {
          indicator.style.opacity = "0";
          return;
        }
        if (!animate) indicator.style.transition = "none";
        indicator.style.opacity = "1";
        indicator.style.width = pill.offsetWidth + "px";
        indicator.style.transform = "translateX(" + pill.offsetLeft + "px)";
        if (!animate) {
          // Force a reflow so the suppressed transition doesn't leak into
          // the next move.
          void indicator.offsetWidth;
          indicator.style.transition = "";
        }
      }

      const active = () => bar.querySelector(".n-pill.is-active");

      moveTo(active(), false);

      bar.querySelectorAll(".n-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
          bar.querySelectorAll(".n-pill").forEach((p) =>
            p.classList.remove("is-active")
          );
          pill.classList.add("is-active");
          moveTo(pill, !reduced);
        });
      });

      // Pill widths change with the font and the viewport; re-measure.
      if ("ResizeObserver" in window) {
        new ResizeObserver(() => moveTo(active(), false)).observe(bar);
      }
      document.fonts?.ready.then(() => moveTo(active(), false));
    });
  }

  /* ---- 4. Theme toggle --------------------------------------------------- */

  // The initial stamp happens in an inline <head> script so there is no
  // flash. This only handles the click and persistence.
  function initTheme() {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const root = document.documentElement;
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("nivasa-theme", next);
      } catch (e) {
        /* private mode — the choice just won't persist */
      }
      // Pill widths shift with the theme's font rendering; re-measure.
      window.dispatchEvent(new Event("resize"));
    });
  }

  /* ---- 5. Mobile nav ----------------------------------------------------- */

  function initNav() {
    const burger = document.getElementById("navBurger");
    const pill = document.getElementById("navPill");
    if (!burger || !pill) return;

    burger.addEventListener("click", () => {
      const open = pill.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
    });

    // Mark the current section. Longest match wins — "/listings/new" must
    // light up "Add" only, not "Listings" as well.
    const path = window.location.pathname;
    let best = null;
    pill.querySelectorAll(".n-nav__link").forEach((link) => {
      const href = link.getAttribute("href");
      if (href === "/" || path.indexOf(href) !== 0) return;
      if (!best || href.length > best.getAttribute("href").length) best = link;
    });
    if (best) best.classList.add("is-active");
  }

  /* ---- 6. Flash popups --------------------------------------------------- */

  function initFlash() {
    const wrap = document.getElementById("flashWrap");
    if (!wrap) return;

    function dismiss(flash) {
      flash.classList.add("is-out");
      flash.addEventListener("animationend", () => flash.remove(), { once: true });
    }

    wrap.querySelectorAll(".n-flash").forEach((flash) => {
      const close = flash.querySelector(".n-flash__close");
      if (close) close.addEventListener("click", () => dismiss(flash));

      // Errors stay until dismissed; confirmations clear themselves.
      if (flash.classList.contains("n-flash--success")) {
        setTimeout(() => {
          if (flash.isConnected) dismiss(flash);
        }, 4500);
      }
    });
  }

  /* ---- 7. Image fade-in --------------------------------------------------

     Photos arrive band-by-band as they decode, which reads as jitter across
     a 28-card grid. Hold them at opacity 0 and reveal each once it is
     actually ready. Cached images report complete straight away.
     ------------------------------------------------------------------------ */

  function initImages() {
    const imgs = document.querySelectorAll(".n-card__media, .n-matte__media");

    imgs.forEach((img) => {
      const ready = () => img.classList.add("is-ready");

      if (img.complete && img.naturalWidth > 0) {
        ready();
        return;
      }

      img.addEventListener("load", ready, { once: true });
      // A broken image must still reveal, or the card sits blank forever.
      img.addEventListener("error", ready, { once: true });
    });
  }

  /* ---- 8. Nav ground on scroll ------------------------------------------

     The pill is glass. Over a hero photo it has something to refract; over
     the flat page canvas it does not, so it needs its own ground once the
     hero is behind it.
     ------------------------------------------------------------------------ */

  function initNavScroll() {
    const pill = document.getElementById("navPill");
    if (!pill) return;

    let ticking = false;

    function sync() {
      pill.classList.toggle("is-stuck", window.scrollY > 120);
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(sync);
      },
      { passive: true }
    );

    sync();
  }

  /* ---- boot -------------------------------------------------------------- */

  function boot() {
    initTheme();
    initNav();
    initFlash();
    initImages();
    initNavScroll();
    initReveals();
    initMattes();
    initPillbars();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
