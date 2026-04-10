const { syncGeneratedArticles } = require("./article-tools");
const { syncGithubFeed } = require("./github-tools");

const main = async () => {
  let githubFeed = { username: "QianCream", items: [] };

  try {
    githubFeed = await syncGithubFeed("QianCream");
    console.log(`Synced ${githubFeed.items.length} GitHub contribution item(s).`);
  } catch (error) {
    console.warn(`GitHub sync skipped: ${error.message}`);
  }

  const articles = syncGeneratedArticles({ githubFeed });
  console.log(`Synced ${articles.length} article(s).`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
