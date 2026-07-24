# 位置上报 + 音频主动拉取

用户**手动点击**苹果快捷指令 → 上报 GPS → 若管理员已投递音频则下载播放。  
不做后台轮询、不要求常开 Safari。

## 启动

```bash
cd location-audio-pull
cp .env.example .env   # 填写 ADMIN_TOKEN
npm install
npm start
```

- 健康检查：`GET /health`
- 管理后台：`http://127.0.0.1:3003/admin.html`
- 用户拉取：`POST /api/pull`

生产环境可用 nginx 反代到该端口，并配置 HTTPS（快捷指令定位与请求建议 HTTPS）。

## 环境变量

见 `.env.example`。
