<template>
  <header class="site-header">
    <div class="container nav">
      <a class="brand" :href="brand.href" aria-label="Armand 首页">
        <img class="brand-mark" :src="brand.image" :alt="brand.alt">
        <span class="brand-copy">{{ brand.label }}</span>
      </a>

      <nav class="nav-links" aria-label="主导航">
        <a v-for="link in links" :key="link.href" :href="link.href">{{ link.label }}</a>
      </nav>
    </div>
  </header>
</template>

<script>
export default {
  props: {
    brand: {
      type: Object,
      required: true,
    },
    links: {
      type: Array,
      required: true,
    },
  },
};
</script>
