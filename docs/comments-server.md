# 评论服务部署说明

## 1) 本地启动

安装依赖：

```bash
npm install
```

启动评论 API：

```bash
npm run start:comments
```

默认监听 `http://0.0.0.0:8787`，健康检查：

```bash
curl http://127.0.0.1:8787/api/health
```

## 2) 环境变量

- `PORT`：默认 `8787`
- `HOST`：默认 `0.0.0.0`
- `COMMENTS_DB_PATH`：SQLite 路径，默认 `server/data/comments.db`
- `CORS_ORIGINS`：允许跨域的站点，逗号分隔

示例：

```bash
PORT=8787 HOST=0.0.0.0 CORS_ORIGINS=https://armand.dev npm run start:comments
```

## 3) 前端连接评论 API

构建前设置：

```bash
COMMENTS_API_BASE=https://comments.armand.dev npm run build
```

不设置时：
- 本地 `localhost` 下默认请求 `http://localhost:8787`
- 线上默认请求当前域名下的 `/api`（适合反向代理）

## 4) 线上部署建议（Nginx 反代）

假设评论服务跑在 `127.0.0.1:8787`，在站点配置中加：

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8787/api/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

这样前端可以直接请求 `/api/comments`，不需要额外跨域。

## 5) API 简要

- `GET /api/comments?article=<slug>`：获取某篇文章评论
- `POST /api/comments`：提交评论

请求体：

```json
{
  "articleSlug": "rdp-cpp",
  "author": "Armand",
  "content": "这篇写得很清楚"
}
```

返回：

```json
{
  "comment": {
    "id": 1,
    "author": "Armand",
    "content": "这篇写得很清楚",
    "createdAt": "2026-04-05 13:00:00"
  }
}
```
