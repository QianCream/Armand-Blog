const header = document.querySelector(".site-header");
const reveals = document.querySelectorAll(".reveal");
const yearNode = document.querySelector("#year");
const themeMeta = document.querySelector('meta[name="theme-color"]');
const interactiveCards = document.querySelectorAll(
  ".hero-copy, .profile-card, .article-card, .work-card, .stack-item, .article-block, .article-note, .article-stage, .article-quote",
);
const interactiveElements = document.querySelectorAll(
  ".button, .section-tags span, .panel-index, .panel-label, .article-meta, .work-meta",
);
const staggerTargets = document.querySelectorAll(".hero-copy h1, .section-heading h2, .article-title");
const sections = document.querySelectorAll("main section[id]");
const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
const markdownArticle = document.querySelector("[data-markdown-source]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const themeStorageKey = "theme-preference";

const createScrollProgress = () => {
  const node = document.createElement("div");
  node.className = "scroll-progress";
  document.body.appendChild(node);

  return node;
};

createScrollProgress();

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
].join(", ");

const escapeHtml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const preserveMathSegments = (value) => {
  const tokens = [];
  const text = value.replace(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g, (match) => {
    const token = `__MATH_${tokens.length}__`;
    tokens.push(match);
    return token;
  });

  return { text, tokens };
};

const restoreMathSegments = (value, tokens) => tokens.reduce(
  (output, token, index) => output.replace(`__MATH_${index}__`, token),
  value,
);

const applyInlineMarkdown = (value) => {
  const { text, tokens } = preserveMathSegments(value);
  let html = escapeHtml(text);

  html = html.replace(/!\[([^\]]*)]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  return restoreMathSegments(html, tokens);
};

const parseFrontMatter = (raw) => {
  if (!raw.startsWith("---\n")) {
    return { meta: {}, body: raw };
  }

  const closingIndex = raw.indexOf("\n---", 4);

  if (closingIndex === -1) {
    return { meta: {}, body: raw };
  }

  const metaBlock = raw.slice(4, closingIndex).trim();
  const body = raw.slice(closingIndex + 4).replace(/^\n/, "");
  const meta = {};

  metaBlock.split("\n").forEach((line) => {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    meta[key] = value;
  });

  return { meta, body };
};

const normalizeCodeLanguage = (value) => {
  const language = value.toLowerCase();

  if (language === "c++") {
    return "cpp";
  }

  if (language === "c#") {
    return "csharp";
  }

  if (language === "f#") {
    return "fsharp";
  }

  return language;
};

const renderMarkdown = (markdown) => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = normalizeCodeLanguage(line.slice(3).trim());
      const codeLines = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      html.push(`<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      index += 1;
      continue;
    }

    if (line.trim() === "$$") {
      const mathLines = [];
      index += 1;

      while (index < lines.length && lines[index].trim() !== "$$") {
        mathLines.push(lines[index]);
        index += 1;
      }

      html.push(`<div class="article-math">$$\n${escapeHtml(mathLines.join("\n"))}\n$$</div>`);
      index += 1;
      continue;
    }

    if (/^\$\$[\s\S]*\$\$$/.test(line.trim())) {
      html.push(`<div class="article-math">${escapeHtml(line.trim())}</div>`);
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      html.push(`<h${level}>${applyInlineMarkdown(headingMatch[2].trim())}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      html.push("<hr>");
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];

      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }

      html.push(`<blockquote><p>${applyInlineMarkdown(quoteLines.join(" "))}</p></blockquote>`);
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items = [];

      while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
        items.push(`<li>${applyInlineMarkdown(lines[index].replace(/^[-*+]\s+/, "").trim())}</li>`);
        index += 1;
      }

      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(`<li>${applyInlineMarkdown(lines[index].replace(/^\d+\.\s+/, "").trim())}</li>`);
        index += 1;
      }

      html.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraphLines = [];

    while (index < lines.length && lines[index].trim()) {
      if (/^(#{1,4})\s+/.test(lines[index]) || /^```/.test(lines[index]) || /^>\s?/.test(lines[index]) || /^[-*+]\s+/.test(lines[index]) || /^\d+\.\s+/.test(lines[index]) || /^(-{3,}|\*{3,}|_{3,})$/.test(lines[index].trim())) {
        break;
      }

      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    if (paragraphLines.length) {
      html.push(`<p>${applyInlineMarkdown(paragraphLines.join(" "))}</p>`);
      continue;
    }

    index += 1;
  }

  return html.join("");
};

const applyStaggerText = (node) => {
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

if (yearNode) {
  yearNode.textContent = new Date().getFullYear().toString();
}

const syncHeaderState = () => {
  if (!header) {
    return;
  }

  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

const syncScrollProgress = () => {
  const scrollRange = document.documentElement.scrollHeight - window.innerHeight;

  if (scrollRange <= 0) {
    document.documentElement.style.setProperty("--scroll-progress", "0");
    return;
  }

  const progress = Math.min(Math.max(window.scrollY / scrollRange, 0), 1);
  document.documentElement.style.setProperty("--scroll-progress", progress.toFixed(4));
};

const syncActiveSection = () => {
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
    const isActive = link.getAttribute("href") === `#${activeId}` || (activeId === "top" && link.getAttribute("href") === "#top");
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

syncHeaderState();
syncScrollProgress();
syncActiveSection();
window.addEventListener("scroll", syncHeaderState, { passive: true });
window.addEventListener("scroll", syncScrollProgress, { passive: true });
window.addEventListener("scroll", syncActiveSection, { passive: true });
window.addEventListener("resize", syncScrollProgress, { passive: true });
window.addEventListener("resize", syncActiveSection, { passive: true });

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -6% 0px",
    },
  );

  reveals.forEach((node) => observer.observe(node));
} else {
  reveals.forEach((node) => node.classList.add("is-visible"));
}

const createThemeToggle = () => {
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

  return { button, value };
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

      const rect = element.getBoundingClientRect();
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      const line = document.createElement("span");

      element.classList.remove("is-pressed");
      void element.offsetWidth;
      element.classList.add("is-pressed");

      line.className = "press-feedback-line";
      line.style.setProperty("--press-line-y", `${Math.min(Math.max(y, 18), 82)}%`);
      element.appendChild(line);

      line.addEventListener("animationend", () => {
        line.remove();
      }, { once: true });
    });

    element.addEventListener("pointerup", clearPressedState);
    element.addEventListener("pointercancel", clearPressedState);
    element.addEventListener("pointerleave", clearPressedState);
  });
};

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem(themeStorageKey);

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return systemTheme.matches ? "dark" : "light";
};

const { button: themeToggle, value: themeToggleValue } = createThemeToggle();
attachPressFeedback(document.querySelectorAll(pressableSelector));
attachPressFeedback([themeToggle]);

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  themeToggleValue.textContent = theme;

  if (themeMeta) {
    themeMeta.setAttribute("content", theme === "dark" ? "#081321" : "#edf3fb");
  }
};

let currentTheme = getInitialTheme();
applyTheme(currentTheme);

themeToggle.addEventListener("click", () => {
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

const loadMarkdownArticle = async () => {
  if (!markdownArticle) {
    return;
  }

  const source = markdownArticle.dataset.markdownSource;
  const titleNode = document.querySelector("[data-article-title]");
  const dateNode = document.querySelector("[data-article-date]");
  const formatNode = document.querySelector("[data-article-format]");
  const authorNode = document.querySelector("[data-article-author]");
  const authorRoleNode = document.querySelector("[data-article-author-role]");
  const avatarNode = document.querySelector("[data-article-avatar]");

  if (!source || !titleNode) {
    return;
  }

  try {
    const response = await fetch(source);

    if (!response.ok) {
      throw new Error(`Failed to load markdown: ${response.status}`);
    }

    const raw = await response.text();
    const { meta, body } = parseFrontMatter(raw);

    titleNode.textContent = meta.title || titleNode.textContent || "Untitled";
    titleNode.classList.remove("stagger-text");
    delete titleNode.dataset.staggerApplied;
    applyStaggerText(titleNode);

    if (dateNode && meta.date) {
      dateNode.textContent = meta.date;
      dateNode.hidden = false;
    }

    if (formatNode && meta.format) {
      formatNode.textContent = meta.format;
    }

    if (authorNode && meta.author) {
      authorNode.textContent = meta.author;
    }

    if (authorRoleNode && meta.author_role) {
      authorRoleNode.textContent = meta.author_role;
    }

    if (avatarNode && meta.avatar) {
      avatarNode.src = meta.avatar;
      avatarNode.alt = `${meta.author || "Author"} avatar`;
    }

    if (meta.description) {
      const descriptionMeta = document.querySelector('meta[name="description"]');

      if (descriptionMeta) {
        descriptionMeta.setAttribute("content", meta.description);
      }
    }

    document.title = `${meta.title || titleNode.textContent} | Armand's Blog`;
    markdownArticle.innerHTML = `<div class="article-prose">${renderMarkdown(body)}</div>`;

    if (window.hljs) {
      markdownArticle.querySelectorAll("pre code").forEach((block) => {
        window.hljs.highlightElement(block);
      });
    }

    if (window.MathJax?.typesetPromise) {
      await window.MathJax.typesetPromise([markdownArticle]);
    }
  } catch (error) {
    markdownArticle.innerHTML = `<p>Markdown 加载失败，请检查内容文件路径。</p>`;
    console.error(error);
  }
};

staggerTargets.forEach((node) => applyStaggerText(node));
loadMarkdownArticle();

if (!prefersReducedMotion.matches && finePointer.matches) {
  const updateSpotlight = (node, event) => {
    const rect = node.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * 100;
    const py = ((event.clientY - rect.top) / rect.height) * 100;

    node.style.setProperty("--spotlight-x", `${px}%`);
    node.style.setProperty("--spotlight-y", `${py}%`);
  };

  interactiveCards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 8;
      const rotateX = (0.5 - py) * 8;

      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      updateSpotlight(card, event);
    });

    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });

  const heroCopy = document.querySelector(".hero-copy");

  if (heroCopy) {
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
  }

  interactiveElements.forEach((element) => {
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const moveX = (px - 0.5) * 8;
      const moveY = (py - 0.5) * 6;

      element.style.transform = `translate(${moveX}px, ${moveY}px)`;
    });

    element.addEventListener("pointerleave", () => {
      element.style.transform = "";
    });
  });

  themeToggle.addEventListener("pointermove", (event) => {
    const rect = themeToggle.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const moveX = (px - 0.5) * 6;
    const moveY = (py - 0.5) * 4;

    themeToggle.style.transform = `translate(${moveX}px, ${moveY}px)`;
  });

  themeToggle.addEventListener("pointerleave", () => {
    themeToggle.style.transform = "";
  });
}
