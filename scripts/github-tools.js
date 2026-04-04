const fs = require("fs");
const https = require("https");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const INDEX_PATH = path.join(ROOT_DIR, "index.html");
const CACHE_PATH = path.join(ROOT_DIR, "tmp", "github-contributions-cache.json");
const GENERATED_START = "<!-- GITHUB:GENERATED:START -->";
const GENERATED_END = "<!-- GITHUB:GENERATED:END -->";

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const formatGithubDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  });
};

const summarizeGithubEvent = (event) => {
  const repo = event.repo?.name || "unknown/repo";
  const createdAt = formatGithubDate(event.created_at);

  if (event.type === "PushEvent") {
    const commits = event.payload?.commits || [];
    const latestCommit = commits[commits.length - 1];
    const sha = latestCommit?.sha || event.payload?.head || "";
    const commitCount = event.payload?.size || commits.length || 0;

    return {
      badge: "commit",
      repo,
      time: createdAt,
      title: latestCommit?.message || `Push to ${repo.split("/").pop()}`,
      detail: commitCount > 1 ? `本次推送包含 ${commitCount} 个提交` : "最新提交已同步到 GitHub",
      code: sha ? sha.slice(0, 7) : "HEAD",
      url: sha ? `https://github.com/${repo}/commit/${sha}` : `https://github.com/${repo}`,
    };
  }

  if (event.type === "PullRequestEvent") {
    const pullRequest = event.payload?.pull_request;

    return {
      badge: "pull request",
      repo,
      time: createdAt,
      title: pullRequest?.title || "Updated pull request",
      detail: `PR ${event.payload?.action || "updated"}`,
      code: pullRequest?.number ? `#${pullRequest.number}` : "PR",
      url: pullRequest?.html_url || `https://github.com/${repo}/pulls`,
    };
  }

  if (event.type === "IssuesEvent") {
    const issue = event.payload?.issue;

    return {
      badge: "issue",
      repo,
      time: createdAt,
      title: issue?.title || "Updated issue",
      detail: `Issue ${event.payload?.action || "updated"}`,
      code: issue?.number ? `#${issue.number}` : "ISSUE",
      url: issue?.html_url || `https://github.com/${repo}/issues`,
    };
  }

  if (event.type === "CreateEvent") {
    const refType = event.payload?.ref_type || "repository";
    const refName = event.payload?.ref || repo;

    return {
      badge: "create",
      repo,
      time: createdAt,
      title: `Created ${refType}: ${refName}`,
      detail: "新的 GitHub 实体已创建",
      code: String(refType).toUpperCase(),
      url: `https://github.com/${repo}`,
    };
  }

  if (event.type === "ReleaseEvent") {
    const release = event.payload?.release;

    return {
      badge: "release",
      repo,
      time: createdAt,
      title: release?.name || release?.tag_name || "Published release",
      detail: "发布了新的版本",
      code: release?.tag_name || "REL",
      url: release?.html_url || `https://github.com/${repo}/releases`,
    };
  }

  return null;
};

const renderGithubContribution = (item, index) => `            <a class="github-item" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer" style="--github-index:${index};">
              <div class="github-item-rail">
                <span class="github-item-dot" aria-hidden="true"></span>
                <span class="github-item-time">${escapeHtml(item.time)}</span>
              </div>
              <div class="github-item-card">
                <div class="github-item-meta">
                  <span class="github-item-badge">${escapeHtml(item.badge)}</span>
                  <span class="github-item-repo">${escapeHtml(item.repo)}</span>
                  ${item.code ? `<span class="github-item-code">${escapeHtml(item.code)}</span>` : ""}
                </div>
                <div class="github-item-copy">
                  <h3>${escapeHtml(item.title)}</h3>
                  <p>${escapeHtml(item.detail)}</p>
                </div>
              </div>
            </a>`;

const renderGithubFeed = (username, items) => {
  const repoCount = new Set(items.map((item) => item.repo)).size;
  const latestType = items[0]?.badge || "activity";

  return `            <div class="github-feed-head">
              <a class="github-profile-link" href="https://github.com/${escapeHtml(username)}" target="_blank" rel="noreferrer">@${escapeHtml(username)}</a>
              <div class="github-summary-chips">
                <span>${items.length} events</span>
                <span>${repoCount} repos</span>
                <span>latest ${escapeHtml(latestType)}</span>
              </div>
            </div>
            <div class="github-list">
${items.map((item, index) => renderGithubContribution(item, index)).join("\n")}
            </div>`;
};

const fetchPublicEvents = (username) => new Promise((resolve, reject) => {
  const request = https.get(
    `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=12`,
    {
      headers: {
        "User-Agent": "Armand-Blog-Sync",
        Accept: "application/vnd.github+json",
      },
    },
    (response) => {
      let body = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`GitHub API responded with ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    },
  );

  request.on("error", reject);
  request.setTimeout(8000, () => {
    request.destroy(new Error("GitHub request timed out"));
  });
});

const readCache = () => {
  if (!fs.existsSync(CACHE_PATH)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
};

const writeCache = (username, items) => {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify({ username, items }, null, 2), "utf8");
};

const syncGithubFeed = async (username) => {
  const indexHtml = fs.readFileSync(INDEX_PATH, "utf8");

  if (!indexHtml.includes(GENERATED_START) || !indexHtml.includes(GENERATED_END)) {
    throw new Error("Missing GitHub generation markers in index.html");
  }

  let items = [];

  try {
    const events = await fetchPublicEvents(username);
    items = events
      .map(summarizeGithubEvent)
      .filter(Boolean)
      .slice(0, 4);

    if (items.length) {
      writeCache(username, items);
    }
  } catch (error) {
    const cached = readCache();

    if (cached?.items?.length) {
      items = cached.items;
      username = cached.username || username;
    } else {
      throw error;
    }
  }

  if (!items.length) {
    return 0;
  }

  const updatedIndex = indexHtml.replace(
    new RegExp(`${GENERATED_START}[\\s\\S]*?${GENERATED_END}`),
    `${GENERATED_START}\n${renderGithubFeed(username, items)}\n          ${GENERATED_END}`,
  );

  fs.writeFileSync(INDEX_PATH, updatedIndex, "utf8");
  return items.length;
};

module.exports = {
  syncGithubFeed,
};
