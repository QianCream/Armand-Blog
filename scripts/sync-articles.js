const { syncGeneratedArticles } = require("./article-tools");
const { syncGithubFeed } = require("./github-tools");

const main = async () => {
  const articles = syncGeneratedArticles();
  console.log(`Synced ${articles.length} article(s).`);

  try {
    const githubItems = await syncGithubFeed("QianCream");
    console.log(`Synced ${githubItems} GitHub contribution item(s).`);
  } catch (error) {
    console.warn(`GitHub sync skipped: ${error.message}`);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
