const { syncGeneratedArticles } = require("./article-tools");

try {
  const articles = syncGeneratedArticles();
  console.log(`Synced ${articles.length} article(s).`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
