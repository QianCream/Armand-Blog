export const formatGithubDate = (value) => {
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
  });
};

export const summarizeGithubEvent = (event) => {
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

export const loadGithubFeed = async (username, limit = 4) => {
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=12`);

  if (!response.ok) {
    throw new Error(`Failed to load GitHub events: ${response.status}`);
  }

  const events = await response.json();

  return events
    .map(summarizeGithubEvent)
    .filter(Boolean)
    .slice(0, limit);
};
