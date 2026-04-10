<template>
  <div>
    <div v-if="loading && !items.length" class="github-feed-status">加载 GitHub 动态中...</div>
    <p v-else-if="error && !items.length" class="github-feed-status">{{ error }}</p>
    <template v-else>
      <div class="github-feed-head">
        <a class="github-profile-link" :href="profileUrl" target="_blank" rel="noreferrer">@{{ username }}</a>
        <div class="github-summary-chips">
          <span>{{ items.length }} events</span>
          <span>{{ repoCount }} repos</span>
          <span>latest {{ latestType }}</span>
        </div>
      </div>
      <div class="github-list">
        <a
          v-for="(item, index) in items"
          :key="item.url"
          class="github-item"
          :href="item.url"
          target="_blank"
          rel="noreferrer"
          :style="{ '--github-index': index }"
        >
          <div class="github-item-rail">
            <span class="github-item-dot" aria-hidden="true"></span>
            <span class="github-item-time">{{ item.time }}</span>
          </div>
          <div class="github-item-card">
            <div class="github-item-meta">
              <span class="github-item-badge">{{ item.badge }}</span>
              <span class="github-item-repo">{{ item.repo }}</span>
              <span v-if="item.code" class="github-item-code">{{ item.code }}</span>
            </div>
            <div class="github-item-copy">
              <h3>{{ item.title }}</h3>
              <p>{{ item.detail }}</p>
            </div>
          </div>
        </a>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  props: {
    username: {
      type: String,
      required: true,
    },
    initialItems: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      loading: !this.initialItems.length,
      error: "",
      items: Array.isArray(this.initialItems) ? [...this.initialItems] : [],
    };
  },
  computed: {
    profileUrl() {
      return `https://github.com/${encodeURIComponent(this.username)}`;
    },
    repoCount() {
      return new Set(this.items.map((item) => item.repo)).size;
    },
    latestType() {
      return this.items[0]?.badge || "activity";
    },
  },
  mounted() {
    void this.loadEvents();
  },
  methods: {
    async loadEvents() {
      this.loading = true;
      this.error = "";

      try {
        const items = await this.$siteUtils.github.loadGithubFeed(this.username);

        if (items.length) {
          this.items = items;
          return;
        }

        if (!this.items.length) {
          this.error = "最近没有读取到公开贡献。";
        }
      } catch (error) {
        console.error(error);

        if (!this.items.length) {
          this.error = "GitHub 贡献加载失败。";
        }
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
