if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

let heroPlayIntro = () => {};

let heroArriveAtHash = () => false;

const NAV_FLAG = "sc-internal-nav";

function consumeInternalNavFlag() {
  try {
    const flag = sessionStorage.getItem(NAV_FLAG) === "1";
    sessionStorage.removeItem(NAV_FLAG);
    return flag;
  } catch {
    return false;
  }
}

const cameFromInternalNav = consumeInternalNavFlag();

window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  const loaderLogo = document.querySelector(".loader-logo");
  const content = document.getElementById("content");
  if (!loader || !loaderLogo || !content) return;

  const MIN_DISPLAY_TIME = cameFromInternalNav ? 300 : 1200;
  const EXIT_DURATION = 700;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  setTimeout(() => {
    loader.classList.add("loader-hidden");
    loaderLogo.style.animation = "none";
    content.classList.add("content-visible");
    if (!heroArriveAtHash()) heroPlayIntro();

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

(() => {
  const header = document.querySelector(".site-header");
  const hero = document.getElementById("hero");
  const heroBrand = document.getElementById("heroBrand");
  const heroIcon = document.getElementById("heroIcon");
  const heroText = document.getElementById("heroText");
  const scrollCue = document.getElementById("scrollCue");

  if (!hero || !heroIcon || !heroText) return;

  const root = document.documentElement;
  const DURATION = 1500;

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

  const REDUCE_MOTION_COST =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  const ICON_MAX_SCALE = REDUCE_MOTION_COST ? 5 : 10;
  const ICON_MAX_BLUR = REDUCE_MOTION_COST ? 10 : 26;
  const LETTER_MAX_BLUR = REDUCE_MOTION_COST ? 0 : 8;

  const letterState = letters.map(() => ({ opacity: null, filter: null }));
  const iconState = { transform: null, filter: null, opacity: null };

  function applyMotion(progress) {
    const slideX = mapClamp(progress, 0, 0.38, 0, slideDistance);

    letters.forEach((letter, i) => {
      const start = mapClamp(i, 0, letters.length - 1, 0.04, 0.34);
      const end = start + 0.07;
      const hidden = mapClamp(progress, start, end, 0, 1);
      const st = letterState[i];

      const opacity = 1 - hidden;
      if (opacity !== st.opacity) {
        letter.style.opacity = opacity;
        st.opacity = opacity;
      }

      if (LETTER_MAX_BLUR > 0) {
        const filter = `blur(${hidden * LETTER_MAX_BLUR}px)`;
        if (filter !== st.filter) {
          letter.style.filter = filter;
          st.filter = filter;
        }
      }
    });

    const scale = mapClamp(progress, 0.38, 0.62, 1, ICON_MAX_SCALE);
    const iconBlur = mapClamp(progress, 0.38, 0.65, 0, ICON_MAX_BLUR);
    const iconOpacity = mapClamp(progress, 0.5, 0.68, 1, 0);

    const transform = `translateX(${slideX}px) scale(${scale})`;
    if (transform !== iconState.transform) {
      heroIcon.style.transform = transform;
      iconState.transform = transform;
    }
    const filter = `blur(${iconBlur}px)`;
    if (filter !== iconState.filter) {
      heroIcon.style.filter = filter;
      iconState.filter = filter;
    }
    if (iconOpacity !== iconState.opacity) {
      heroIcon.style.opacity = iconOpacity;
      iconState.opacity = iconOpacity;
    }
  }

  let lastBg = null;
  let lastFg = null;
  let lastNavInvert = null;

  function applyTheme(progress) {
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

  const HERO_COLLAPSE_DELAY = 850;
  const HERO_COLLAPSE_DURATION = 650;

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
  let state = "closed";
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

  heroArriveAtHash = function arriveAtHash() {
    const hash = window.location.hash;
    if (hash !== "#about" && hash !== "#contact") return false;
    const target = document.querySelector(hash);
    if (!target) return false;

    state = "open";
    currentProgress = 1;
    if (scrollCue) scrollCue.classList.add("scroll-cue--hidden");

    hero.style.transition = "none";
    root.style.setProperty("--hero-scale", "0");
    applyProgress(1);
    void hero.offsetHeight;
    hero.style.transition = "";

    const headerH =
      parseFloat(getComputedStyle(root).getPropertyValue("--header-h")) || 0;
    const y = target.getBoundingClientRect().top + window.scrollY - headerH;
    window.scrollTo(0, Math.max(y, 0));
    return true;
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

(() => {
  const COUNT_DURATION = 1800;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function formatValue(value, decimals, prefix, suffix) {
    let num;
    if (decimals > 0) {
      num = value.toFixed(decimals).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    } else {
      num = Math.round(value).toLocaleString("en-US");
    }
    return `${prefix}${num}${suffix}`;
  }

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

(() => {
  const SPREAD_MS = 700;

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

(() => {
  if (!("scrollTo" in window)) return;

  const EASE = 0.12;
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  let targetY = window.scrollY;
  let currentY = window.scrollY;
  let ticking = false;

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
      if (e.defaultPrevented || e.ctrlKey) return;

      if (!ticking) {
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

(() => {
  const EXIT_MS = 380;

  function isInternalPageLink(link) {
    if (link.target && link.target !== "_self") return false;
    if (link.hasAttribute("download")) return false;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return false;

    const normalise = (p) => p.replace(/\.html$/, "").replace(/\/index$/, "/");
    return normalise(url.pathname) !== normalise(window.location.pathname);
  }

  function leaveTo(href) {
    const overlay = document.createElement("div");
    overlay.className = "page-exit";
    overlay.innerHTML = '<img src="icons/logo.png" alt="" class="page-exit-logo">';
    document.body.appendChild(overlay);

    try {
      sessionStorage.setItem(NAV_FLAG, "1");
    } catch {
    }

    requestAnimationFrame(() => overlay.classList.add("is-active"));
    setTimeout(() => {
      window.location.href = href;
    }, EXIT_MS);
  }

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const link = e.target.closest("a[href]");
    if (!link || !isInternalPageLink(link)) return;

    e.preventDefault();
    leaveTo(link.href);
  });

  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    document.querySelectorAll(".page-exit").forEach((el) => el.remove());
  });
})();

(() => {
  const infos = document.querySelectorAll(".game-info");
  if (!infos.length) return;

  function closeAll(except) {
    infos.forEach((el) => {
      if (el !== except) el.classList.remove("is-open");
    });
  }

  infos.forEach((info) => {
    info.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAll(info);
      info.classList.toggle("is-open");
    });

    info.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      closeAll(info);
      info.classList.toggle("is-open");
    });
  });

  document.addEventListener("click", () => closeAll(null));
})();
