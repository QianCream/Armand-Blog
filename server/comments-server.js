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
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_comments_article_created
  ON comments(article_slug, created_at DESC);
`);

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
  methods: ["GET", "POST", "OPTIONS"],
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
  author: row.author,
  content: row.content,
  createdAt: row.created_at,
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

  const rows = db
    .prepare(`
      SELECT id, author, content, created_at
      FROM comments
      WHERE article_slug = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(slug, MAX_FETCH_COUNT);

  res.json({ comments: rows.map(mapCommentRow) });
});

app.post("/api/comments", (req, res) => {
  const articleSlug = normalizeSlug(req.body?.articleSlug || req.body?.article);
  const author = normalizeAuthor(req.body?.author);
  const content = normalizeContent(req.body?.content);

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

  const ipHash = hashIp(getClientIp(req));
  const rate = checkRateLimit(ipHash);

  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    res.status(429).json({ error: "Too many requests", retryAfter: rate.retryAfterSeconds });
    return;
  }

  const result = db
    .prepare(`
      INSERT INTO comments (article_slug, author, content, ip_hash)
      VALUES (?, ?, ?, ?)
    `)
    .run(articleSlug, author, content, ipHash);

  const inserted = db
    .prepare(`
      SELECT id, author, content, created_at
      FROM comments
      WHERE id = ?
    `)
    .get(result.lastInsertRowid);

  res.status(201).json({ comment: mapCommentRow(inserted) });
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
