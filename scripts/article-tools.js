const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(ROOT_DIR, "articles");
const INDEX_PATH = path.join(ROOT_DIR, "index.html");
const ARCHIVE_INDEX_PATH = path.join(ARTICLES_DIR, "index.html");
const SITEMAP_PATH = path.join(ROOT_DIR, "sitemap.xml");
const FEED_PATH = path.join(ROOT_DIR, "feed.xml");
const DEFAULT_AUTHOR = "Armand";
const DEFAULT_AUTHOR_ROLE = "armand.dev";
const DEFAULT_AVATAR = "../img/avatar.jpeg";
const SITE_URL = "https://armand.dev";
const COMMENTS_API_BASE = process.env.COMMENTS_API_BASE || "";
const HOME_ARTICLE_LIMIT = 6;
const VUE_IMPORT_MAP = `  <script type="importmap">
{
  "imports": {
    "vue": "https://cdn.jsdelivr.net/npm/vue@3.5.32/dist/vue.esm-browser.js",
    "vue3-sfc-loader": "https://cdn.jsdelivr.net/npm/vue3-sfc-loader@0.9.5/dist/vue3-sfc-loader.esm.js"
  }
}
  </script>`;
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

const escapeInlineScriptValue = (value) => JSON.stringify(String(value))
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

const renderArchiveStructuredData = (articles) => escapeJsonForHtml({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "文章归档 | Armand's Blog",
  url: `${SITE_URL}/articles/`,
  inLanguage: "zh-CN",
  description: "Armand 博客的文章归档页，按年份收录全部文章。",
  mainEntity: {
    "@type": "ItemList",
    itemListElement: articles.slice(0, 20).map((article, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/articles/${article.slug}.html`,
      name: article.title,
    })),
  },
});

const createPageDataScript = (pageData) => `  <script id="page-data" type="application/json">
${escapeJsonForHtml(pageData)}
  </script>`;

const renderAppScript = (src) => `  <script data-site-app type="module" src="${src}"></script>`;

const renderAppMount = (pageType) => `  <div id="app" data-page="${pageType}"></div>`;

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
        year: (meta.date || "").slice(0, 4) || "undated",
      };
    })
    .sort((left, right) => right.date.localeCompare(left.date) || left.slug.localeCompare(right.slug));
};

const groupArticlesByYear = (articles) => {
  const groups = new Map();

  articles.forEach((article) => {
    const year = article.year || "undated";

    if (!groups.has(year)) {
      groups.set(year, []);
    }

    groups.get(year).push(article);
  });

  return Array.from(groups.entries()).map(([year, items]) => ({ year, items }));
};

const renderHomePage = ({ articles, homeArticles, githubFeed }) => {
  const latestDate = articles[0]?.date || "undated";
  const totalReadMinutes = articles.reduce((sum, article) => sum + article.readMinutes, 0);
  const pageData = {
    articles: homeArticles,
    articleCount: articles.length,
    latestDate,
    totalReadMinutes,
    github: {
      username: githubFeed?.username || "QianCream",
      items: Array.isArray(githubFeed?.items) ? githubFeed.items : [],
    },
  };

  return `<!doctype html>
<html class="no-js" lang="zh-CN">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Armand 的博客 | Aethe、F++、FreeWorld 与技术文章</title>
  <meta name="description" content="Armand 的个人博客，记录 Aethe、F++、FreeWorld 等项目开发，以及 C++、图形、语言设计和技术文章。">
  <meta name="keywords" content="Armand, Aethe, F++, FreeWorld, 技术博客, C++, 图形, 语言设计, 编程语言">
  <meta name="author" content="Armand">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${SITE_URL}/">
  <meta name="theme-color" content="#f0f2f5">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap"
    rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
${VUE_IMPORT_MAP}
  <meta property="og:title" content="Armand 的博客 | Aethe、F++、FreeWorld 与技术文章">
  <meta property="og:description" content="记录 Aethe、F++、FreeWorld 等项目开发，以及 C++、图形、语言设计和技术文章。">
  <meta property="og:site_name" content="Armand's Blog">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE_URL}/">
  <meta property="og:image" content="${SITE_URL}/img/avatar.jpeg">
  <meta property="og:image:alt" content="Armand avatar">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Armand 的博客 | Aethe、F++、FreeWorld 与技术文章">
  <meta name="twitter:description" content="记录 Aethe、F++、FreeWorld 等项目开发，以及 C++、图形、语言设计和技术文章。">
  <meta name="twitter:image" content="${SITE_URL}/img/avatar.jpeg">
  <link rel="alternate" type="application/rss+xml" title="Armand's Blog RSS Feed" href="${SITE_URL}/feed.xml">
  <script type="application/ld+json">
${renderHomeStructuredData()}
  </script>
  <link rel="icon" href="/favicon.png" type="image/png" sizes="64x64">
  <link rel="icon" href="/icon.png" type="image/png" sizes="192x192">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">
  <link rel="manifest" href="site.webmanifest">
</head>

<body>
${renderAppMount("home")}
${createPageDataScript(pageData)}
${renderAppScript("js/app.js")}
</body>

</html>
`;
};

const renderArchivePage = (articles) => {
  const latestDate = articles[0]?.date || "undated";
  const totalReadMinutes = articles.reduce((sum, article) => sum + article.readMinutes, 0);
  const pageData = {
    articles,
    groupedArticles: groupArticlesByYear(articles),
    latestDate,
    totalReadMinutes,
    author: {
      name: DEFAULT_AUTHOR,
      role: DEFAULT_AUTHOR_ROLE,
      avatar: DEFAULT_AVATAR,
    },
  };

  return `<!doctype html>
<html lang="zh-CN">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>文章归档 | Armand's Blog</title>
  <meta name="description" content="Armand 博客的文章归档页，按年份收录全部文章。">
  <meta name="keywords" content="Armand, 文章归档, 技术博客, Aethe, F++, FreeWorld, C++, 图形, 语言设计">
  <meta name="author" content="${escapeHtml(DEFAULT_AUTHOR)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${SITE_URL}/articles/">
  <meta property="og:title" content="文章归档 | Armand's Blog">
  <meta property="og:description" content="Armand 博客的文章归档页，按年份收录全部文章。">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Armand's Blog">
  <meta property="og:url" content="${SITE_URL}/articles/">
  <meta property="og:image" content="${SITE_URL}/img/avatar.jpeg">
  <meta property="og:image:alt" content="Armand avatar">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="文章归档 | Armand's Blog">
  <meta name="twitter:description" content="Armand 博客的文章归档页，按年份收录全部文章。">
  <meta name="twitter:image" content="${SITE_URL}/img/avatar.jpeg">
  <meta name="theme-color" content="#f0f2f5">
  <link rel="alternate" type="application/rss+xml" title="Armand's Blog RSS Feed" href="${SITE_URL}/feed.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap"
    rel="stylesheet">
  <link rel="stylesheet" href="../css/style.css">
${VUE_IMPORT_MAP}
  <link rel="icon" href="../favicon.png" type="image/png" sizes="64x64">
  <link rel="icon" href="../icon.png" type="image/png" sizes="192x192">
  <link rel="apple-touch-icon" href="../apple-touch-icon.png">
  <link rel="manifest" href="../site.webmanifest">
  <script type="application/ld+json">
${renderArchiveStructuredData(articles)}
  </script>
</head>

<body>
${renderAppMount("archive")}
${createPageDataScript(pageData)}
${renderAppScript("../js/app.js")}
</body>

</html>
`;
};

const renderArticlePage = (article) => {
  const pageData = {
    article: {
      slug: article.slug,
      title: article.title,
      description: article.description,
      date: article.date,
      format: article.format,
      readMinutes: article.readMinutes,
      author: article.author,
      authorRole: article.authorRole,
      avatar: article.avatar,
      markdownSource: `./${article.slug}.md`,
    },
  };

  return `<!doctype html>
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
${VUE_IMPORT_MAP}
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
  ${COMMENTS_API_BASE ? `<script>window.__COMMENTS_API_BASE__ = ${escapeInlineScriptValue(COMMENTS_API_BASE)};</script>` : ""}
</head>

<body>
${renderAppMount("article")}
${createPageDataScript(pageData)}
${renderAppScript("../js/app.js")}
</body>

</html>
`;
};

const renderSitemap = (articles) => {
  const latestDate = articles[0]?.date || new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: latestDate },
    { loc: `${SITE_URL}/articles/`, lastmod: latestDate },
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

const syncGeneratedArticles = (options = {}) => {
  const githubFeed = options.githubFeed || { username: "QianCream", items: [] };
  const articles = readMarkdownArticles();
  const homeArticles = articles.slice(0, HOME_ARTICLE_LIMIT);

  articles.forEach((article) => {
    const htmlPath = path.join(ARTICLES_DIR, `${article.slug}.html`);
    fs.writeFileSync(htmlPath, renderArticlePage(article), "utf8");
  });

  fs.writeFileSync(ARCHIVE_INDEX_PATH, renderArchivePage(articles), "utf8");
  fs.writeFileSync(INDEX_PATH, renderHomePage({ articles, homeArticles, githubFeed }), "utf8");
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
