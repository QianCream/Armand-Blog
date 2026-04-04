const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(ROOT_DIR, "articles");
const INDEX_PATH = path.join(ROOT_DIR, "index.html");
const SITEMAP_PATH = path.join(ROOT_DIR, "sitemap.xml");
const FEED_PATH = path.join(ROOT_DIR, "feed.xml");
const GENERATED_START = "<!-- ARTICLES:GENERATED:START -->";
const GENERATED_END = "<!-- ARTICLES:GENERATED:END -->";
const DEFAULT_AUTHOR = "Armand";
const DEFAULT_AUTHOR_ROLE = "armand.dev";
const DEFAULT_AVATAR = "../img/avatar.jpeg";
const SITE_URL = "https://armand.dev";
const BASE_KEYWORDS = [
  "Armand",
  "技术博客",
  "C++",
  "图形",
  "语言设计",
  "编程语言",
];

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const escapeJsonForHtml = (value) => JSON.stringify(value, null, 2)
  .replace(/</g, "\\u003c");

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

const estimateReadingMinutes = (body) => {
  const plainText = stripMarkdown(body);
  const cjkCharacters = (plainText.match(/[\u3400-\u9fff]/g) || []).length;
  const latinWords = (plainText.match(/[A-Za-z0-9_+-]+/g) || []).length;
  const readingUnits = cjkCharacters + latinWords;

  return Math.max(1, Math.round(readingUnits / 260));
};

const countSections = (body) => (body.match(/^#{1,4}\s+/gm) || []).length;

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

const uniq = (values) => Array.from(new Set(values.filter(Boolean)));

const joinUrl = (base, pathname) => `${base.replace(/\/$/, "")}${pathname}`;

const toPublishedTime = (date) => (date ? `${date}T00:00:00+08:00` : "");

const toRfc822Date = (date) => {
  if (!date) {
    return new Date().toUTCString();
  }

  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toUTCString();
};

const toAbsoluteAssetUrl = (assetPath) => {
  if (!assetPath) {
    return `${SITE_URL}/img/avatar.jpeg`;
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }

  return joinUrl(SITE_URL, `/${assetPath.replace(/^(\.\.\/|\.\/)+/, "")}`);
};

const buildArticleKeywords = (article) => {
  const keywords = [...BASE_KEYWORDS, article.title];
  const topicText = `${article.title} ${article.description}`;

  if (/Aethe/i.test(topicText)) {
    keywords.push("Aethe", "Aethe 2", "语言参考", "教程", "管道语言");
  }

  if (/F\+\+/i.test(topicText)) {
    keywords.push("F++");
  }

  if (/FreeWorld/i.test(topicText)) {
    keywords.push("FreeWorld");
  }

  if (/Perlin|Noise|噪声/i.test(topicText)) {
    keywords.push("Perlin Noise", "柏林噪声", "地形生成");
  }

  return uniq(keywords).join(", ");
};

const renderHomeStructuredData = () => escapeJsonForHtml([
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Armand's Blog",
    url: `${SITE_URL}/`,
    inLanguage: "zh-CN",
    description: "记录 Aethe、F++、FreeWorld 等项目开发，以及 C++、图形、语言设计和技术文章。",
    author: {
      "@type": "Person",
      name: DEFAULT_AUTHOR,
      url: `${SITE_URL}/`,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Person",
    name: DEFAULT_AUTHOR,
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/img/avatar.jpeg`,
    sameAs: [
      "https://github.com/QianCream",
    ],
  },
]);

const renderArticleStructuredData = (article) => escapeJsonForHtml({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: article.title,
  description: article.description,
  url: `${SITE_URL}/articles/${article.slug}.html`,
  mainEntityOfPage: `${SITE_URL}/articles/${article.slug}.html`,
  inLanguage: "zh-CN",
  image: toAbsoluteAssetUrl(article.avatar),
  datePublished: toPublishedTime(article.date),
  dateModified: toPublishedTime(article.date),
  timeRequired: `PT${article.readMinutes}M`,
  author: {
    "@type": "Person",
    name: article.author,
    url: `${SITE_URL}/`,
  },
  publisher: {
    "@type": "Person",
    name: article.author,
    image: toAbsoluteAssetUrl(article.avatar),
  },
});

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
      const format = meta.format || "Markdown";
      const readMinutes = estimateReadingMinutes(body);
      const sectionCount = countSections(body);

      return {
        slug,
        title,
        description,
        summary,
        date,
        format,
        readMinutes,
        sectionCount,
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
  <meta name="keywords" content="${escapeHtml(buildArticleKeywords(article))}">
  <meta name="author" content="${escapeHtml(article.author)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${SITE_URL}/articles/${escapeHtml(article.slug)}.html">
  <meta property="og:title" content="${escapeHtml(article.title)} | Armand's Blog">
  <meta property="og:description" content="${escapeHtml(article.description)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Armand's Blog">
  <meta property="og:url" content="${SITE_URL}/articles/${escapeHtml(article.slug)}.html">
  <meta property="og:image" content="${escapeHtml(toAbsoluteAssetUrl(article.avatar))}">
  <meta property="og:image:alt" content="${escapeHtml(article.author)} avatar">
  ${article.date ? `<meta property="article:published_time" content="${toPublishedTime(article.date)}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(article.title)} | Armand's Blog">
  <meta name="twitter:description" content="${escapeHtml(article.description)}">
  <meta name="twitter:image" content="${escapeHtml(toAbsoluteAssetUrl(article.avatar))}">
  <meta name="theme-color" content="#f0f2f5">
  <link rel="alternate" type="application/rss+xml" title="Armand's Blog RSS Feed" href="${SITE_URL}/feed.xml">
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
  <script type="application/ld+json">
${renderArticleStructuredData(article)}
  </script>
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
            <span class="article-format" data-article-format>${escapeHtml(article.format)}</span>
            <span class="article-reading-time">${article.readMinutes} min read</span>
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

const renderArticleSummary = (articles) => {
  const latestDate = articles[0]?.date || "undated";
  const totalReadMinutes = articles.reduce((sum, article) => sum + article.readMinutes, 0);

  return `          <div class="articles-summary panel reveal">
            <div class="articles-summary-item">
              <span class="articles-summary-label">entries</span>
              <strong>${articles.length}</strong>
            </div>
            <div class="articles-summary-item">
              <span class="articles-summary-label">latest</span>
              <strong>${escapeHtml(latestDate)}</strong>
            </div>
            <div class="articles-summary-item">
              <span class="articles-summary-label">reading</span>
              <strong>${totalReadMinutes} min</strong>
            </div>
          </div>`;
};

const renderArticleCard = (article, index) => `            <a class="article-card article-card-${index === 0 ? "featured" : "stack"} reveal collapse-reveal" href="articles/${escapeHtml(article.slug)}.html">
              <div class="panel-head">
                <span class="article-meta">${String(index + 1).padStart(2, "0")}</span>
                <span class="panel-index">A${index + 1}</span>
              </div>
              <span class="article-card-date">${escapeHtml(article.date || "undated")}</span>
              <div class="article-card-stats">
                <span>${escapeHtml(article.format)}</span>
                <span>${article.readMinutes} min read</span>
                <span>${article.sectionCount} sections</span>
              </div>
              <div class="article-card-command">
                <span class="article-card-command-prompt">$</span>
                <span class="article-card-command-text">open ./articles/${escapeHtml(article.slug)}.md</span>
              </div>
              <h3>${escapeHtml(article.title)}</h3>
              <p>${escapeHtml(article.summary)}</p>
            </a>`;

const renderSitemap = (articles) => {
  const latestDate = articles[0]?.date || new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: latestDate },
    ...articles.map((article) => ({
      loc: `${SITE_URL}/articles/${article.slug}.html`,
      lastmod: article.date || latestDate,
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((entry) => `  <url>
    <loc>${escapeHtml(entry.loc)}</loc>
    <lastmod>${escapeHtml(entry.lastmod)}</lastmod>
  </url>`).join("\n")}
</urlset>
`;
};

const renderFeed = (articles) => {
  const latestDate = toRfc822Date(articles[0]?.date);

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Armand's Blog</title>
    <link>${SITE_URL}/</link>
    <description>记录 Aethe、F++、FreeWorld 等项目开发，以及 C++、图形、语言设计和技术文章。</description>
    <language>zh-CN</language>
    <lastBuildDate>${latestDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${articles.map((article) => `    <item>
      <title>${escapeHtml(article.title)}</title>
      <link>${SITE_URL}/articles/${article.slug}.html</link>
      <guid>${SITE_URL}/articles/${article.slug}.html</guid>
      <pubDate>${toRfc822Date(article.date)}</pubDate>
      <description>${escapeHtml(article.description)}</description>
    </item>`).join("\n")}
  </channel>
</rss>
`;
};

const syncGeneratedArticles = () => {
  const articles = readMarkdownArticles();

  articles.forEach((article) => {
    const htmlPath = path.join(ARTICLES_DIR, `${article.slug}.html`);
    fs.writeFileSync(htmlPath, renderArticlePage(article), "utf8");
  });

  const indexHtml = fs.readFileSync(INDEX_PATH, "utf8");
  const summaryHtml = renderArticleSummary(articles);
  const generatedCards = articles.map(renderArticleCard).join("\n");

  if (!indexHtml.includes(GENERATED_START) || !indexHtml.includes(GENERATED_END)) {
    throw new Error("Missing article generation markers in index.html");
  }

  const updatedIndex = indexHtml.replace(
    new RegExp(`${GENERATED_START}[\\s\\S]*?${GENERATED_END}`),
    `${GENERATED_START}\n${summaryHtml}\n${generatedCards}\n            ${GENERATED_END}`,
  );

  fs.writeFileSync(INDEX_PATH, updatedIndex, "utf8");
  fs.writeFileSync(SITEMAP_PATH, renderSitemap(articles), "utf8");
  fs.writeFileSync(FEED_PATH, renderFeed(articles), "utf8");

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
