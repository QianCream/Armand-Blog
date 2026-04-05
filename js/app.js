const header = document.querySelector(".site-header");
const reveals = document.querySelectorAll(".reveal");
const yearNode = document.querySelector("#year");
const themeMeta = document.querySelector('meta[name="theme-color"]');
const interactiveCards = document.querySelectorAll(
  ".hero-copy, .profile-card, .article-card, .work-card, .stack-item, .article-block, .article-note, .article-stage, .article-quote",
);
const curlSurfaces = document.querySelectorAll(
  ".hero-copy, .profile-card, .intro-panel, .article-card, .work-card, .stack-item, .hero-terminal",
);
const interactiveElements = document.querySelectorAll(
  ".button, .brand, .nav-links a, .theme-toggle, .section-tags span",
);
const tiltTags = document.querySelectorAll(
  ".hero-lines span, .section-tags span",
);
const workCards = document.querySelectorAll(".work-card");
const staggerTargets = document.querySelectorAll(".hero-copy h1, .section-heading h2, .article-title");
const sections = document.querySelectorAll("main section[id]");
const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
const githubFeed = document.querySelector("[data-github-feed]");
const markdownArticle = document.querySelector("[data-markdown-source]");
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

  // Most Aethe examples were fenced as `scala`; fall back to a language
  // with similar token patterns if Scala support is unavailable in the browser bundle.
  if (language === "scala") {
    return "scala";
  }

  return language;
};

const highlightCodeBlocks = (container) => {
  if (!window.hljs || !container) {
    return;
  }

  container.querySelectorAll("pre code").forEach((block) => {
    const className = Array.from(block.classList).find((name) => name.startsWith("language-")) || "";
    const requestedLanguage = className.replace(/^language-/, "");
    const source = block.textContent || "";
    const fallbackLanguages = ["scala", "kotlin", "javascript", "python", "bash", "cpp"];

    try {
      if (requestedLanguage && window.hljs.getLanguage(requestedLanguage)) {
        block.innerHTML = window.hljs.highlight(source, { language: requestedLanguage }).value;
        block.classList.add("hljs");
        return;
      }

      block.innerHTML = window.hljs.highlightAuto(source, fallbackLanguages).value;
      block.classList.add("hljs");
    } catch (error) {
      block.textContent = source;
      block.classList.add("hljs");
    }
  });
};

const isMarkdownTableRow = (line) => /^\s*\|.+\|\s*$/.test(line);

const isMarkdownTableSeparator = (line) => {
  if (!isMarkdownTableRow(line)) {
    return false;
  }

  const cells = line.trim().slice(1, -1).split("|").map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

const splitMarkdownTableRow = (line) => line
  .trim()
  .slice(1, -1)
  .split("|")
  .map((cell) => cell.trim());

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

    if (
      isMarkdownTableRow(line)
      && index + 1 < lines.length
      && isMarkdownTableSeparator(lines[index + 1])
    ) {
      const headers = splitMarkdownTableRow(line);
      index += 2;
      const rows = [];

      while (index < lines.length && isMarkdownTableRow(lines[index])) {
        rows.push(splitMarkdownTableRow(lines[index]));
        index += 1;
      }

      html.push(`<div class="article-table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${applyInlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${applyInlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
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

const formatGithubDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const summarizeGithubEvent = (event) => {
  const repo = event.repo?.name || "unknown/repo";
  const createdAt = formatGithubDate(event.created_at);

  if (event.type === "PushEvent") {
    const commits = event.payload?.commits || [];
    const latestCommit = commits[commits.length - 1];
    const sha = latestCommit?.sha || event.payload?.head || "";
    const commitCount = event.payload?.size || commits.length || 0;

    return {
      badge: "commit",
      repo,
      time: createdAt,
      title: latestCommit?.message || `Push to ${repo.split("/").pop()}`,
      detail: commitCount > 1 ? `本次推送包含 ${commitCount} 个提交` : "最新提交已同步到 GitHub",
      code: sha ? sha.slice(0, 7) : "HEAD",
      url: sha ? `https://github.com/${repo}/commit/${sha}` : `https://github.com/${repo}`,
    };
  }

  if (event.type === "PullRequestEvent") {
    const pullRequest = event.payload?.pull_request;

    return {
      badge: "pull request",
      repo,
      time: createdAt,
      title: pullRequest?.title || "Updated pull request",
      detail: `PR ${event.payload?.action || "updated"}`,
      code: pullRequest?.number ? `#${pullRequest.number}` : "PR",
      url: pullRequest?.html_url || `https://github.com/${repo}/pulls`,
    };
  }

  if (event.type === "IssuesEvent") {
    const issue = event.payload?.issue;

    return {
      badge: "issue",
      repo,
      time: createdAt,
      title: issue?.title || "Updated issue",
      detail: `Issue ${event.payload?.action || "updated"}`,
      code: issue?.number ? `#${issue.number}` : "ISSUE",
      url: issue?.html_url || `https://github.com/${repo}/issues`,
    };
  }

  if (event.type === "CreateEvent") {
    const refType = event.payload?.ref_type || "repository";
    const refName = event.payload?.ref || repo;

    return {
      badge: "create",
      repo,
      time: createdAt,
      title: `Created ${refType}: ${refName}`,
      detail: "新的 GitHub 实体已创建",
      code: String(refType).toUpperCase(),
      url: `https://github.com/${repo}`,
    };
  }

  if (event.type === "ReleaseEvent") {
    const release = event.payload?.release;

    return {
      badge: "release",
      repo,
      time: createdAt,
      title: release?.name || release?.tag_name || "Published release",
      detail: "发布了新的版本",
      code: release?.tag_name || "REL",
      url: release?.html_url || `https://github.com/${repo}/releases`,
    };
  }

  return null;
};

const renderGithubContribution = (item, index) => `<a class="github-item" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer" style="--github-index:${index};">
    <div class="github-item-rail">
      <span class="github-item-dot" aria-hidden="true"></span>
      <span class="github-item-time">${escapeHtml(item.time)}</span>
    </div>
    <div class="github-item-card">
      <div class="github-item-meta">
        <span class="github-item-badge">${escapeHtml(item.badge)}</span>
        <span class="github-item-repo">${escapeHtml(item.repo)}</span>
        ${item.code ? `<span class="github-item-code">${escapeHtml(item.code)}</span>` : ""}
      </div>
      <div class="github-item-copy">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.detail)}</p>
      </div>
    </div>
  </a>`;

const loadGithubContributions = async () => {
  if (!githubFeed) {
    return;
  }

  if (githubFeed.querySelector(".github-list")) {
    return;
  }

  const username = githubFeed.dataset.githubUser;

  if (!username) {
    return;
  }

  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=12`);

    if (!response.ok) {
      throw new Error(`Failed to load GitHub events: ${response.status}`);
    }

    const events = await response.json();
    const items = events
      .map(summarizeGithubEvent)
      .filter(Boolean)
      .slice(0, 4);
    const repoCount = new Set(items.map((item) => item.repo)).size;
    const latestType = items[0]?.badge || "activity";

    if (!items.length) {
      githubFeed.innerHTML = `<p class="github-feed-status">最近没有读取到公开贡献。</p>`;
      return;
    }

    githubFeed.innerHTML = `<div class="github-feed-head">
        <a class="github-profile-link" href="https://github.com/${encodeURIComponent(username)}" target="_blank" rel="noreferrer">@${escapeHtml(username)}</a>
        <div class="github-summary-chips">
          <span>${items.length} events</span>
          <span>${repoCount} repos</span>
          <span>latest ${escapeHtml(latestType)}</span>
        </div>
      </div>
      <div class="github-list">${items.map((item, index) => renderGithubContribution(item, index)).join("")}</div>`;
  } catch (error) {
    githubFeed.innerHTML = `<p class="github-feed-status">GitHub 贡献加载失败。</p>`;
    console.error(error);
  }
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
syncActiveSection();
window.addEventListener("scroll", syncHeaderState, { passive: true });
window.addEventListener("scroll", syncActiveSection, { passive: true });
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

      element.classList.remove("is-pressed");
      void element.offsetWidth;
      element.classList.add("is-pressed");
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
  const readingNode = document.querySelector(".article-reading-time");
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

    if (readingNode) {
      const plainText = body
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/\$\$[\s\S]*?\$\$/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/!\[([^\]]*)]\(([^)]+)\)/g, "$1")
        .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
        .replace(/[#>*_\-\d.]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const cjkCharacters = (plainText.match(/[\u3400-\u9fff]/g) || []).length;
      const latinWords = (plainText.match(/[A-Za-z0-9_+-]+/g) || []).length;
      const readMinutes = Math.max(1, Math.round((cjkCharacters + latinWords) / 260));

      readingNode.textContent = `${readMinutes} min read`;
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

    highlightCodeBlocks(markdownArticle);

    if (window.MathJax?.typesetPromise) {
      await window.MathJax.typesetPromise([markdownArticle]);
    }

    generateArticleToc(markdownArticle, meta);
    addCodeCopyButtons(markdownArticle);
  } catch (error) {
    markdownArticle.innerHTML = `<p>Markdown 加载失败，请检查内容文件路径。</p>`;
    console.error(error);
  }
};

const commentsRoot = document.querySelector("[data-comments-root]");

const resolveCommentsApiBase = () => {
  if (typeof window.__COMMENTS_API_BASE__ === "string" && window.__COMMENTS_API_BASE__.trim()) {
    return window.__COMMENTS_API_BASE__.trim().replace(/\/+$/, "");
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:8787";
  }

  return "";
};

const buildCommentsApiUrl = (pathname) => `${resolveCommentsApiBase()}${pathname}`;

const formatCommentDate = (value) => {
  if (!value) {
    return "";
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const initComments = () => {
  if (!commentsRoot) {
    return;
  }

  const articleSlug = commentsRoot.dataset.articleSlug;
  const statusNode = commentsRoot.querySelector("[data-comments-status]");
  const listNode = commentsRoot.querySelector("[data-comments-list]");
  const formNode = commentsRoot.querySelector("[data-comments-form]");
  const countNode = commentsRoot.querySelector("[data-comments-count]");

  if (!articleSlug || !statusNode || !listNode || !formNode || !countNode) {
    return;
  }

  const submitButton = formNode.querySelector("[type='submit']");

  const setStatus = (text) => {
    statusNode.textContent = text;
  };

  const renderComments = (comments) => {
    countNode.textContent = comments.length.toString();
    listNode.innerHTML = "";

    if (!comments.length) {
      setStatus("还没有评论，来做第一个留言的人吧。");
      return;
    }

    setStatus(`共 ${comments.length} 条评论`);
    comments.forEach((comment) => {
      const item = document.createElement("article");
      item.className = "comment-item";
      item.innerHTML = `
        <div class="comment-meta">
          <strong>${escapeHtml(comment.author || "匿名")}</strong>
          <time>${escapeHtml(formatCommentDate(comment.createdAt))}</time>
        </div>
        <p>${escapeHtml(comment.content || "")}</p>
      `;
      listNode.appendChild(item);
    });
  };

  const fetchComments = async () => {
    setStatus("加载评论中...");

    try {
      const response = await fetch(`${buildCommentsApiUrl("/api/comments")}?article=${encodeURIComponent(articleSlug)}`);

      if (!response.ok) {
        throw new Error(`Load comments failed: ${response.status}`);
      }

      const payload = await response.json();
      renderComments(Array.isArray(payload.comments) ? payload.comments : []);
    } catch (error) {
      setStatus("评论加载失败，请稍后刷新重试。");
      console.error(error);
    }
  };

  formNode.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(formNode);
    const author = String(formData.get("author") || "").trim();
    const content = String(formData.get("content") || "").trim();

    if (!author || !content) {
      setStatus("昵称和评论内容不能为空。");
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "提交中...";
    }

    try {
      const response = await fetch(buildCommentsApiUrl("/api/comments"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleSlug,
          author,
          content,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const retryTip = payload.retryAfter ? `请 ${payload.retryAfter} 秒后再试。` : "请稍后重试。";
        throw new Error(payload.error ? `${payload.error} ${retryTip}` : retryTip);
      }

      formNode.reset();
      setStatus("评论发布成功。");
      await fetchComments();
    } catch (error) {
      setStatus(`评论发布失败：${error.message || "未知错误"}`);
      console.error(error);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "发布评论";
      }
    }
  });

  fetchComments();
};

staggerTargets.forEach((node) => applyStaggerText(node));
loadMarkdownArticle();
loadGithubContributions();
initComments();

if (!prefersReducedMotion.matches && finePointer.matches) {
  const updateSpotlight = (node, event) => {
    const rect = node.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * 100;
    const py = ((event.clientY - rect.top) / rect.height) * 100;

    node.style.setProperty("--spotlight-x", `${px}%`);
    node.style.setProperty("--spotlight-y", `${py}%`);
  };

  const bindControlMotion = (element) => {
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const moveX = (px - 0.5) * 8;
      const moveY = (py - 0.5) * 6;

      updateSpotlight(element, event);
      element.style.transform = `perspective(900px) translate3d(${moveX}px, ${moveY}px, 0) rotateX(${(0.5 - py) * 4}deg) rotateY(${(px - 0.5) * 6}deg)`;
    });

    element.addEventListener("pointerleave", () => {
      element.style.transform = "";
    });
  };

  interactiveCards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      updateSpotlight(card, event);
    });

    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });

  curlSurfaces.forEach((surface) => {
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
      surface.style.transform = "";
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

  interactiveElements.forEach((element) => bindControlMotion(element));
  bindControlMotion(themeToggle);

  tiltTags.forEach((element) => {
    if (element.closest("#articles, .article-page, .panel-head")) {
      return;
    }

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
  });

  workCards.forEach((card) => {
    const cover = card.querySelector(".work-cover");

    if (!cover) {
      return;
    }

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
  });

  // ── Smooth 3D Return ──────────────────────────────────────
  curlSurfaces.forEach((surface) => {
    surface.addEventListener("pointermove", () => {
      surface.classList.remove("is-settling");
    });

    surface.addEventListener("pointerleave", () => {
      surface.classList.add("is-settling");
      window.setTimeout(() => surface.classList.remove("is-settling"), 420);
    });
  });
}

// ── Console Banner ────────────────────────────────────────────
console.log(
  "%c  ARMAND.DEV  ────────────────────────────────────────\n"
  + "  build · write · ship   C++ · compilers · graphics\n"
  + "  ────────────────────────────────────────────────────\n"
  + "  github.com/QianCream\n",
  "color:#2f6bff;font-family:'IBM Plex Mono',monospace;line-height:1.7;font-size:11px;"
);
console.log(
  "%c  open source, built from scratch — inspect away :)",
  "color:#0ca678;font-family:'IBM Plex Mono',monospace;font-size:10px;"
);

// ── Scroll Progress Bar ───────────────────────────────────────
const scrollProgressBar = document.querySelector(".scroll-progress");
if (scrollProgressBar) {
  const updateScrollProgress = () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const pct = total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0;
    scrollProgressBar.style.width = `${pct.toFixed(2)}%`;
  };

  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  updateScrollProgress();
}

// ── Hero Terminal Typing Animation ────────────────────────────
const animateHeroTerminal = () => {
  if (prefersReducedMotion.matches) {
    return;
  }

  const terminalBody = document.querySelector(".hero-terminal .terminal-body");

  if (!terminalBody) {
    return;
  }

  const lines = Array.from(terminalBody.querySelectorAll("p"));
  const lineData = lines.map((line) => {
    const spans = Array.from(line.querySelectorAll("span"));
    const valueSpan = spans[spans.length - 1];

    if (!valueSpan || spans.length < 2) {
      return null;
    }

    const text = valueSpan.textContent.replace(/_$/, "");
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

animateHeroTerminal();

// ── Command Palette ───────────────────────────────────────────
const initCmdPalette = () => {
  const getItems = () => [
    {
      tag: "home",
      name: "Home",
      hint: "scroll to top",
      action() {
        const el = document.querySelector("#top");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
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
        const el = document.querySelector("#articles");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
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
        const el = document.querySelector("#intro");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
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
        const el = document.querySelector("#works");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
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
        themeToggle.click();
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

  let backdropEl = null;
  let activeIndex = 0;
  let currentFiltered = [];

  const filterItems = (query) => {
    const q = query.toLowerCase();
    return getItems().filter(
      (item) => !q || item.name.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q),
    );
  };

  const renderList = (list, query) => {
    currentFiltered = filterItems(query);
    list.innerHTML = "";

    currentFiltered.forEach((item, i) => {
      const el = document.createElement("div");
      el.className = `cmd-item${i === activeIndex ? " is-selected" : ""}`;
      el.setAttribute("role", "option");
      el.innerHTML = `
        <span class="cmd-item-tag">${escapeHtml(item.tag)}</span>
        <div class="cmd-item-body">
          <div class="cmd-item-name">${escapeHtml(item.name)}</div>
          <div class="cmd-item-hint">${escapeHtml(item.hint)}</div>
        </div>
        <span class="cmd-item-arrow">→</span>
      `;
      el.addEventListener("click", () => {
        item.action();
        closeCmd();
      });
      list.appendChild(el);
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

    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, currentFiltered.length - 1);
        renderList(list, input.value);
        list.children[activeIndex]?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        renderList(list, input.value);
        list.children[activeIndex]?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        currentFiltered[activeIndex]?.action();
        closeCmd();
      } else if (e.key === "Escape") {
        closeCmd();
      }
    });

    backdropEl.addEventListener("click", (e) => {
      if (e.target === backdropEl) {
        closeCmd();
      }
    });
  };

  const closeCmd = () => {
    if (!backdropEl) {
      return;
    }

    backdropEl.remove();
    backdropEl = null;
  };

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();

      if (backdropEl) {
        closeCmd();
      } else {
        openCmd();
      }
    }
  });
};

initCmdPalette();

// ── Article TOC ───────────────────────────────────────────────
function generateArticleToc(container, meta) {
  if (!container) {
    return;
  }

  const prose = container.querySelector(".article-prose");

  if (!prose) {
    return;
  }

  const headings = Array.from(prose.querySelectorAll("h2, h3"));

  // Add IDs to headings for anchor links
  headings.forEach((h, i) => {
    if (!h.id) {
      h.id = `s${i + 1}`;
    }
  });

  // TOC: only render if there are enough sections
  if (headings.length >= 3) {
    const toc = document.createElement("nav");
    toc.className = "article-toc reveal";
    toc.setAttribute("aria-label", "目录");

    const header = document.createElement("div");
    header.className = "toc-header";
    header.innerHTML = `<span>目录</span><span class="toc-count">${headings.length} 节</span>`;

    const list = document.createElement("ol");
    list.className = "toc-list";

    headings.forEach((h) => {
      const item = document.createElement("li");
      item.className = `toc-item toc-${h.tagName.toLowerCase()}`;
      const link = document.createElement("a");
      link.href = `#${h.id}`;
      link.textContent = h.textContent;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        h.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      item.appendChild(link);
      list.appendChild(item);
    });

    toc.append(header, list);

    const articleContent = document.querySelector(".article-content");

    if (articleContent) {
      articleContent.parentNode.insertBefore(toc, articleContent);

      // Trigger reveal observer for the new element
      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
          ([entry], obs) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              obs.unobserve(entry.target);
            }
          },
          { threshold: 0.1 },
        );
        observer.observe(toc);
      } else {
        toc.classList.add("is-visible");
      }
    }

    // Highlight active section on scroll
    const tocLinks = Array.from(toc.querySelectorAll(".toc-item a"));
    const updateActive = () => {
      const line = window.innerHeight * 0.28;
      let activeId = headings[0]?.id;

      headings.forEach((h) => {
        if (h.getBoundingClientRect().top <= line) {
          activeId = h.id;
        }
      });

      tocLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${activeId}`);
      });
    };

    window.addEventListener("scroll", updateActive, { passive: true });
    updateActive();
  }

}

// ── Copy Code Buttons ─────────────────────────────────────────
function addCodeCopyButtons(container) {
  if (!container) {
    return;
  }

  container.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector(".code-copy-btn")) {
      return;
    }

    const btn = document.createElement("button");
    btn.className = "code-copy-btn";
    btn.textContent = "copy";
    btn.setAttribute("aria-label", "Copy code to clipboard");
    btn.setAttribute("type", "button");

    btn.addEventListener("click", async () => {
      const code = pre.querySelector("code")?.textContent ?? "";

      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = "✓ copied";
        btn.classList.add("is-copied");
        window.setTimeout(() => {
          btn.textContent = "copy";
          btn.classList.remove("is-copied");
        }, 1800);
      } catch {
        btn.textContent = "failed";
        window.setTimeout(() => {
          btn.textContent = "copy";
        }, 1200);
      }
    });

    pre.appendChild(btn);
  });
}
