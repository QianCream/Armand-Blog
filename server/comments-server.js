const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DB_PATH = process.env.COMMENTS_DB_PATH || path.join(__dirname, "data", "comments.db");
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const RATE_BURST_SECONDS = 20;
const RATE_LIMIT_PER_HOUR = 20;
const MAX_CONTENT_LENGTH = 1000;
const MAX_AUTHOR_LENGTH = 40;
const MAX_FETCH_COUNT = 120;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_slug TEXT NOT NULL,
    parent_id INTEGER,
    is_author INTEGER NOT NULL DEFAULT 0,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_comments_article_created
  ON comments(article_slug, created_at DESC);

  CREATE TABLE IF NOT EXISTS comment_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    ip_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_likes_unique
  ON comment_likes(comment_id, ip_hash);

  CREATE INDEX IF NOT EXISTS idx_comment_likes_comment
  ON comment_likes(comment_id);
`);
try {
  db.exec("ALTER TABLE comments ADD COLUMN parent_id INTEGER");
} catch (error) {
  if (!String(error?.message || "").includes("duplicate column name")) {
    throw error;
  }
}
try {
  db.exec("ALTER TABLE comments ADD COLUMN is_author INTEGER NOT NULL DEFAULT 0");
} catch (error) {
  if (!String(error?.message || "").includes("duplicate column name")) {
    throw error;
  }
}

const app = express();
app.set("trust proxy", true);
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json({ limit: "16kb" }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || !CORS_ORIGINS.length || CORS_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  credentials: true,
}));

const rateBuckets = new Map();

const nowMs = () => Date.now();

const normalizeAuthor = (value) => String(value || "")
  .replace(/[\r\n\t]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const normalizeContent = (value) => String(value || "")
  .replace(/\r\n/g, "\n")
  .trim();

const normalizeSlug = (value) => String(value || "").trim().toLowerCase();

const hashIp = (ip) => crypto
  .createHash("sha256")
  .update(String(ip || "unknown"))
  .digest("hex");

const isValidSlug = (slug) => /^[a-z0-9][a-z0-9-]{0,119}$/.test(slug);

const getClientIp = (req) => {
  const xff = req.headers["x-forwarded-for"];

  if (typeof xff === "string" && xff.length) {
    return xff.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
};

const checkRateLimit = (ipHash) => {
  const current = nowMs();
  const oneHourAgo = current - 60 * 60 * 1000;
  const bucket = rateBuckets.get(ipHash) || [];
  const recent = bucket.filter((timestamp) => timestamp >= oneHourAgo);
  const last = recent[recent.length - 1];

  if (recent.length >= RATE_LIMIT_PER_HOUR) {
    const retryAfterMs = recent[0] + 60 * 60 * 1000 - current;
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  if (last && current - last < RATE_BURST_SECONDS * 1000) {
    const retryAfterMs = RATE_BURST_SECONDS * 1000 - (current - last);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  recent.push(current);
  rateBuckets.set(ipHash, recent);
  return { ok: true, retryAfterSeconds: 0 };
};

const mapCommentRow = (row) => ({
  id: row.id,
  parentId: row.parent_id ?? null,
  isAuthor: false,
  author: row.author,
  content: row.content,
  createdAt: row.created_at,
  likeCount: Number(row.like_count || 0),
  liked: Boolean(row.liked),
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/comments", (req, res) => {
  const slug = normalizeSlug(req.query.article);

  if (!isValidSlug(slug)) {
    res.status(400).json({ error: "Invalid article slug" });
    return;
  }

  const viewerIpHash = hashIp(getClientIp(req));

  const rows = db
    .prepare(`
      SELECT
        c.id,
        c.parent_id,
        c.author,
        c.content,
        c.created_at,
        (
          SELECT COUNT(1)
          FROM comment_likes l
          WHERE l.comment_id = c.id
        ) AS like_count,
        EXISTS(
          SELECT 1
          FROM comment_likes l2
          WHERE l2.comment_id = c.id
            AND l2.ip_hash = ?
        ) AS liked
      FROM comments c
      WHERE article_slug = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(viewerIpHash, slug, MAX_FETCH_COUNT);

  res.json({
    comments: rows.map(mapCommentRow),
  });
});

app.post("/api/comments", (req, res) => {
  const articleSlug = normalizeSlug(req.body?.articleSlug || req.body?.article);
  const author = normalizeAuthor(req.body?.author);
  const content = normalizeContent(req.body?.content);
  const parentIdRaw = req.body?.parentId;
  const parentId = parentIdRaw === undefined || parentIdRaw === null || parentIdRaw === ""
    ? null
    : Number(parentIdRaw);

  if (!isValidSlug(articleSlug)) {
    res.status(400).json({ error: "Invalid article slug" });
    return;
  }

  if (!author || author.length > MAX_AUTHOR_LENGTH) {
    res.status(400).json({ error: `Author must be 1-${MAX_AUTHOR_LENGTH} characters` });
    return;
  }

  if (!content || content.length > MAX_CONTENT_LENGTH) {
    res.status(400).json({ error: `Content must be 1-${MAX_CONTENT_LENGTH} characters` });
    return;
  }

  if (parentId !== null) {
    if (!Number.isInteger(parentId) || parentId <= 0) {
      res.status(400).json({ error: "Invalid parentId" });
      return;
    }

    const parent = db
      .prepare(`
        SELECT id, article_slug, parent_id
        FROM comments
        WHERE id = ?
      `)
      .get(parentId);

    if (!parent) {
      res.status(400).json({ error: "Parent comment does not exist" });
      return;
    }

    if (parent.article_slug !== articleSlug) {
      res.status(400).json({ error: "Parent comment belongs to another article" });
      return;
    }

    if (parent.parent_id !== null && parent.parent_id !== undefined) {
      res.status(400).json({ error: "Only one-level replies are allowed" });
      return;
    }
  }

  const ipHash = hashIp(getClientIp(req));
  const rate = checkRateLimit(ipHash);

  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    res.status(429).json({ error: "Too many requests", retryAfter: rate.retryAfterSeconds });
    return;
  }

  const result = db
    .prepare(`
      INSERT INTO comments (article_slug, parent_id, author, content, ip_hash)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(articleSlug, parentId, author, content, ipHash);

  const inserted = db
    .prepare(`
      SELECT id, parent_id, author, content, created_at,
        0 AS like_count,
        0 AS liked
      FROM comments
      WHERE id = ?
    `)
    .get(result.lastInsertRowid);

  res.status(201).json({ comment: mapCommentRow(inserted) });
});

app.post("/api/comments/:id/like", (req, res) => {
  const commentId = Number(req.params.id);

  if (!Number.isInteger(commentId) || commentId <= 0) {
    res.status(400).json({ error: "Invalid comment id" });
    return;
  }

  const target = db
    .prepare("SELECT id FROM comments WHERE id = ?")
    .get(commentId);

  if (!target) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  const ipHash = hashIp(getClientIp(req));

  db
    .prepare(`
      INSERT OR IGNORE INTO comment_likes (comment_id, ip_hash)
      VALUES (?, ?)
    `)
    .run(commentId, ipHash);

  const row = db
    .prepare(`
      SELECT COUNT(1) AS like_count
      FROM comment_likes
      WHERE comment_id = ?
    `)
    .get(commentId);

  res.json({
    ok: true,
    liked: true,
    likeCount: Number(row?.like_count || 0),
  });
});

app.delete("/api/comments/:id/like", (req, res) => {
  const commentId = Number(req.params.id);

  if (!Number.isInteger(commentId) || commentId <= 0) {
    res.status(400).json({ error: "Invalid comment id" });
    return;
  }

  const target = db
    .prepare("SELECT id FROM comments WHERE id = ?")
    .get(commentId);

  if (!target) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  const ipHash = hashIp(getClientIp(req));

  db
    .prepare(`
      DELETE FROM comment_likes
      WHERE comment_id = ?
        AND ip_hash = ?
    `)
    .run(commentId, ipHash);

  const row = db
    .prepare(`
      SELECT COUNT(1) AS like_count
      FROM comment_likes
      WHERE comment_id = ?
    `)
    .get(commentId);

  res.json({
    ok: true,
    liked: false,
    likeCount: Number(row?.like_count || 0),
  });
});

app.use((error, _req, res, _next) => {
  if (error?.message === "Origin not allowed by CORS") {
    res.status(403).json({ error: "CORS blocked" });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, HOST, () => {
  console.log(`[comments-server] listening on http://${HOST}:${PORT}`);
  console.log(`[comments-server] db: ${DB_PATH}`);
  if (CORS_ORIGINS.length) {
    console.log(`[comments-server] cors: ${CORS_ORIGINS.join(", ")}`);
  } else {
    console.log("[comments-server] cors: allow all origins");
  }
});
