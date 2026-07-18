# Remote Audio Push（低延迟远程音频）

用户 A 在 Web 控制台点「播放」→ Socket.io 推送 → 用户 B 的 iPhone 接收端自动播放（目标 1–3 秒）。

## 1. 服务器端

技术：Node.js + Express + Socket.io

```bash
cd remote-audio-push
cp .env.example .env
# 编辑 AUTH_TOKEN / PUBLIC_URL / CORS_ORIGIN
npm install
npm start
```

默认监听 `3002`。生产建议路径：`https://cq.imim.chat/realtime/`。

### 核心事件

| 方向 | 事件 | 说明 |
|------|------|------|
| Client→Server | `join` | `{ userId, role: "receiver"\|"controller" }` 加入 `user:{userId}` |
| Client→Server | `play` | `{ userId, audioUrl, title?, volume? }` |
| Client→Server | `stop` | `{ userId }` |
| Server→Client | `play` / `command` | 推送播放指令 |
| Server→Client | `stop` | 停止 |
| HTTP | `POST /api/play` | REST 兜底（Header `x-auth-token`） |

## 2. Web 后台

打开：`https://cq.imim.chat/realtime/`（或本地 `http://127.0.0.1:3002/`）

1. 填入 `AUTH_TOKEN`、目标 `userId`
2. 连接 WebSocket
3. 填音频 HTTPS URL → 点 **播放到 iPhone**

源码：`public/index.html`

## 3. 苹果快捷指令（详细步骤）

> 重要结论：iOS「快捷指令」**不能**在锁屏后台稳定长连 WebSocket。  
> 可靠低延迟方案：**快捷指令打开接收网页**（`receiver.html`），由页面 JS 维持连接并播放。

### 方案 A（推荐）：主屏幕接收端 + 开机捷径

#### A1. 添加到主屏幕

1. iPhone Safari 打开：  
   `https://cq.imim.chat/realtime/receiver.html?userId=USER_B&token=YOUR_TOKEN`
2. 分享 → **添加到主屏幕**，命名「远程音频」
3. 打开一次，点 **启动监听 / 解锁音频**（必须，过 iOS 自动播放限制）
4. 保持屏幕亮起或勿彻底划掉 App（见注意事项）

#### A2. 快捷指令「启动远程音频监听」

1. 打开「快捷指令」→ 新建快捷指令  
2. 添加动作：**打开 URL**  
   URL：  
   `https://cq.imim.chat/realtime/receiver.html?userId=USER_B&token=YOUR_TOKEN&autostart=1`
3. （可选）添加到主屏幕 / 锁屏控制中心
4. 每次需要接听远程播放前，跑一次该捷径

#### A3. 「在网页上运行 JavaScript」（可选增强）

若接收页已在 Safari 前台打开：

1. 动作：**Safari 网页** → 选择已打开的 `receiver.html`
2. 动作：**在网页上运行 JavaScript**，粘贴 `shortcuts/receiver-core.js` 中逻辑（或仅调用页面已有函数）
3. 该方式适合「页面已开、再注入配置」，**不能替代**页面本身的长连接

JavaScript 参考：`shortcuts/receiver-core.js`

### 方案 B：Scriptable（进阶）

1. 安装 Scriptable
2. 新建脚本，加载 Socket.io 较困难（无 DOM）；更现实的是 Scriptable 只负责 **打开 receiver URL** 或发本地通知
3. 仍建议以 `receiver.html` 为播放核心

### 音频 URL 要求

- 必须是 iPhone 可访问的 **HTTPS**
- 若走 MediaVault 私有流：使用带 API Token 的地址，例如：  
  `https://cq.imim.chat/api/files/{fileId}/stream?token=mv_xxx`
- 尽量用短文件或可快启的码率，降低「点播放→出声」时间

## 4. 部署建议

### systemd

```bash
# 上传 remote-audio-push 到 /opt/remote-audio-push
cd /opt/remote-audio-push && npm install --omit=dev
cp deploy/remote-audio-push.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now remote-audio-push
```

### nginx（必须支持 WebSocket Upgrade）

将 `deploy/nginx-snippet.conf` 插入 `cq.imim.chat` 的 443 server，**放在 `location /` 之前**，然后：

```bash
nginx -t && nginx -s reload
```

验证：

```bash
curl -sS https://cq.imim.chat/realtime/health
```

### 环境变量

见 `.env.example`。`AUTH_TOKEN` 务必使用长随机串。

## 5. 注意事项（延迟 / iOS 限制）

1. **自动播放策略**：首次必须有用户手势解锁 `Audio`（接收页按钮 / 快捷指令打开页）。  
2. **后台挂起**：Safari/主屏幕 Web App 进入后台数十秒～数分钟后，JS 定时器与 WS 可能被挂起；无法保证锁屏下永不断线。  
3. **断线重连**：接收端已启用 Socket.io `reconnection: Infinity` + 短 delay；回到前台后会自动重连。  
4. **低延迟清单**：  
   - 强制 `transports: ["websocket"]`（已配置）  
   - 音频 CDN/同源 HTTPS、避免超大文件头  
   - 接收端预热（保持在线）  
   - 控制台用 Socket `play` 而不是仅 HTTP  
5. **安全**：勿把 `AUTH_TOKEN` 写进公开仓库；可按 user 签发短期 token（后续增强）。  
6. **多设备**：同一 `userId` 多设备会同时收到 `play`。  

## 6. 与 MediaVault 集成

MediaVault 管理端可调用：

```http
POST https://cq.imim.chat/realtime/api/play
x-auth-token: YOUR_TOKEN
Content-Type: application/json

{
  "userId": "user_b",
  "audioUrl": "https://cq.imim.chat/api/files/FILE_ID/stream?token=mv_xxx",
  "title": "今晚的歌"
}
```

或打开控制台：`/realtime/`。
