// The browser restoring scroll position on refresh conflicts with the
// hero's own open/closed state machine (which assumes it always starts at
// the top, closed). Force every load to start fresh at the top instead.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

// Set by the hero toggle module below; triggers the same star-slide/text-reveal
// animation used for the scroll toggle, played once as the loader hands off.
let heroPlayIntro = () => {};

window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  const loaderLogo = document.querySelector(".loader-logo");
  const content = document.getElementById("content");
  const MIN_DISPLAY_TIME = 1200;
  const EXIT_DURATION = 700;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  setTimeout(() => {
    loader.classList.add("loader-hidden");
    loaderLogo.style.animation = "none";
    content.classList.add("content-visible");
    heroPlayIntro();

    const start = performance.now();

    function step(now) {
      const t = Math.min((now - start) / EXIT_DURATION, 1);
      const eased = easeInOutCubic(t);

      loader.style.opacity = 1 - eased;
      loaderLogo.style.transform = `scale(${1 + eased * 0.2})`;
      loaderLogo.style.opacity = 1 - eased;
      loaderLogo.style.filter = `blur(${eased * 6}px)`;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        loader.remove();
      }
    }

    requestAnimationFrame(step);
  }, MIN_DISPLAY_TIME);
});

/* ---------- Hero toggle transition ---------- */
/* One scroll/swipe gesture plays the whole animation; the opposite gesture undoes it. */

(() => {
  const header = document.querySelector(".site-header");
  const hero = document.getElementById("hero");
  const heroBrand = document.getElementById("heroBrand");
  const heroIcon = document.getElementById("heroIcon");
  const heroText = document.getElementById("heroText");
  const scrollCue = document.getElementById("scrollCue");

  if (!hero || !heroIcon || !heroText) return;

  const root = document.documentElement;
  const DURATION = 1500; // ms, slow and deliberate

  // Build one span per character so each letter can blur/hide individually.
  const text = heroText.getAttribute("data-text") || heroText.textContent;
  heroText.textContent = "";
  const letters = [...text].map((char) => {
    const span = document.createElement("span");
    span.className = "letter";
    span.textContent = char === " " ? " " : char;
    heroText.appendChild(span);
    return span;
  });

  let slideDistance = 0;

  function measure() {
    root.style.setProperty("--header-h", `${header.offsetHeight}px`);

    // Read the icon's natural (untransformed) box, since by the time this
    // re-runs (on load/resize) it may already be mid-animation and scaled.
    const prevTransform = heroIcon.style.transform;
    heroIcon.style.transform = "none";
    const brandRect = heroBrand.getBoundingClientRect();
    const iconRect = heroIcon.getBoundingClientRect();
    heroIcon.style.transform = prevTransform;

    const brandCenterX = brandRect.left + brandRect.width / 2;
    const iconCenterX = iconRect.left + iconRect.width / 2;
    slideDistance = brandCenterX - iconCenterX;
  }

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  function mapClamp(v, inMin, inMax, outMin, outMax) {
    const t = clamp((v - inMin) / (inMax - inMin), 0, 1);
    return outMin + (outMax - outMin) * t;
  }

  function lerpColor(t) {
    const v = Math.round(mapClamp(t, 0, 1, 0, 255));
    return `rgb(${v}, ${v}, ${v})`;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // filter: blur() on an element being scaled up 10x means the browser has
  // to blur a huge rasterized surface every frame — desktop GPUs shrug this
  // off, phones don't. Touch/coarse-pointer devices get a noticeably
  // cheaper (but still very much "expand and blur into a flash") version:
  // less scale (area, and so blur cost, drops with the square of it), less
  // blur radius, same easing/timing/opacity — same effect, lighter render.
  const REDUCE_MOTION_COST =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  const ICON_MAX_SCALE = REDUCE_MOTION_COST ? 6 : 10;
  const ICON_MAX_BLUR = REDUCE_MOTION_COST ? 14 : 26;
  const LETTER_MAX_BLUR = REDUCE_MOTION_COST ? 5 : 8;

  // Icon slide/scale/blur + letters blur-out — purely cosmetic motion, no
  // color/theme changes. Shared by the real toggle and the intro replay.
  function applyMotion(progress) {
    // Phase 1 (0 -> 0.38): star slides across the text, letters blur out in sequence.
    const slideX = mapClamp(progress, 0, 0.38, 0, slideDistance);

    letters.forEach((letter, i) => {
      const start = mapClamp(i, 0, letters.length - 1, 0.04, 0.34);
      const end = start + 0.07;
      const hidden = mapClamp(progress, start, end, 0, 1);
      letter.style.opacity = 1 - hidden;
      letter.style.filter = `blur(${hidden * LETTER_MAX_BLUR}px)`;
    });

    // Phase 2 (0.38 -> 0.7): star expands and blurs into a soft flash, then fades.
    const scale = mapClamp(progress, 0.38, 0.62, 1, ICON_MAX_SCALE);
    const iconBlur = mapClamp(progress, 0.38, 0.65, 0, ICON_MAX_BLUR);
    const iconOpacity = mapClamp(progress, 0.5, 0.68, 1, 0);

    heroIcon.style.transform = `translateX(${slideX}px) scale(${scale})`;
    heroIcon.style.filter = `blur(${iconBlur}px)`;
    heroIcon.style.opacity = iconOpacity;
  }

  // Background/text color crossfade + hero collapse — the actual toggle
  // functionality. Only used by the real scroll/swipe gesture, never the intro.
  //
  // --bg/--fg feed color-mix() in dozens of places across the whole page
  // (every card border/background, nav links, etc.), so writing them to
  // :root forces a big style recalculation each time. lerpColor() already
  // rounds to whole 0-255 steps, so plenty of consecutive frames produce the
  // exact same string — skip the write (and the recalc) on those frames.
  // Same visual result, far fewer forced recalcs.
  let lastBg = null;
  let lastFg = null;
  let lastNavInvert = null;

  function applyTheme(progress) {
    // Background fades black -> white on a broad curve; text flips white -> black
    // on a short, steep curve so it crosses the low-contrast midpoint quickly
    // instead of hanging there invisible.
    const bgT = mapClamp(progress, 0.4, 0.68, 0, 1);
    const fgT = mapClamp(progress, 0.5, 0.56, 0, 1);

    const bg = lerpColor(bgT);
    const fg = lerpColor(1 - fgT);
    const navInvert = fgT.toFixed(3);

    if (bg !== lastBg) {
      root.style.setProperty("--bg", bg);
      lastBg = bg;
    }
    if (fg !== lastFg) {
      root.style.setProperty("--fg", fg);
      lastFg = fg;
    }
    if (navInvert !== lastNavInvert) {
      root.style.setProperty("--nav-invert", navInvert);
      lastNavInvert = navInvert;
    }
  }

  // Collapsing the hero out of the way (so the stats section lands right
  // under the nav) used to be driven by writing --hero-scale on every
  // animation frame, which forces a real layout reflow of the hero and
  // everything below it each time — ~30 forced reflows over the course of
  // the toggle, competing with the icon/color work on the same frame
  // budget. Set once per gesture instead and let a native CSS transition
  // (see .hero in style.css) do the actual smooth interpolation — same
  // timing, none of the per-frame JS/layout cost.
  const HERO_COLLAPSE_DELAY = 850; // ms — roughly when eased progress crosses 0.68 while opening
  const HERO_COLLAPSE_DURATION = 650; // ms

  function setHeroCollapse(collapsed) {
    hero.style.transitionDelay = collapsed ? `${HERO_COLLAPSE_DELAY}ms` : "0ms";
    hero.style.transitionDuration = `${HERO_COLLAPSE_DURATION}ms`;
    root.style.setProperty("--hero-scale", collapsed ? "0" : "1");
  }

  function applyProgress(progress) {
    applyMotion(progress);
    applyTheme(progress);
  }

  let currentProgress = 0;
  let state = "closed"; // "closed" -> black landing, "open" -> white revealed
  let animating = false;

  function animateTo(target) {
    animating = true;
    const from = currentProgress;
    const distance = target - from;
    const start = performance.now();

    function step(now) {
      const t = clamp((now - start) / DURATION, 0, 1);
      currentProgress = from + distance * easeInOutCubic(t);
      applyProgress(currentProgress);

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        currentProgress = target;
        applyProgress(currentProgress);
        animating = false;
      }
    }

    requestAnimationFrame(step);
  }

  function handleGestureDown() {
    if (animating || state !== "closed") return;
    state = "open";
    if (scrollCue) scrollCue.classList.add("scroll-cue--hidden");
    setHeroCollapse(true);
    animateTo(1);
  }

  function handleGestureUp() {
    if (animating || state !== "open") return;
    state = "closed";
    if (scrollCue) scrollCue.classList.remove("scroll-cue--hidden");
    setHeroCollapse(false);
    animateTo(0);
  }

  // Nav links (and the stats CTA) point at real sections below the hero via
  // #hash anchors. A native anchor jump bypasses this whole module entirely
  // (no wheel/touch event fires), teleporting the page while the black/white
  // toggle never actually plays. Intercept those clicks and route them
  // through the same open animation, then scroll once it's done.
  function scrollToTarget(target) {
    const headerH =
      parseFloat(getComputedStyle(root).getPropertyValue("--header-h")) || 0;
    const y = target.getBoundingClientRect().top + window.scrollY - headerH;
    window.scrollTo({ top: Math.max(y, 0), behavior: "smooth" });
  }

  document.querySelectorAll('a[href="#about"], a[href="#contact"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;

      e.preventDefault();

      if (state === "closed" && !animating) {
        handleGestureDown();
        setTimeout(() => scrollToTarget(target), DURATION + 50);
      } else if (state === "open" && !animating) {
        scrollToTarget(target);
      }
    });
  });

  // Intro replay: same slide/scale/blur motion, played once on load — but
  // motion only. Background stays black throughout; doesn't touch
  // currentProgress/state, so the real toggle is untouched and still starts
  // fresh from "closed".
  const INTRO_DURATION = 1300;

  heroPlayIntro = function playIntro() {
    const start = performance.now();

    function step(now) {
      const t = clamp((now - start) / INTRO_DURATION, 0, 1);
      applyMotion(1 - easeInOutCubic(t));

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        applyMotion(0);
      }
    }

    requestAnimationFrame(step);
  };

  window.addEventListener(
    "wheel",
    (e) => {
      if (animating) {
        e.preventDefault();
        return;
      }
      if (state === "closed" && e.deltaY > 0) {
        e.preventDefault();
        handleGestureDown();
      } else if (state === "open" && e.deltaY < 0 && window.scrollY <= 1) {
        e.preventDefault();
        handleGestureUp();
      }
    },
    { passive: false }
  );

  let touchStartY = null;
  const TOUCH_THRESHOLD = 30;

  window.addEventListener(
    "touchstart",
    (e) => {
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (touchStartY === null || animating) return;
      const deltaY = touchStartY - e.touches[0].clientY;

      // Browsers decide whether a touch gesture is a native scroll on its
      // very first touchmove — if preventDefault isn't called right then,
      // it commits to scrolling and ignores preventDefault on every later
      // event in the same gesture. So claim it as soon as direction is
      // known, and only gate the actual trigger behind the threshold.
      if (state === "closed" && deltaY > 0) {
        e.preventDefault();
        if (deltaY >= TOUCH_THRESHOLD) {
          handleGestureDown();
          touchStartY = null;
        }
      } else if (state === "open" && deltaY < 0 && window.scrollY <= 1) {
        e.preventDefault();
        if (-deltaY >= TOUCH_THRESHOLD) {
          handleGestureUp();
          touchStartY = null;
        }
      }
    },
    { passive: false }
  );

  window.addEventListener("touchend", () => {
    touchStartY = null;
  });

  window.addEventListener("load", () => {
    measure();
    applyProgress(currentProgress);
  });
  window.addEventListener("resize", () => {
    measure();
    applyProgress(currentProgress);
  });

  measure();
  applyProgress(currentProgress);
})();

/* ---------- Stat counters ---------- */
/* Count up to the target once, the first time it scrolls into view. */

(() => {
  const COUNT_DURATION = 1800;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function formatValue(value, decimals, prefix, suffix) {
    let num;
    if (decimals > 0) {
      // Trim trailing zeros (10.0 -> 10) so a fractional start value can
      // settle on a clean whole number without a dangling ".0".
      num = value.toFixed(decimals).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    } else {
      num = Math.round(value).toLocaleString("en-US");
    }
    return `${prefix}${num}${suffix}`;
  }

  // A handful of these can start on the exact same frame (e.g. every card in
  // the stats grid crossing the viewport threshold together). Driving each
  // with its own independent requestAnimationFrame chain means that many
  // separate callbacks competing on one frame — right as the page is also
  // mid-scroll — which is what made the page (and the sticky nav) stutter.
  // One shared driver loop that updates every active counter per frame
  // keeps it to a single scheduled callback no matter how many start at once.
  const active = [];
  let driving = false;

  function drive(now) {
    for (let i = active.length - 1; i >= 0; i--) {
      const c = active[i];
      const t = Math.min((now - c.start) / COUNT_DURATION, 1);
      const value = c.startValue + (c.target - c.startValue) * easeOutCubic(t);
      c.el.textContent = formatValue(value, c.decimals, c.prefix, c.suffix);

      if (t >= 1) {
        c.el.textContent = formatValue(c.target, c.decimals, c.prefix, c.suffix);
        active.splice(i, 1);
      }
    }

    if (active.length > 0) {
      requestAnimationFrame(drive);
    } else {
      driving = false;
    }
  }

  function animateCounter(el) {
    active.push({
      el,
      target: parseFloat(el.dataset.count),
      startValue: parseFloat(el.dataset.start || "0"),
      decimals: parseInt(el.dataset.decimals || "0", 10),
      prefix: el.dataset.prefix || "",
      suffix: el.dataset.suffix || "",
      start: performance.now(),
    });

    if (!driving) {
      driving = true;
      requestAnimationFrame(drive);
    }
  }

  const counters = document.querySelectorAll("[data-count]");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    counters.forEach((el) => observer.observe(el));
  } else {
    counters.forEach(animateCounter);
  }
})();

/* ---------- Letter-by-letter reveal ---------- */

(() => {
  const SPREAD_MS = 700; // total time the stagger spreads across, regardless of text length

  const targets = document.querySelectorAll(".reveal-text");

  targets.forEach((el) => {
    const text = el.textContent;
    const tokens = text.split(/(\s+)/).filter((t) => t.length);
    const totalLetters = tokens.reduce(
      (sum, t) => sum + (/^\s+$/.test(t) ? 0 : t.length),
      0
    );

    el.textContent = "";
    el.setAttribute("aria-label", text);

    const wrapper = document.createElement("span");
    wrapper.setAttribute("aria-hidden", "true");

    let letterIndex = 0;
    tokens.forEach((token) => {
      if (/^\s+$/.test(token)) {
        wrapper.appendChild(document.createTextNode(token));
        return;
      }

      const word = document.createElement("span");
      word.className = "reveal-word";

      [...token].forEach((ch) => {
        const letter = document.createElement("span");
        letter.className = "reveal-letter";
        letter.textContent = ch;
        letter.style.setProperty(
          "--rd",
          `${(letterIndex / Math.max(totalLetters - 1, 1)) * SPREAD_MS}ms`
        );
        letterIndex++;
        word.appendChild(letter);
      });

      wrapper.appendChild(word);
    });

    el.appendChild(wrapper);
  });

  // will-change hints the browser to promote each letter to its own
  // compositor layer *before* the transition starts, avoiding extra paint
  // work from the burst of simultaneously-animating letters. Only kept on
  // for the ~1.2s the reveal is actually active (see .reveal-done in CSS) —
  // leaving it on permanently for every letter on the page, forever, would
  // waste GPU memory instead of saving work.
  function reveal(el) {
    el.classList.add("reveal-in");
    setTimeout(() => el.classList.add("reveal-done"), 1300);
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    targets.forEach((el) => observer.observe(el));
  } else {
    targets.forEach(reveal);
  }
})();

/* ---------- Why Us line draw-in ---------- */

(() => {
  const whyUs = document.querySelector(".why-us");
  if (!whyUs) return;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            whyUs.classList.add("line-in");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(whyUs);
  } else {
    whyUs.classList.add("line-in");
  }
})();

/* ---------- About CTA reveal ---------- */
/* Fades/rises in once the heading is in view; its CSS transition-delay is
   tuned to land just after the heading's own letter-by-letter reveal finishes. */

(() => {
  const cta = document.querySelector(".about-cta");
  if (!cta) return;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            cta.classList.add("cta-in");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(cta);
  } else {
    cta.classList.add("cta-in");
  }
})();

/* ---------- Smooth scroll momentum ---------- */
/* Real window.scrollTo under the hood (so sticky header + IntersectionObservers
   keep working normally) — just eased toward the target instead of jumping the
   full wheel delta instantly, for a smoother/heavier scroll feel. Skips any
   wheel event the hero toggle already claimed (checked via defaultPrevented),
   so it never fights with the open/close gesture. */

(() => {
  if (!("scrollTo" in window)) return;

  const EASE = 0.12;
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  let targetY = window.scrollY;
  let currentY = window.scrollY;
  let ticking = false;

  // Reading scrollHeight forces a synchronous layout recalculation — doing
  // that on every single wheel event (as this used to) gets steadily more
  // expensive as the page's DOM grows (each reveal-text animation leaves
  // 100+ letter <span>s behind permanently), which is what made scrolling
  // feel laggier the longer you'd been on the page. Cache it instead and
  // only recompute when the page's actual height can have changed.
  let cachedMax = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);

  function refreshMaxScrollY() {
    cachedMax = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
  }

  window.addEventListener("resize", refreshMaxScrollY);
  window.addEventListener("load", refreshMaxScrollY);

  if ("ResizeObserver" in window) {
    new ResizeObserver(refreshMaxScrollY).observe(document.body);
  }

  let lastApplied = -1;

  function raf() {
    currentY += (targetY - currentY) * EASE;

    if (Math.abs(targetY - currentY) < 0.75) {
      currentY = targetY;
    }

    // Skip redundant scrollTo calls when rounding lands on the same pixel
    // as last frame — cuts a lot of no-op scroll/layout work off the long
    // tail of the easing curve, where the delta is fractions of a pixel.
    const rounded = Math.round(currentY);
    if (rounded !== lastApplied) {
      window.scrollTo(0, rounded);
      lastApplied = rounded;
    }

    if (currentY !== targetY) {
      requestAnimationFrame(raf);
    } else {
      ticking = false;
    }
  }

  window.addEventListener(
    "wheel",
    (e) => {
      // The hero toggle already handled this gesture (open/close swipe).
      if (e.defaultPrevented || e.ctrlKey) return;

      if (!ticking) {
        // Resync in case the user scrolled by keyboard/anchor-jump since
        // the last wheel-driven momentum sequence ended.
        targetY = window.scrollY;
        currentY = window.scrollY;
      }

      e.preventDefault();
      targetY = clamp(targetY + e.deltaY, 0, cachedMax);

      if (!ticking) {
        ticking = true;
        requestAnimationFrame(raf);
      }
    },
    { passive: false }
  );
})();
