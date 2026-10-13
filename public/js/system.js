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

  /* ---- 7. Stay calendar -------------------------------------------------- */

  // Dates are handled as plain "YYYY-MM-DD" strings and built with Date.UTC.
  // Using the local Date constructor would shift a date by a day for anyone
  // west of UTC, which is exactly the kind of bug that silently books the
  // wrong night.
  const DAY_MS = 86400000;
  const iso = (d) => d.toISOString().slice(0, 10);
  const parse = (s) => new Date(s + "T00:00:00Z");
  const addDays = (d, n) => new Date(d.getTime() + n * DAY_MS);

  function initStayCalendar() {
    const root = document.getElementById("stayCalendar");
    if (!root) return;

    const checkIn = document.getElementById("checkIn");
    const checkOut = document.getElementById("checkOut");
    const grid = root.querySelector(".n-cal__grid");
    const label = root.querySelector(".n-cal__month");
    const hint = root.querySelector(".n-cal__hint");

    const today = parse(iso(new Date()));
    let view = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    // Every night that cannot be selected, and why — the reason drives both
    // the styling and the message.
    const blocked = new Map(); // "YYYY-MM-DD" -> "booked" | "yours"
    let start = null;
    let end = null;

    function markRange(from, to, reason) {
      // Half-open: the checkout day is free for the next guest to arrive.
      for (let d = parse(from); iso(d) < to; d = addDays(d, 1)) {
        if (!blocked.has(iso(d))) blocked.set(iso(d), reason);
      }
    }

    async function loadAvailability() {
      try {
        const res = await fetch(`/listings/${root.dataset.listing}/availability`);
        if (!res.ok) return;
        const data = await res.json();
        (data.booked || []).forEach((r) => markRange(r.from, r.to, "booked"));
        (data.ownStays || []).forEach((r) => markRange(r.from, r.to, "yours"));
      } catch (e) {
        // Calendar still works; the server re-checks everything on submit.
        console.warn("Could not load availability", e);
      }
    }

    // A range is only valid if every night inside it is free.
    function rangeIsFree(from, to) {
      for (let d = parse(from); iso(d) < to; d = addDays(d, 1)) {
        if (blocked.has(iso(d))) return false;
      }
      return true;
    }

    function say(msg, tone) {
      hint.textContent = msg || "";
      hint.dataset.tone = tone || "";
    }

    function sync() {
      checkIn.value = start || "";
      checkOut.value = end || "";
      // The summary line listens for this.
      checkIn.dispatchEvent(new Event("change", { bubbles: true }));
      checkOut.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function pick(day) {
      if (!start || (start && end)) {
        start = day;
        end = null;
        say("Now pick your check-out date.");
      } else if (day <= start) {
        // Clicking earlier restarts rather than erroring — it is almost
        // always someone correcting their first choice.
        start = day;
        say("Now pick your check-out date.");
      } else if (!rangeIsFree(start, day)) {
        say("Those nights are not all free. Pick a shorter stay.", "bad");
        return render();
      } else {
        end = day;
        const nights = Math.round((parse(day) - parse(start)) / DAY_MS);
        say(`${nights} night${nights === 1 ? "" : "s"} selected.`);
      }
      sync();
      render();
    }

    function render() {
      const y = view.getUTCFullYear();
      const m = view.getUTCMonth();

      label.textContent = view.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

      // Monday-first: getUTCDay() is 0 for Sunday, so Sunday becomes 6.
      const first = new Date(Date.UTC(y, m, 1));
      const lead = (first.getUTCDay() + 6) % 7;
      const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

      let html = "";
      for (let i = 0; i < lead; i++) html += '<span class="n-cal__pad"></span>';

      for (let n = 1; n <= days; n++) {
        const d = new Date(Date.UTC(y, m, n));
        const key = iso(d);
        const why = blocked.get(key);
        const past = d < today;
        const off = past || Boolean(why);

        const classes = ["n-cal__day"];
        if (off) classes.push("is-off");
        if (why) classes.push(why === "yours" ? "is-yours" : "is-booked");
        if (key === start) classes.push("is-start");
        if (key === end) classes.push("is-end");
        if (start && end && key > start && key < end) classes.push("is-between");

        const title = why === "yours"
          ? "You are already staying somewhere this night"
          : why === "booked"
          ? "Already booked"
          : "";

        html += `<button type="button" class="${classes.join(" ")}" data-day="${key}"${
          off ? " disabled" : ""
        }${title ? ` title="${title}"` : ""}>${n}</button>`;
      }

      grid.innerHTML = html;
    }

    grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".n-cal__day");
      if (btn && !btn.disabled) pick(btn.dataset.day);
    });

    root.querySelector("[data-cal-prev]").addEventListener("click", () => {
      const limit = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      if (view > limit) {
        view = new Date(Date.UTC(view.getUTCFullYear(), view.getUTCMonth() - 1, 1));
        render();
      }
    });

    root.querySelector("[data-cal-next]").addEventListener("click", () => {
      view = new Date(Date.UTC(view.getUTCFullYear(), view.getUTCMonth() + 1, 1));
      render();
    });

    render();
    loadAvailability().then(render);
  }

  /* ---- boot -------------------------------------------------------------- */

  function boot() {
    initTheme();
    initNav();
    initFlash();
    initStayCalendar();
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
