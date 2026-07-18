# 管理员后台 · 远程音频控制（使用说明）

线上地址：
- **管理员后台**：https://cq.imim.chat/realtime/
- **iPhone 接收端**：https://cq.imim.chat/realtime/receiver.html
- Token 文件（服务器）：`/opt/remote-audio-push/TOKEN.txt`（即 `ADMIN_TOKEN` / `AUTH_TOKEN`）

用户端**无需登录**，只需提前运行快捷指令保持 WebSocket 连接。  
**只有管理员 Token** 才能发送播放/停止指令。

---

## 1. Node.js 服务器代码

完整文件：[`server.js`](./server.js)

```bash
cd remote-audio-push
cp .env.example .env
npm install
npm start
```

环境变量（`.env`）：

| 变量 | 说明 |
|------|------|
| `ADMIN_TOKEN` | 管理员后台专用（可发 play/stop） |
| `RECEIVER_TOKEN` | iPhone 接收端连接用；不填则等于 `ADMIN_TOKEN` |
| `AUTH_TOKEN` | 兼容旧配置，可当作 `ADMIN_TOKEN` |
| `PUBLIC_URL` | 如 `https://cq.imim.chat/realtime` |
| `PORT` | 默认 `3002` |

低延迟要点：Socket.io 强制 WebSocket、`play` 事件直推房间 `user:{userId}`，管理员不进用户房间以免干扰。

---

## 2. 管理员后台 HTML + JS

完整文件：[`public/index.html`](./public/index.html)

操作：
1. 打开 https://cq.imim.chat/realtime/
2. 填入管理员 Token → **连接控制通道**
3. 填「目标用户 ID」+「音频 HTTPS URL」
4. 点 **立即播放到该用户**
5. 看日志里的 `play RTT`（通常几十～几百 ms 为信令延迟；出声还取决于音频首包下载）

---

## 3. iPhone 快捷指令流程 + JavaScript

### 为什么要打开网页？

系统「快捷指令」**无法在后台长期维持 WebSocket**。可靠做法：

> 快捷指令打开接收网页 → 网页 JS 维持连接并播放

接收页完整代码：[`public/receiver.html`](./public/receiver.html)  
JS 参考：[`shortcuts/receiver-core.js`](./shortcuts/receiver-core.js)

### 详细步骤

#### Step A：配置接收端（每个 iPhone 一次）

1. 给用户分配一个固定 `userId`（如 `iphone_01`）
2. Safari 打开（把 token / userId 换成真实值）：

```text
https://cq.imim.chat/realtime/receiver.html?userId=iphone_01&token=RECEIVER或ADMIN的TOKEN&autostart=1
```

3. 分享 → **添加到主屏幕**，命名「远程音频」
4. 打开后点一次 **启动监听 / 解锁音频**（必须，否则 iOS 禁止自动播放）

#### Step B：快捷指令「保持连接」

1. 打开「快捷指令」App → 右上角 **+**
2. 添加动作：**打开 URL**
3. URL 填：

```text
https://cq.imim.chat/realtime/receiver.html?userId=iphone_01&token=你的TOKEN&autostart=1
```

4. （可选）添加到主屏幕 / 锁屏控制中心  
5. **每次需要被远程播放前**，先运行该捷径，并尽量保持接收页在前台

#### Step C：（可选）在网页上运行 JavaScript

仅当 `receiver.html` 已在 Safari 打开时可用；用于注入配置，不能替代长连接。  
代码见 `shortcuts/receiver-core.js`。

---

## 4. 注意事项（iOS 后台保活 / 延迟）

### iOS 限制（必读）

1. **自动播放**：必须先有一次用户点击解锁 `Audio`（接收页按钮）。
2. **后台挂起**：锁屏或切走 App 后，Safari/主屏幕 Web App 的 JS/WS **可能被系统挂起**，无法保证 7×24 后台在线。
3. **实用策略**：
   - 播放前让用户先跑快捷指令打开接收端
   - 保持屏幕常亮（快捷指令/辅助功能）或勿彻底上滑关掉
   - 回前台后会自动重连（已开 `reconnection: Infinity`）
4. **无法做到**：完全不亮屏、不打开任何页面的「纯后台秒播」（受 iOS 安全策略限制）

### 降低延迟清单

- 管理员用 WebSocket `play`（不要只靠轮询）
- 音频用短文件 / 可快启的 HTTPS（CDN 或本站）
- 接收端提前在线（预热连接）
- 私有音频可用 MediaVault：`/api/files/{id}/stream?token=mv_xxx`

### 安全

- **ADMIN_TOKEN** 只给管理员，不要写进用户捷径（若必须写，请另设较弱的 `RECEIVER_TOKEN`）
- 用户捷径里只放 `RECEIVER_TOKEN` + 自己的 `userId`
- 接收端即使拿到 `RECEIVER_TOKEN` 也无法发送播放指令

### 联调检查

```bash
curl -sS https://cq.imim.chat/realtime/health
# 管理员推送示例
curl -sS -X POST https://cq.imim.chat/realtime/api/play \
  -H "content-type: application/json" \
  -H "x-auth-token: ADMIN_TOKEN" \
  -d '{"userId":"iphone_01","audioUrl":"https://example.com/a.mp3","title":"test"}'
```
