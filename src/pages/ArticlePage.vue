<template>
  <div class="page-shell">
    <main class="article-page">
      <div class="container article-shell">
        <header class="article-top reveal">
          <a class="article-back" :href="backHref">← archive</a>
          <div class="article-author">
            <img class="article-author-avatar" :src="avatar" :alt="`${author} avatar`">
            <div class="article-author-copy">
              <strong>{{ author }}</strong>
              <span>{{ authorRole }}</span>
            </div>
          </div>
          <div class="article-meta-row">
            <span v-if="date" class="article-date">{{ date }}</span>
            <span class="article-format">{{ format }}</span>
            <span class="article-reading-time">{{ readMinutes }}</span>
          </div>
          <h1 ref="titleNode" class="article-title">{{ title }}</h1>
        </header>
        <article ref="contentRoot" class="article-content reveal reveal-delay">
          <p v-if="loading" class="article-loading">Loading markdown...</p>
          <p v-else-if="error" class="article-loading">{{ error }}</p>
          <div v-else class="article-prose" v-html="articleHtml"></div>
        </article>
        <comments-section v-if="articleSlug" :article-slug="articleSlug"></comments-section>
      </div>
    </main>
  </div>
</template>

<script>
export default {
  props: {
    pageData: {
      type: Object,
      required: true,
    },
  },
  data() {
    const article = this.pageData?.article || {};

    return {
      articleSlug: article.slug || "",
      backHref: "./index.html",
      markdownSource: article.markdownSource || `./${article.slug}.md`,
      title: article.title || "Untitled",
      date: article.date || "",
      format: article.format || "Markdown",
      readMinutes: article.readMinutes ? `${article.readMinutes} min read` : "1 min read",
      author: article.author || "Armand",
      authorRole: article.authorRole || "armand.dev",
      avatar: article.avatar || "../img/avatar.jpeg",
      articleHtml: "",
      loading: true,
      error: "",
    };
  },
  mounted() {
    this.$siteUtils.siteEffects.refreshDynamicNodes(this.$el);
    this.$siteUtils.siteEffects.applyStaggerText(this.$refs.titleNode);
    void this.loadArticle();
  },
  methods: {
    syncDocumentMeta(description) {
      document.title = `${this.title} | Armand's Blog`;

      if (description) {
        const descriptionMeta = document.querySelector('meta[name="description"]');

        if (descriptionMeta) {
          descriptionMeta.setAttribute("content", description);
        }
      }
    },
    async loadArticle() {
      if (!this.markdownSource) {
        this.error = "Markdown 加载失败，请检查内容文件路径。";
        this.loading = false;
        return;
      }

      this.loading = true;
      this.error = "";

      try {
        const response = await fetch(this.markdownSource);

        if (!response.ok) {
          throw new Error(`Failed to load markdown: ${response.status}`);
        }

        const raw = await response.text();
        const { meta, body } = this.$siteUtils.markdown.parseFrontMatter(raw);

        this.title = meta.title || this.title || "Untitled";
        this.date = meta.date || this.date;
        this.format = meta.format || this.format;
        this.author = meta.author || this.author;
        this.authorRole = meta.author_role || this.authorRole;
        this.avatar = meta.avatar || this.avatar;
        this.readMinutes = `${this.$siteUtils.markdown.estimateMarkdownReadingMinutes(body)} min read`;
        this.articleHtml = this.$siteUtils.markdown.renderMarkdown(body);
        this.syncDocumentMeta(meta.description);
        this.loading = false;

        await this.$nextTick();

        const headline = this.$refs.titleNode;

        if (headline instanceof HTMLElement) {
          headline.classList.remove("stagger-text");
          delete headline.dataset.staggerApplied;
          headline.textContent = this.title;
          this.$siteUtils.siteEffects.applyStaggerText(headline);
        }

        const contentRoot = this.$refs.contentRoot;
        const existingToc = this.$el.querySelector(".article-toc");

        existingToc?.remove();

        if (contentRoot instanceof HTMLElement) {
          try {
            this.$siteUtils.markdown.highlightCodeBlocks(contentRoot);

            if (window.MathJax?.typesetPromise) {
              await window.MathJax.typesetPromise([contentRoot]);
            }

            this.$siteUtils.markdown.generateArticleToc(contentRoot);
            this.$siteUtils.markdown.addCodeCopyButtons(contentRoot);
          } catch (enhancementError) {
            console.error("Article enhancement failed.", enhancementError);
          }
        }

        this.$siteUtils.siteEffects.refreshDynamicNodes(this.$el);
      } catch (error) {
        const isLocalDebug = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        this.error = isLocalDebug
          ? `Markdown 加载失败：${error?.message || "未知错误"}`
          : "Markdown 加载失败，请检查内容文件路径。";
        this.loading = false;
        console.error(error);
      }
    },
  },
};
</script>
