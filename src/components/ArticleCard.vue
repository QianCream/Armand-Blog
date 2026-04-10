<template>
  <a :class="cardClass" :href="href">
    <div class="panel-head">
      <span class="article-meta">{{ displayIndex }}</span>
      <span class="panel-index">A{{ index + 1 }}</span>
    </div>
    <span class="article-card-date">{{ article.date || "undated" }}</span>
    <div class="article-card-stats">
      <span>{{ article.format }}</span>
      <span>{{ article.readMinutes }} min read</span>
      <span>{{ article.sectionCount }} sections</span>
    </div>
    <div class="article-card-command">
      <span class="article-card-command-prompt">$</span>
      <span class="article-card-command-text">open ./articles/{{ article.slug }}.md</span>
    </div>
    <h3>{{ article.title }}</h3>
    <p>{{ article.summary }}</p>
  </a>
</template>

<script>
export default {
  props: {
    article: {
      type: Object,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
    hrefPrefix: {
      type: String,
      default: "articles/",
    },
  },
  computed: {
    cardClass() {
      const type = this.index === 0 ? "featured" : "stack";
      return `article-card article-card-${type} reveal collapse-reveal`;
    },
    displayIndex() {
      return String(this.index + 1).padStart(2, "0");
    },
    href() {
      return `${this.hrefPrefix}${this.article.slug}.html`;
    },
  },
};
</script>
