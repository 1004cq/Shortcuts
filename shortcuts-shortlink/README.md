# shortcuts-shortlink（已弃用 / DEPRECATED）

本目录是历史独立 Express 短链接服务。

**短链接音频计费已合并进 MediaVault：**

| 能力 | 新位置 |
|------|--------|
| 短链接播放 | `GET /apl/:userId`（Next.js） |
| 管理后台 | `/admin/shortlinks`（MediaVault 管理员登录） |
| 数据 | MongoDB `shortlinkusers` 集合 |
| 下载 | 重定向到 `/api/files/{fileId}/download?token=...` |

请勿再使用本目录的 `admin.html` 或独立端口 `3005`。

迁移旧 JSON 用户：

```bash
npx tsx scripts/migrate-shortlink-users.ts shortcuts-shortlink/data/users.json
```

服务器上若仍有 PM2 `audio-shortcuts`，合并部署后应停止，并把 nginx `/apl/` 指回 MediaVault（3000）。
