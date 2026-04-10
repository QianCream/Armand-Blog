import * as Vue from "vue";
import { loadModule } from "vue3-sfc-loader";

import {
  getAppRoot,
  getPageType,
  readPageData,
  resolveRuntimeUrl,
} from "../src/lib/page-data.js";
import * as comments from "../src/lib/comments.js";
import * as github from "../src/lib/github.js";
import * as markdown from "../src/lib/markdown.js";
import * as siteEffects from "../src/lib/site-effects.js";

const pageModules = {
  home: "../src/pages/HomePage.vue",
  archive: "../src/pages/ArchivePage.vue",
  article: "../src/pages/ArticlePage.vue",
};

const sharedComponents = {
  "site-header": "../src/components/SiteHeader.vue",
  "site-footer": "../src/components/SiteFooter.vue",
  "section-heading": "../src/components/SectionHeading.vue",
  "article-card": "../src/components/ArticleCard.vue",
  "github-feed": "../src/components/GithubFeed.vue",
  "comments-section": "../src/components/CommentsSection.vue",
};

const sfcLoaderOptions = {
  moduleCache: {
    vue: Vue,
  },
  async getFile(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw Object.assign(new Error(`${response.status} ${response.statusText} ${url}`), { response });
    }

    return {
      getContentData: (asBinary) => (asBinary ? response.arrayBuffer() : response.text()),
    };
  },
  addStyle(textContent) {
    const style = document.createElement("style");
    style.textContent = textContent;
    document.head.appendChild(style);
  },
};

const mountApp = async () => {
  const root = getAppRoot();

  if (!(root instanceof HTMLElement)) {
    return;
  }

  const pageType = getPageType();
  const pageModulePath = pageModules[pageType];

  if (!pageModulePath) {
    throw new Error(`Unsupported page type: ${pageType || "unknown"}`);
  }

  const pageComponent = await loadModule(resolveRuntimeUrl(pageModulePath), sfcLoaderOptions);
  const app = Vue.createApp(pageComponent, {
    pageData: readPageData(),
  });

  app.config.globalProperties.$siteUtils = {
    comments,
    github,
    markdown,
    siteEffects,
  };

  const componentEntries = Object.entries(sharedComponents);

  for (const [name, componentPath] of componentEntries) {
    const component = await loadModule(resolveRuntimeUrl(componentPath), sfcLoaderOptions);
    app.component(name, component);
  }

  app.mount(root);
  await Vue.nextTick();
  siteEffects.initSiteEffects();
};

mountApp().catch((error) => {
  console.error(error);

  const root = getAppRoot();

  if (root) {
    root.innerHTML = `<div class="page-shell"><main class="article-page"><div class="container article-shell"><p class="article-loading">页面加载失败：${error.message || "未知错误"}</p></div></main></div>`;
  }
});
