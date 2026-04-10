<template>
  <div class="page-shell">
    <div class="grid-overlay" aria-hidden="true"></div>
    <div class="scroll-progress" aria-hidden="true"></div>

    <site-header :brand="brand" :links="navLinks"></site-header>

    <main id="top">
      <section class="hero section">
        <div class="container hero-grid">
          <div class="hero-copy reveal">
            <p class="eyebrow">你好，我是</p>
            <h1>ARMAND</h1>
            <p class="hero-text">初中生，在上海写代码和文章。</p>

            <div class="hero-command-band" aria-label="当前状态">
              <span class="hero-command-prompt">$</span>
              <span class="hero-command-text">cat ./now.md</span>
              <span class="hero-command-state">online</span>
            </div>

            <div class="hero-actions">
              <a class="button button-primary" href="#articles">latest</a>
              <a class="button button-secondary" href="articles/index.html">archive</a>
            </div>

            <div class="hero-terminal" aria-label="当前状态">
              <div class="terminal-top">
                <span class="terminal-dot" aria-hidden="true"></span>
                <span>~/armand/blog</span>
              </div>
              <div class="terminal-body">
                <p v-for="line in terminalLines" :key="line.key">
                  <span class="terminal-key">{{ line.key }}</span>
                  <span>{{ line.value }}</span>
                </p>
              </div>
            </div>
          </div>

          <aside class="hero-panel">
            <article class="profile-card reveal reveal-delay collapse-reveal">
              <div class="profile-frame">
                <img class="profile-image" src="img/avatar.jpeg" alt="Armand avatar">
              </div>
              <div class="profile-meta">
                <span class="eyebrow">ARMAND</span>
                <h2>Armand</h2>
                <p>上海 · 初中生</p>
              </div>
              <div class="profile-badges" aria-hidden="true">
                <span>devlog</span>
                <span>compiler</span>
                <span>research</span>
              </div>
              <div class="profile-status">
                <span class="profile-status-label">现在</span>
                <strong>写文章，做语言，搞界面</strong>
              </div>
            </article>
          </aside>
        </div>
      </section>

      <section id="articles" class="section">
        <div class="container">
          <section-heading
            eyebrow="/articles"
            title="文章"
            text="首页只看最近写的东西，完整归档单独放到文章页里。"
          ></section-heading>

          <div class="articles-grid">
            <div class="articles-overview">
              <div class="articles-summary panel reveal">
                <div class="articles-summary-item">
                  <span class="articles-summary-label">entries</span>
                  <strong>{{ articleCount }}</strong>
                </div>
                <div class="articles-summary-item">
                  <span class="articles-summary-label">latest</span>
                  <strong>{{ latestDate }}</strong>
                </div>
                <div class="articles-summary-item">
                  <span class="articles-summary-label">reading</span>
                  <strong>{{ totalReadMinutes }} min</strong>
                </div>
              </div>
              <a class="articles-archive-card panel reveal reveal-delay" href="articles/index.html">
                <span class="articles-archive-path">/articles/</span>
                <strong>文章归档</strong>
                <p>首页只保留最近 {{ articles.length }} 篇。以后文章再多，也都从这里进去。</p>
                <span class="articles-archive-meta">{{ articleCount }} entries online</span>
              </a>
            </div>
            <div class="articles-home-note reveal">
              <span class="panel-label">recent</span>
              <p>首页展示最近 {{ articles.length }} 篇，完整列表进 archive。</p>
            </div>
            <article-card
              v-for="(article, index) in articles"
              :key="article.slug"
              :article="article"
              :index="index"
            ></article-card>
            <div class="articles-footer-cta reveal">
              <a class="button button-secondary" href="articles/index.html">all {{ articleCount }} articles</a>
            </div>
          </div>
        </div>
      </section>

      <section id="github" class="section">
        <div class="container">
          <section-heading
            eyebrow="/github"
            title="最近在做什么"
            text="直接拉 GitHub 的公开动态，算是一种“实时更新”。"
          ></section-heading>

          <div class="github-feed panel reveal collapse-reveal">
            <github-feed :username="github.username" :initial-items="github.items"></github-feed>
          </div>
        </div>
      </section>

      <section id="intro" class="section">
        <div class="container">
          <section-heading
            eyebrow="/intro"
            title="关于我"
            text="初中生，在上海。这里是我的想法和记录。"
          ></section-heading>

          <div class="intro-grid">
            <article class="panel intro-panel reveal collapse-reveal">
              <div class="panel-head">
                <span class="panel-label">about</span>
                <span class="panel-index">01</span>
              </div>
              <div class="intro-command">
                <span class="intro-command-prompt">$</span>
                <span class="intro-command-text">whoami</span>
              </div>
              <p class="intro-lead">初三，上海。</p>
              <p class="intro-note">喜欢用 C++ 自己搭语言，从词法到运行时都不想借库。这个博客是记录学习过程的地方，也是整理思路的草稿本。写给未来的自己，也分享给感兴趣的人。</p>
              <div class="intro-flags" aria-hidden="true">
                <span>parser</span>
                <span>tooling</span>
                <span>ui</span>
              </div>
            </article>

            <div class="intro-stack reveal reveal-delay collapse-reveal">
              <article v-for="item in introStack" :key="item.key" class="stack-item">
                <span class="stack-key">{{ item.key }}</span>
                <strong>{{ item.value }}</strong>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section id="works" class="section section-last">
        <div class="container">
          <section-heading
            eyebrow="/works"
            title="作品"
            text="每个项目都从一个“不知道能不能做出来”开始。"
          ></section-heading>

          <div class="works-grid">
            <a
              v-for="(work, index) in works"
              :key="work.title"
              class="work-card reveal collapse-reveal"
              :class="workDelayClass(index)"
              :href="work.href"
              target="_blank"
              rel="noreferrer"
            >
              <div class="work-cover">
                <img :src="work.image" :alt="work.alt">
              </div>
              <div class="work-copy">
                <div class="panel-head">
                  <span class="work-meta">{{ work.index }}</span>
                  <span class="panel-index">{{ work.panelIndex }}</span>
                </div>
                <div class="work-card-command">
                  <span class="work-card-command-prompt">$</span>
                  <span class="work-card-command-text">{{ work.command }}</span>
                </div>
                <h3>{{ work.title }}</h3>
                <p>{{ work.description }}</p>
                <div class="work-card-tags" aria-hidden="true">
                  <span v-for="tag in work.tags" :key="tag">{{ tag }}</span>
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>
    </main>

    <site-footer :links="footerLinks"></site-footer>
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
    return {
      brand: {
        href: "#top",
        label: "armand.dev",
        image: "img/avatar.jpeg",
        alt: "Armand icon",
      },
      navLinks: [
        { href: "#top", label: "home" },
        { href: "#articles", label: "articles" },
        { href: "#intro", label: "intro" },
        { href: "#works", label: "works" },
      ],
      footerLinks: [
        { href: "articles/index.html", label: "archive" },
        { href: "feed.xml", label: "feed.xml" },
        { href: "sitemap.xml", label: "sitemap.xml" },
        { href: "https://github.com/QianCream", label: "github", external: true },
      ],
      terminalLines: [
        { key: "latest", value: "写了篇递归下降解析器_" },
        { key: "reading", value: "编译原理 / 图形学" },
        { key: "mood", value: "curious, caffeinated_" },
      ],
      introStack: [
        { key: "在用", value: "C++ / Pygame / Web" },
        { key: "感兴趣", value: "界面设计 / 交互 / 视觉" },
        { key: "在做", value: "Aethe 稳定推进中，偶尔写小项目" },
      ],
      works: [
        {
          href: "https://github.com/QianCream/Aethe",
          image: "img/work-aethe.jpg",
          alt: "Aethe cover",
          index: "01",
          panelIndex: "W1",
          command: "git clone QianCream/Aethe",
          title: "Aethe",
          description: "一门还在持续推进中的语言实验，重点放在管道式表达和可读的程序结构。",
          tags: ["compiler", "language"],
        },
        {
          href: "https://github.com/QianCream/Fpp",
          image: "img/work-fpp.png",
          alt: "F++ cover",
          index: "02",
          panelIndex: "W2",
          command: "git clone QianCream/Fpp",
          title: "F++",
          description: "围绕语言与实现继续试错的项目分支，偏向更直接的表达和实验性结构。",
          tags: ["syntax", "experiment"],
        },
        {
          href: "https://github.com/QianCream/FreeWorld",
          image: "img/work-freeworld.jpg",
          alt: "FreeWorld cover",
          index: "03",
          panelIndex: "W3",
          command: "git clone QianCream/FreeWorld",
          title: "FreeWorld",
          description: "更偏小型项目和世界观式构想的集合，记录实现过程里的视觉和玩法尝试。",
          tags: ["gameplay", "world"],
        },
      ],
    };
  },
  computed: {
    articles() {
      return Array.isArray(this.pageData?.articles) ? this.pageData.articles : [];
    },
    articleCount() {
      return Number(this.pageData?.articleCount || this.articles.length || 0);
    },
    latestDate() {
      return this.pageData?.latestDate || "undated";
    },
    totalReadMinutes() {
      return Number(this.pageData?.totalReadMinutes || 0);
    },
    github() {
      return this.pageData?.github || { username: "QianCream", items: [] };
    },
  },
  methods: {
    workDelayClass(index) {
      if (index === 1) {
        return "reveal-delay";
      }

      if (index === 2) {
        return "reveal-delay-2";
      }

      return "";
    },
  },
};
</script>
