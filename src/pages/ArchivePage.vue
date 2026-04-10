<template>
  <div class="page-shell">
    <div class="scroll-progress" aria-hidden="true"></div>

    <main class="archive-page">
      <div class="container archive-shell">
        <header class="archive-top reveal">
          <a class="article-back" href="../index.html#articles">← home</a>
          <div class="article-author">
            <img class="article-author-avatar" :src="author.avatar" :alt="`${author.name} avatar`">
            <div class="article-author-copy">
              <strong>{{ author.name }}</strong>
              <span>{{ author.role }}</span>
            </div>
          </div>
          <div class="archive-heading">
            <p class="eyebrow">/articles/archive</p>
            <h1 class="article-title">文章归档</h1>
            <p class="archive-intro">首页只放最近的文章，这里保留全部内容。后面文章再多，也按年份继续往下长。</p>
          </div>
          <div class="archive-stats">
            <span>{{ articleCount }} entries</span>
            <span>{{ latestDate }} latest</span>
            <span>{{ totalReadMinutes }} min total</span>
          </div>
        </header>

        <div class="archive-layout">
          <aside class="archive-nav panel reveal collapse-reveal">
            <div class="panel-head">
              <span class="panel-label">years</span>
              <span class="panel-index">{{ groupedArticles.length }}</span>
            </div>
            <div class="archive-nav-list">
              <a v-for="group in groupedArticles" :key="group.year" :href="`#year-${group.year}`">
                {{ group.year }} <span>{{ group.items.length }}</span>
              </a>
            </div>
          </aside>

          <div class="archive-groups">
            <section v-for="group in groupedArticles" :id="`year-${group.year}`" :key="group.year" class="archive-group panel reveal collapse-reveal">
              <div class="panel-head">
                <span class="panel-label">{{ group.year }}</span>
                <span class="panel-index">{{ group.items.length }} entries</span>
              </div>
              <div class="archive-list">
                <a v-for="article in group.items" :key="article.slug" class="archive-item" :href="`./${article.slug}.html`">
                  <div class="archive-item-date">{{ article.date || "undated" }}</div>
                  <div class="archive-item-body">
                    <h2>{{ article.title }}</h2>
                    <p>{{ article.summary }}</p>
                    <div class="archive-item-meta">
                      <span>{{ article.format }}</span>
                      <span>{{ article.readMinutes }} min read</span>
                      <span>{{ article.sectionCount }} sections</span>
                    </div>
                  </div>
                </a>
              </div>
            </section>
          </div>
        </div>
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
  computed: {
    articles() {
      return Array.isArray(this.pageData?.articles) ? this.pageData.articles : [];
    },
    groupedArticles() {
      if (Array.isArray(this.pageData?.groupedArticles)) {
        return this.pageData.groupedArticles;
      }

      const groups = new Map();

      this.articles.forEach((article) => {
        const year = article.year || "undated";

        if (!groups.has(year)) {
          groups.set(year, []);
        }

        groups.get(year).push(article);
      });

      return Array.from(groups.entries()).map(([year, items]) => ({ year, items }));
    },
    author() {
      return this.pageData?.author || {
        name: "Armand",
        role: "armand.dev",
        avatar: "../img/avatar.jpeg",
      };
    },
    articleCount() {
      return this.articles.length;
    },
    latestDate() {
      return this.pageData?.latestDate || this.articles[0]?.date || "undated";
    },
    totalReadMinutes() {
      return Number(this.pageData?.totalReadMinutes || 0);
    },
  },
};
</script>
