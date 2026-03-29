const fs = require("fs");
const path = require("path");
const {
  ARTICLES_DIR,
  DEFAULT_AUTHOR,
  DEFAULT_AUTHOR_ROLE,
  DEFAULT_AVATAR,
  createSlug,
  syncGeneratedArticles,
  uniqueSlug,
} = require("./article-tools");

const parseArgs = (argv) => {
  const result = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (!current.startsWith("--")) {
      result._.push(current);
      continue;
    }

    const key = current.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      result[key] = "true";
      continue;
    }

    result[key] = next;
    index += 1;
  }

  return result;
};

const args = parseArgs(process.argv.slice(2));
const title = args.title || args._.join(" ").trim();

if (!title) {
  console.error('Usage: npm run publish:article -- --title "文章标题" [--slug article-slug] [--summary 摘要]');
  process.exit(1);
}

const date = args.date || new Date().toISOString().slice(0, 10);
const desiredSlug = args.slug || createSlug(title, date);
const slug = uniqueSlug(desiredSlug);
const summary = args.summary || "待补充摘要。";
const markdownPath = path.join(ARTICLES_DIR, `${slug}.md`);

const markdown = `---
title: ${title}
description: ${summary}
summary: ${summary}
date: ${date}
format: Markdown
author: ${DEFAULT_AUTHOR}
author_role: ${DEFAULT_AUTHOR_ROLE}
avatar: ${DEFAULT_AVATAR}
---

## 引子

在这里开始写正文。
`;

fs.writeFileSync(markdownPath, markdown, "utf8");
syncGeneratedArticles();

console.log(`Created ${path.relative(process.cwd(), markdownPath)}`);
console.log(`Published article scaffold: ${title}`);
console.log(`Open articles/${slug}.md and start writing.`);
