<template>
  <footer class="site-footer">
    <div class="container footer-row">
      <p>© <span>{{ year }}</span> armand.dev</p>
      <div class="footer-links">
        <a
          v-for="link in links"
          :key="link.href"
          :href="link.href"
          :target="link.external ? '_blank' : null"
          :rel="link.external ? 'noreferrer' : null"
        >
          {{ link.label }}
        </a>
      </div>
    </div>
  </footer>
</template>

<script>
export default {
  props: {
    links: {
      type: Array,
      required: true,
    },
  },
  computed: {
    year() {
      return new Date().getFullYear();
    },
  },
};
</script>
