const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const themeStorageKey = "theme-preference";

const pressableSelector = [
  ".brand",
  ".nav-links a",
  ".button",
  ".section-tags span",
  ".panel-label",
  ".panel-index",
  ".article-meta",
  ".work-meta",
  ".article-card",
  ".work-card",
  ".stack-item",
  ".theme-toggle",
  ".article-back",
  ".comment-reply-btn",
  ".comment-like-btn",
  ".comment-inline-reply-submit",
  ".comment-inline-reply-cancel",
].join(", ");

let revealObserver = null;
let globalListenersBound = false;
let themeToggleButton = null;
let themeToggleValue = null;
let currentTheme = null;

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const getRevealObserver = () => {
  if (!("IntersectionObserver" in window)) {
    return null;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.18,
        rootMargin: "0px 0px -6% 0px",
      },
    );
  }

  return revealObserver;
};

const observeRevealNodes = (root = document) => {
  const nodes = root instanceof Element
    ? [root, ...root.querySelectorAll(".reveal")]
    : Array.from(document.querySelectorAll(".reveal"));
  const observer = getRevealObserver();

  nodes.forEach((node) => {
    if (!(node instanceof Element) || !node.classList.contains("reveal")) {
      return;
    }

    if (node.dataset.revealObserved === "true") {
      return;
    }

    node.dataset.revealObserved = "true";

    if (observer) {
      observer.observe(node);
      return;
    }

    node.classList.add("is-visible");
  });
};

const attachPressFeedback = (elements) => {
  if (prefersReducedMotion.matches) {
    return;
  }

  elements.forEach((element) => {
    if (!(element instanceof HTMLElement) || element.dataset.pressFeedbackBound === "true") {
      return;
    }

    element.dataset.pressFeedbackBound = "true";
    element.classList.add("has-press-feedback");

    const clearPressedState = () => {
      window.setTimeout(() => {
        element.classList.remove("is-pressed");
      }, 110);
    };

    element.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary) {
        return;
      }

      element.classList.remove("is-pressed");
      void element.offsetWidth;
      element.classList.add("is-pressed");
    });

    element.addEventListener("pointerup", clearPressedState);
    element.addEventListener("pointercancel", clearPressedState);
    element.addEventListener("pointerleave", clearPressedState);
  });
};

export const applyStaggerText = (node) => {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  const text = node.textContent ?? "";

  if (!text.trim() || node.dataset.staggerApplied === "true") {
    return;
  }

  const fragment = document.createDocumentFragment();
  node.textContent = "";
  node.classList.add("stagger-text");
  node.dataset.staggerApplied = "true";

  Array.from(text).forEach((char, index) => {
    const span = document.createElement("span");

    span.className = char === " " ? "stagger-char is-space" : "stagger-char";
    span.style.setProperty("--i", index.toString());
    span.textContent = char === " " ? "\u00a0" : char;
    fragment.appendChild(span);
  });

  node.appendChild(fragment);
};

const createThemeToggle = () => {
  if (themeToggleButton && themeToggleValue) {
    return { button: themeToggleButton, value: themeToggleValue };
  }

  const existing = document.querySelector(".theme-toggle");

  if (existing) {
    themeToggleButton = existing;
    themeToggleValue = existing.querySelector(".theme-toggle-value");
    return { button: themeToggleButton, value: themeToggleValue };
  }

  const button = document.createElement("button");
  const label = document.createElement("span");
  const value = document.createElement("span");

  button.type = "button";
  button.className = "theme-toggle";
  button.setAttribute("aria-label", "toggle theme");

  label.className = "theme-toggle-label";
  label.textContent = "theme";

  value.className = "theme-toggle-value";
  button.append(label, value);
  document.body.appendChild(button);

  themeToggleButton = button;
  themeToggleValue = value;

  return { button, value };
};

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem(themeStorageKey);

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return systemTheme.matches ? "dark" : "light";
};

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;

  if (themeToggleValue) {
    themeToggleValue.textContent = theme;
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]');

  if (themeMeta) {
    themeMeta.setAttribute("content", theme === "dark" ? "#081321" : "#edf3fb");
  }
};

const ensureThemeToggle = () => {
  const { button } = createThemeToggle();

  if (button.dataset.themeBound === "true") {
    return button;
  }

  currentTheme = getInitialTheme();
  applyTheme(currentTheme);
  attachPressFeedback([button]);

  button.dataset.themeBound = "true";
  button.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem(themeStorageKey, currentTheme);
    applyTheme(currentTheme);
  });

  systemTheme.addEventListener("change", (event) => {
    if (localStorage.getItem(themeStorageKey)) {
      return;
    }

    currentTheme = event.matches ? "dark" : "light";
    applyTheme(currentTheme);
  });

  return button;
};

const syncHeaderState = () => {
  const header = document.querySelector(".site-header");

  if (!header) {
    return;
  }

  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

const syncActiveSection = () => {
  const sections = document.querySelectorAll("main section[id]");
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  if (!sections.length || !navLinks.length) {
    return;
  }

  const triggerLine = window.innerHeight * 0.32;
  let activeId = sections[0].id;

  sections.forEach((section) => {
    const rect = section.getBoundingClientRect();

    if (rect.top <= triggerLine) {
      activeId = section.id;
    }
  });

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const isActive = href === `#${activeId}` || (activeId === "top" && href === "#top");
    link.classList.toggle("is-active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  sections.forEach((section) => {
    section.classList.toggle("is-active-section", section.id === activeId);
  });
};

const updateScrollProgress = () => {
  const bar = document.querySelector(".scroll-progress");

  if (!bar) {
    return;
  }

  const total = document.documentElement.scrollHeight - window.innerHeight;
  const pct = total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0;
  bar.style.width = `${pct.toFixed(2)}%`;
};

const bindControlMotion = (element) => {
  if (!(element instanceof HTMLElement) || element.dataset.controlMotionBound === "true") {
    return;
  }

  element.dataset.controlMotionBound = "true";
  element.addEventListener("pointermove", (event) => {
    const rect = element.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const moveX = (px - 0.5) * 8;
    const moveY = (py - 0.5) * 6;

    element.style.setProperty("--spotlight-x", `${px * 100}%`);
    element.style.setProperty("--spotlight-y", `${py * 100}%`);
    element.style.transform = `perspective(900px) translate3d(${moveX}px, ${moveY}px, 0) rotateX(${(0.5 - py) * 4}deg) rotateY(${(px - 0.5) * 6}deg)`;
  });

  element.addEventListener("pointerleave", () => {
    element.style.transform = "";
  });
};

const bindInteractiveCard = (card) => {
  if (!(card instanceof HTMLElement) || card.dataset.cardMotionBound === "true") {
    return;
  }

  card.dataset.cardMotionBound = "true";
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * 100;
    const py = ((event.clientY - rect.top) / rect.height) * 100;

    card.style.setProperty("--spotlight-x", `${px}%`);
    card.style.setProperty("--spotlight-y", `${py}%`);
  });

  card.addEventListener("pointerleave", () => {
    card.style.transform = "";
  });
};

const bindCurlSurface = (surface) => {
  if (!(surface instanceof HTMLElement) || surface.dataset.curlSurfaceBound === "true") {
    return;
  }

  surface.dataset.curlSurfaceBound = "true";
  surface.classList.add("has-curl-surface");

  surface.addEventListener("pointermove", (event) => {
    const rect = surface.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const moveX = (px - 0.5) * 10;
    const moveY = (py - 0.5) * 8;
    const rotateY = (px - 0.5) * 12;
    const rotateX = (0.5 - py) * 10;
    const skewX = (px - 0.5) * -4;
    const skewY = (py - 0.5) * 2.5;

    surface.classList.add("is-curling");
    surface.style.transform = `perspective(1400px) translate3d(${moveX}px, ${moveY}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg) skewX(${skewX}deg) skewY(${skewY}deg) scale(1.01)`;
  });

  surface.addEventListener("pointerleave", () => {
    surface.classList.remove("is-curling");
    surface.classList.add("is-settling");
    surface.style.transform = "";
    window.setTimeout(() => surface.classList.remove("is-settling"), 420);
  });
};

const bindHeroCopy = (heroCopy) => {
  if (!(heroCopy instanceof HTMLElement) || heroCopy.dataset.heroMotionBound === "true") {
    return;
  }

  heroCopy.dataset.heroMotionBound = "true";
  heroCopy.addEventListener("pointermove", (event) => {
    const rect = heroCopy.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const shiftX = (px - 0.5) * 22;
    const shiftY = (py - 0.5) * 18;

    heroCopy.style.setProperty("--hero-shift-x", shiftX.toFixed(2));
    heroCopy.style.setProperty("--hero-shift-y", shiftY.toFixed(2));
  });

  heroCopy.addEventListener("pointerleave", () => {
    heroCopy.style.removeProperty("--hero-shift-x");
    heroCopy.style.removeProperty("--hero-shift-y");
  });
};

const bindTiltTag = (element) => {
  if (!(element instanceof HTMLElement) || element.dataset.tiltTagBound === "true") {
    return;
  }

  if (element.closest("#articles, .article-page, .panel-head")) {
    return;
  }

  element.dataset.tiltTagBound = "true";
  element.addEventListener("pointermove", (event) => {
    const rect = element.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const moveX = (px - 0.5) * 10;
    const moveY = (py - 0.5) * 8;
    const rotateY = (px - 0.5) * 26;
    const rotateX = (0.5 - py) * 22;

    element.style.transform = `perspective(900px) translate3d(${moveX}px, ${moveY}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });

  element.addEventListener("pointerleave", () => {
    element.style.transform = "";
  });
};

const bindWorkCard = (card) => {
  if (!(card instanceof HTMLElement) || card.dataset.workMotionBound === "true") {
    return;
  }

  const cover = card.querySelector(".work-cover");

  if (!(cover instanceof HTMLElement)) {
    return;
  }

  card.dataset.workMotionBound = "true";
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const shiftX = (px - 0.5) * -18;
    const shiftY = (py - 0.5) * -12;

    cover.style.setProperty("--cover-shift-x", `${shiftX.toFixed(2)}px`);
    cover.style.setProperty("--cover-shift-y", `${shiftY.toFixed(2)}px`);
  });

  card.addEventListener("pointerleave", () => {
    cover.style.removeProperty("--cover-shift-x");
    cover.style.removeProperty("--cover-shift-y");
  });
};

const bindPointerEffects = () => {
  if (prefersReducedMotion.matches || !finePointer.matches) {
    return;
  }

  document.querySelectorAll(".hero-copy, .profile-card, .article-card, .work-card, .stack-item, .article-block, .article-note, .article-stage, .article-quote").forEach(bindInteractiveCard);
  document.querySelectorAll(".hero-copy, .profile-card, .intro-panel, .article-card, .work-card, .stack-item, .hero-terminal").forEach(bindCurlSurface);
  document.querySelectorAll(".button, .brand, .nav-links a, .theme-toggle, .section-tags span").forEach(bindControlMotion);
  document.querySelectorAll(".hero-lines span, .section-tags span").forEach(bindTiltTag);
  document.querySelectorAll(".work-card").forEach(bindWorkCard);
  bindHeroCopy(document.querySelector(".hero-copy"));
};

const animateHeroTerminal = () => {
  if (prefersReducedMotion.matches) {
    return;
  }

  const terminalBody = document.querySelector(".hero-terminal .terminal-body");

  if (!(terminalBody instanceof HTMLElement) || terminalBody.dataset.typed === "true") {
    return;
  }

  terminalBody.dataset.typed = "true";
  const lines = Array.from(terminalBody.querySelectorAll("p"));
  const lineData = lines.map((line) => {
    const spans = Array.from(line.querySelectorAll("span"));
    const valueSpan = spans[spans.length - 1];

    if (!valueSpan || spans.length < 2) {
      return null;
    }

    const text = (valueSpan.textContent || "").replace(/_$/, "");
    valueSpan.textContent = "";
    return { valueSpan, text };
  }).filter(Boolean);

  let lineIndex = 0;

  const typeNextLine = () => {
    if (lineIndex >= lineData.length) {
      return;
    }

    const { valueSpan, text } = lineData[lineIndex];
    let charIndex = 0;

    const interval = window.setInterval(() => {
      charIndex += 1;
      valueSpan.textContent = text.slice(0, charIndex);

      if (charIndex >= text.length) {
        window.clearInterval(interval);
        lineIndex += 1;
        window.setTimeout(typeNextLine, 130);
      }
    }, 30);
  };

  window.setTimeout(typeNextLine, 900);
};

const logConsoleBanner = () => {
  if (document.documentElement.dataset.consoleBannerLogged === "true") {
    return;
  }

  document.documentElement.dataset.consoleBannerLogged = "true";
  console.log(
    "%c  ARMAND.DEV  ────────────────────────────────────────\n"
      + "  build · write · ship   C++ · compilers · graphics\n"
      + "  ────────────────────────────────────────────────────\n"
      + "  github.com/QianCream\n",
    "color:#2f6bff;font-family:'IBM Plex Mono',monospace;line-height:1.7;font-size:11px;",
  );
  console.log(
    "%c  open source, built from scratch - inspect away :)",
    "color:#0ca678;font-family:'IBM Plex Mono',monospace;font-size:10px;",
  );
};

const initCmdPalette = () => {
  if (document.documentElement.dataset.cmdPaletteBound === "true") {
    return;
  }

  document.documentElement.dataset.cmdPaletteBound = "true";
  let backdropEl = null;
  let activeIndex = 0;
  let currentFiltered = [];

  const getItems = () => [
    {
      tag: "home",
      name: "Home",
      hint: "scroll to top",
      action() {
        const element = document.querySelector("#top");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        } else {
          window.location.href = "/";
        }
      },
    },
    {
      tag: "art",
      name: "Articles",
      hint: "#articles · 文章列表",
      action() {
        const element = document.querySelector("#articles");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        } else {
          window.location.href = "/#articles";
        }
      },
    },
    {
      tag: "who",
      name: "Intro",
      hint: "#intro · 关于",
      action() {
        const element = document.querySelector("#intro");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        } else {
          window.location.href = "/#intro";
        }
      },
    },
    {
      tag: "work",
      name: "Works",
      hint: "#works · 作品集",
      action() {
        const element = document.querySelector("#works");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        } else {
          window.location.href = "/#works";
        }
      },
    },
    {
      tag: "gh",
      name: "GitHub Profile",
      hint: "github.com/QianCream",
      action() {
        window.open("https://github.com/QianCream", "_blank", "noreferrer");
      },
    },
    {
      tag: "◑",
      name: "Toggle Theme",
      hint: `switch to ${currentTheme === "dark" ? "light" : "dark"}`,
      action() {
        ensureThemeToggle().click();
      },
    },
    {
      tag: "rss",
      name: "RSS Feed",
      hint: "feed.xml · subscribe",
      action() {
        window.open("/feed.xml", "_blank");
      },
    },
  ];

  const filterItems = (query) => {
    const normalized = query.toLowerCase();
    return getItems().filter(
      (item) => !normalized || item.name.toLowerCase().includes(normalized) || item.hint.toLowerCase().includes(normalized),
    );
  };

  const closeCmd = () => {
    if (!backdropEl) {
      return;
    }

    backdropEl.remove();
    backdropEl = null;
  };

  const renderList = (list, query) => {
    currentFiltered = filterItems(query);
    list.innerHTML = "";

    currentFiltered.forEach((item, index) => {
      const element = document.createElement("div");
      element.className = `cmd-item${index === activeIndex ? " is-selected" : ""}`;
      element.setAttribute("role", "option");
      element.innerHTML = `
        <span class="cmd-item-tag">${escapeHtml(item.tag)}</span>
        <div class="cmd-item-body">
          <div class="cmd-item-name">${escapeHtml(item.name)}</div>
          <div class="cmd-item-hint">${escapeHtml(item.hint)}</div>
        </div>
        <span class="cmd-item-arrow">→</span>
      `;
      element.addEventListener("click", () => {
        item.action();
        closeCmd();
      });
      list.appendChild(element);
    });
  };

  const openCmd = () => {
    if (backdropEl) {
      return;
    }

    activeIndex = 0;
    backdropEl = document.createElement("div");
    backdropEl.className = "cmd-backdrop";
    backdropEl.setAttribute("role", "dialog");
    backdropEl.setAttribute("aria-modal", "true");
    backdropEl.setAttribute("aria-label", "Command Palette");

    const palette = document.createElement("div");
    palette.className = "cmd-palette";

    const inputRow = document.createElement("div");
    inputRow.className = "cmd-input-row";

    const prompt = document.createElement("span");
    prompt.className = "cmd-prompt-char";
    prompt.textContent = "$";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "cmd-input";
    input.placeholder = "type a command or search...";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");

    const escKey = document.createElement("span");
    escKey.className = "cmd-esc-key";
    escKey.textContent = "esc";

    inputRow.append(prompt, input, escKey);

    const list = document.createElement("div");
    list.className = "cmd-list";
    list.setAttribute("role", "listbox");

    const footer = document.createElement("div");
    footer.className = "cmd-footer";
    footer.innerHTML = `
      <span class="cmd-footer-hint"><kbd>↑↓</kbd> navigate</span>
      <span class="cmd-footer-hint"><kbd>↵</kbd> select</span>
      <span class="cmd-footer-hint"><kbd>⌘K</kbd> toggle</span>
    `;

    palette.append(inputRow, list, footer);
    backdropEl.appendChild(palette);
    document.body.appendChild(backdropEl);
    renderList(list, "");
    window.setTimeout(() => input.focus(), 20);

    input.addEventListener("input", () => {
      activeIndex = 0;
      renderList(list, input.value);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, currentFiltered.length - 1);
        renderList(list, input.value);
        list.children[activeIndex]?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        renderList(list, input.value);
        list.children[activeIndex]?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter") {
        currentFiltered[activeIndex]?.action();
        closeCmd();
      } else if (event.key === "Escape") {
        closeCmd();
      }
    });

    backdropEl.addEventListener("click", (event) => {
      if (event.target === backdropEl) {
        closeCmd();
      }
    });
  };

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "k") {
      event.preventDefault();

      if (backdropEl) {
        closeCmd();
      } else {
        openCmd();
      }
    }
  });
};

export const refreshDynamicNodes = (root = document.body) => {
  if (!(root instanceof Element) && root !== document.body) {
    return;
  }

  observeRevealNodes(root);
  attachPressFeedback((root instanceof Element ? root : document.body).querySelectorAll(pressableSelector));

  if (root instanceof Element && root.matches(".reveal")) {
    observeRevealNodes(root);
  }
};

export const initSiteEffects = () => {
  ensureThemeToggle();
  refreshDynamicNodes(document.body);
  document.querySelectorAll(".hero-copy h1, .section-heading h2, .article-title").forEach((node) => applyStaggerText(node));
  bindPointerEffects();
  animateHeroTerminal();
  logConsoleBanner();
  initCmdPalette();
  syncHeaderState();
  syncActiveSection();
  updateScrollProgress();

  if (!globalListenersBound) {
    globalListenersBound = true;
    window.addEventListener("scroll", syncHeaderState, { passive: true });
    window.addEventListener("scroll", syncActiveSection, { passive: true });
    window.addEventListener("resize", syncActiveSection, { passive: true });
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
  }
};
