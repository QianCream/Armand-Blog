const escapeHtml = (value) => String(value)
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

export const parseFrontMatter = (raw) => {
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

  if (language === "scala") {
    return "scala";
  }

  return language;
};

export const highlightCodeBlocks = (container) => {
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
    } catch {
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

export const renderMarkdown = (markdown) => {
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

export const estimateMarkdownReadingMinutes = (body) => {
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

  return Math.max(1, Math.round((cjkCharacters + latinWords) / 260));
};

export const generateArticleToc = (container) => {
  if (!container) {
    return;
  }

  const prose = container.querySelector(".article-prose");

  if (!prose) {
    return;
  }

  const headings = Array.from(prose.querySelectorAll("h2, h3"));

  headings.forEach((heading, index) => {
    if (!heading.id) {
      heading.id = `s${index + 1}`;
    }
  });

  if (headings.length < 3) {
    return;
  }

  const toc = document.createElement("nav");
  toc.className = "article-toc reveal";
  toc.setAttribute("aria-label", "目录");

  const header = document.createElement("div");
  header.className = "toc-header";
  header.innerHTML = `<span>目录</span><span class="toc-count">${headings.length} 节</span>`;

  const list = document.createElement("ol");
  list.className = "toc-list";

  headings.forEach((heading) => {
    const item = document.createElement("li");
    item.className = `toc-item toc-${heading.tagName.toLowerCase()}`;
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      heading.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    item.appendChild(link);
    list.appendChild(item);
  });

  toc.append(header, list);

  const articleContent = document.querySelector(".article-content");

  if (articleContent?.parentNode) {
    articleContent.parentNode.insertBefore(toc, articleContent);
  }

  const tocLinks = Array.from(toc.querySelectorAll(".toc-item a"));
  const updateActive = () => {
    const line = window.innerHeight * 0.28;
    let activeId = headings[0]?.id;

    headings.forEach((heading) => {
      if (heading.getBoundingClientRect().top <= line) {
        activeId = heading.id;
      }
    });

    tocLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${activeId}`);
    });
  };

  window.addEventListener("scroll", updateActive, { passive: true });
  updateActive();
};

export const addCodeCopyButtons = (container) => {
  if (!container) {
    return;
  }

  container.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector(".code-copy-btn")) {
      return;
    }

    const button = document.createElement("button");
    button.className = "code-copy-btn";
    button.textContent = "copy";
    button.setAttribute("aria-label", "Copy code to clipboard");
    button.setAttribute("type", "button");

    button.addEventListener("click", async () => {
      const code = pre.querySelector("code")?.textContent ?? "";

      try {
        await navigator.clipboard.writeText(code);
        button.textContent = "✓ copied";
        button.classList.add("is-copied");
        window.setTimeout(() => {
          button.textContent = "copy";
          button.classList.remove("is-copied");
        }, 1800);
      } catch {
        button.textContent = "failed";
        window.setTimeout(() => {
          button.textContent = "copy";
        }, 1200);
      }
    });

    pre.appendChild(button);
  });
};
