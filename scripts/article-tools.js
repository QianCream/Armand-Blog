const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(ROOT_DIR, "articles");
const INDEX_PATH = path.join(ROOT_DIR, "index.html");
const GENERATED_START = "<!-- ARTICLES:GENERATED:START -->";
const GENERATED_END = "<!-- ARTICLES:GENERATED:END -->";
const DEFAULT_AUTHOR = "Armand";
const DEFAULT_AUTHOR_ROLE = "armand.dev";
const DEFAULT_AVATAR = "../img/avatar.jpeg";

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

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

const stripMarkdown = (value) => value
  .replace(/```[\s\S]*?```/g, " ")
  .replace(/\$\$[\s\S]*?\$\$/g, " ")
  .replace(/`([^`]+)`/g, "$1")
  .replace(/!\[([^\]]*)]\(([^)]+)\)/g, "$1")
  .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/^>\s?/gm, "")
  .replace(/^[-*+]\s+/gm, "")
  .replace(/^\d+\.\s+/gm, "")
  .replace(/[*_~]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const extractSummary = (body) => {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    if (paragraph.startsWith("#") || paragraph.startsWith("```") || paragraph === "$$") {
      continue;
    }

    const text = stripMarkdown(paragraph);

    if (text) {
      return text.slice(0, 84);
    }
  }

  return "待补充摘要。";
};

const createSlug = (title, fallbackDate = new Date().toISOString().slice(0, 10)) => {
  const normalized = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized) {
    return normalized;
  }

  return `article-${fallbackDate.replace(/-/g, "")}`;
};

const uniqueSlug = (desiredSlug) => {
  let slug = desiredSlug;
  let counter = 2;

  while (
    fs.existsSync(path.join(ARTICLES_DIR, `${slug}.md`))
    || fs.existsSync(path.join(ARTICLES_DIR, `${slug}.html`))
  ) {
    slug = `${desiredSlug}-${counter}`;
    counter += 1;
  }

  return slug;
};

const readMarkdownArticles = () => {
  const files = fs.readdirSync(ARTICLES_DIR)
    .filter((file) => file.endsWith(".md"))
    .sort();

  return files
    .map((file) => {
      const slug = file.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), "utf8");
      const { meta, body } = parseFrontMatter(raw);
      const title = meta.title || slug;
      const description = meta.description || extractSummary(body);
      const summary = meta.summary || description;
      const date = meta.date || "";

      return {
        slug,
        title,
        description,
        summary,
        date,
        author: meta.author || DEFAULT_AUTHOR,
        authorRole: meta.author_role || DEFAULT_AUTHOR_ROLE,
        avatar: meta.avatar || DEFAULT_AVATAR,
      };
    })
    .sort((left, right) => right.date.localeCompare(left.date) || left.slug.localeCompare(right.slug));
};

const renderArticlePage = (article) => `<!doctype html>
<html lang="zh-CN">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(article.title)} | Armand's Blog</title>
  <meta name="description" content="${escapeHtml(article.description)}">
  <meta name="theme-color" content="#f0f2f5">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap"
    rel="stylesheet">
  <link rel="stylesheet" href="../css/style.css">
  <link rel="icon" href="../favicon.png" type="image/png" sizes="64x64">
  <link rel="icon" href="../icon.png" type="image/png" sizes="192x192">
  <link rel="apple-touch-icon" href="../apple-touch-icon.png">
  <link rel="manifest" href="../site.webmanifest">
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [["$", "$"], ["\\\\(", "\\\\)"]],
        displayMath: [["$$", "$$"], ["\\\\[", "\\\\]"]],
      },
      svg: {
        fontCache: "global",
      },
    };
  </script>
  <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
  <script defer src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js"></script>
</head>

<body>
  <div class="page-shell">
    <main class="article-page">
      <div class="container article-shell">
        <header class="article-top reveal">
          <a class="article-back" href="../index.html#articles">← back</a>
          <div class="article-author">
            <img class="article-author-avatar" data-article-avatar src="${escapeHtml(article.avatar)}" alt="${escapeHtml(article.author)} avatar">
            <div class="article-author-copy">
              <strong data-article-author>${escapeHtml(article.author)}</strong>
              <span data-article-author-role>${escapeHtml(article.authorRole)}</span>
            </div>
          </div>
          <div class="article-meta-row">
            <span class="article-date" data-article-date${article.date ? "" : " hidden"}>${escapeHtml(article.date)}</span>
            <span class="article-format" data-article-format>Markdown</span>
          </div>
          <h1 class="article-title" data-article-title>${escapeHtml(article.title)}</h1>
        </header>
        <article class="article-content reveal reveal-delay" data-markdown-source="./${escapeHtml(article.slug)}.md">
          <p class="article-loading">Loading markdown...</p>
        </article>
      </div>
    </main>
  </div>

  <script defer src="../js/app.js"></script>
</body>

</html>
`;

const renderArticleCard = (article, index) => `            <a class="article-card article-card-${index === 0 ? "featured" : "stack"} reveal collapse-reveal" href="articles/${escapeHtml(article.slug)}.html">
              <div class="panel-head">
                <span class="article-meta">${String(index + 1).padStart(2, "0")}</span>
                <span class="panel-index">A${index + 1}</span>
              </div>
              <span class="article-card-date">${escapeHtml(article.date || "undated")}</span>
              <h3>${escapeHtml(article.title)}</h3>
              <p>${escapeHtml(article.summary)}</p>
            </a>`;

const syncGeneratedArticles = () => {
  const articles = readMarkdownArticles();

  articles.forEach((article) => {
    const htmlPath = path.join(ARTICLES_DIR, `${article.slug}.html`);
    fs.writeFileSync(htmlPath, renderArticlePage(article), "utf8");
  });

  const indexHtml = fs.readFileSync(INDEX_PATH, "utf8");
  const generatedCards = articles.map(renderArticleCard).join("\n");

  if (!indexHtml.includes(GENERATED_START) || !indexHtml.includes(GENERATED_END)) {
    throw new Error("Missing article generation markers in index.html");
  }

  const updatedIndex = indexHtml.replace(
    new RegExp(`${GENERATED_START}[\\s\\S]*?${GENERATED_END}`),
    `${GENERATED_START}\n${generatedCards}\n            ${GENERATED_END}`,
  );

  fs.writeFileSync(INDEX_PATH, updatedIndex, "utf8");

  return articles;
};

module.exports = {
  ARTICLES_DIR,
  DEFAULT_AUTHOR,
  DEFAULT_AUTHOR_ROLE,
  DEFAULT_AVATAR,
  createSlug,
  extractSummary,
  syncGeneratedArticles,
  uniqueSlug,
};
