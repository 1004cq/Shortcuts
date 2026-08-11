# 用户专属短链接音频播放系统

每个用户拥有固定短链接 `https://cq.imim.chat/apl/{userId}`。用户在苹果快捷指令中只需填写该短链接；管理员在后台更换音频文件 ID 后，用户无需再改快捷指令。

## 项目结构

```text
shortcuts-shortlink/
├── app.js                 # Express 后端
├── package.json
├── data/
│   ├── users.json         # 用户数据
│   └── config.json        # 全局 API Token
├── public/
│   └── admin.html         # 管理后台单页
└── README.md
```

## 工作原理

1. 用户访问：`GET /apl/{userId}`
2. 服务端检查剩余次数 ≥ 1
3. 次数足够：`remainingTimes - 1`，`usedTimes + 1`，更新 `lastAccessTime`
4. 使用「全局 API Token + 用户 fileId」拼接真实下载地址并 302 跳转：

```text
https://cq.imim.chat/api/files/{fileId}/download?token={apiToken}
```

## 启动说明

```bash
cd shortcuts-shortlink
npm install
npm start
```

- 默认端口：`3005`（可用环境变量 `PORT` 覆盖）
- 管理后台：`http://localhost:3005/admin.html`
- 默认账号：`admin` / `123456`
- 本地短链接示例：`http://localhost:3005/apl/demo01`

### 首次使用

1. 登录管理后台
2. 在「全局 API Token 配置」中填入主站生成的 Token 并保存
3. 添加用户：填写用户 ID（或随机生成）、音频文件 ID、初始次数
4. 复制用户完整短链接发给用户

### 生产反代

将 `https://cq.imim.chat/apl/` 反代到本服务（例如 `3005`），即可使用正式短链接。

## 苹果快捷指令配置方法（用户只需填写短链接）

1. 打开 iPhone「快捷指令」→ 新建快捷指令  
2. 添加操作：**获取 URL 的内容**  
3. URL 填写自己的固定短链接，例如：

   ```text
   https://cq.imim.chat/apl/demo01
   ```

4. 再添加：**播放声音**（或「播放媒体」），把上一步获取到的内容作为音频输入  
5. 完成。之后管理员在后台更换该用户的音频文件 ID，用户**不需要再改**快捷指令  

### 可选说明

- 快捷指令应允许跟随重定向（默认一般允许），因为短链接会 302 到真实下载地址  
- 次数不足时，接口返回 HTTP `403`，正文为「次数不足」

## 管理后台功能

- 登录（账号密码写死）
- 配置全局 API Token
- 用户列表：用户ID、剩余次数、已使用次数、音频文件ID、最后访问时间
- 添加用户（2–8 位字母数字，可随机生成）
- 单独更换用户音频（fileId）
- 充值次数
- 删除用户
- 一键复制完整短链接 `https://cq.imim.chat/apl/{userId}`

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 管理员登录 |
| POST | `/api/logout` | 退出 |
| GET/POST | `/api/config` | 读取/保存全局 Token |
| GET | `/api/users` | 用户列表 |
| GET | `/api/users/random-id` | 随机用户ID |
| POST | `/api/users` | 添加用户 |
| PUT | `/api/users/:userId/file` | 更换音频 fileId |
| POST | `/api/users/:userId/recharge` | 充值次数 |
| DELETE | `/api/users/:userId` | 删除用户 |
| GET | `/apl/:userId` | 短链接播放并扣次 |
