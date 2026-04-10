export const allowedCommentSortModes = new Set(["latest", "oldest", "top"]);

export const readDraftFromStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return { author: "", content: "" };
    }

    const parsed = JSON.parse(raw);

    return {
      author: String(parsed?.author || ""),
      content: String(parsed?.content || ""),
    };
  } catch {
    return { author: "", content: "" };
  }
};

export const writeDraftToStorage = (key, value) => {
  const author = String(value?.author || "").trim();
  const content = String(value?.content || "");

  if (!author && !content.trim()) {
    localStorage.removeItem(key);
    return;
  }

  localStorage.setItem(key, JSON.stringify({ author, content }));
};

export const resolveCommentsApiBase = () => {
  if (typeof window.__COMMENTS_API_BASE__ === "string" && window.__COMMENTS_API_BASE__.trim()) {
    return window.__COMMENTS_API_BASE__.trim().replace(/\/+$/, "");
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:8787";
  }

  return "";
};

export const buildCommentsApiUrl = (pathname) => `${resolveCommentsApiBase()}${pathname}`;

export const formatCommentDate = (value) => {
  if (!value) {
    return "";
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export const getCommentTimestamp = (comment) => {
  const raw = String(comment?.createdAt || "");

  if (!raw) {
    return 0;
  }

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  return parsed.getTime();
};
