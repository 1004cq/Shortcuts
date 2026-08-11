# 用户专属短链接音频控制系统（带次数计费）

每个用户拥有固定专属短链接，通过苹果快捷指令访问即可播放音频；每成功播放一次扣除 1 次。管理员可在后台管理用户、切换音频、充值次数，并查看剩余次数与使用次数。

## 1. 项目结构

```text
shortcuts-shortlink/
├── app.js                 # Express 主程序（短链接扣次 + 管理 API）
├── package.json           # 依赖与启动脚本
├── data/
│   └── users.json         # 用户数据（JSON 文件存储）
├── public/
│   └── admin.html         # 管理员后台（单页面）
└── README.md              # 本说明
```

## 2. 短链接规则

- 固定格式：`https://cq.imim.chat/apl/gt/{userId}`
- 服务端路由：`GET /apl/gt/:userId`
- 用户 ID：2–8 位，仅字母和数字（`a-z`、`A-Z`、`0-9`）

### 播放与扣次逻辑

1. 查找用户
2. 检查剩余次数是否 ≥ 1
3. 次数不足 → 返回纯文本「次数不足」
4. 次数足够 → `remainingTimes - 1`，`usedTimes + 1`，更新 `lastAccessTime`
5. `302` 重定向到当前 `audioUrl`

## 3. 数据字段（users.json）

| 字段 | 说明 |
|------|------|
| `userId` | 用户专属 ID |
| `audioUrl` | 当前音频 URL |
| `remainingTimes` | 剩余次数 |
| `usedTimes` | 已使用次数 |
| `lastAccessTime` | 最后访问时间（ISO 字符串，未访问为 `null`） |
| `createdAt` | 创建时间 |

## 4. 启动与使用

### 安装依赖

```bash
cd shortcuts-shortlink
npm install
```

### 启动服务

```bash
npm start
```

默认监听 `3005`（可用环境变量 `PORT` 覆盖）。

- 管理后台：`http://localhost:3005/admin.html`
- 默认账号：`admin` / `123456`
- 本地短链接示例：`http://localhost:3005/apl/gt/demo01`

### 生产域名反代说明

将 `https://cq.imim.chat/apl/` 反代到本服务（例如端口 `3005`），即可使用：

```text
https://cq.imim.chat/apl/gt/{userId}
```

## 5. 管理后台功能

- 简单登录（写死账号密码）
- 用户列表：用户ID、剩余次数、已使用次数、当前音频URL、最后访问时间
- 添加用户：手动输入或一键随机生成用户ID；设置初始次数与音频URL
- 修改用户音频
- 给用户充值次数
- 删除用户
- 一键复制专属短链接

## 6. 苹果快捷指令配置方法

1. 打开 iPhone「快捷指令」App → 点右上角「+」新建快捷指令  
2. 添加操作「获取 URL 的内容」（或「获取文件」）  
3. URL 填写用户专属短链接，例如：

   ```text
   https://cq.imim.chat/apl/gt/demo01
   ```

4. （推荐）再添加「播放声音」/「播放媒体」操作，把上一步获取到的内容作为音频输入  
5. 更稳妥的原生播放方式（适合自动播放）：

   - 添加「获取 URL 的内容」  
   - 高级选项里如有重定向相关设置，保持允许跟随重定向  
   - 或使用「打开 URL」+ 系统播放器（视 iOS 版本与场景选择）  
   - 常见可靠组合：  
     1）获取 URL 内容（音频）→ 2）播放声音  

6. 将快捷指令设为桌面图标或锁屏小组件，用户每次点按即访问短链接并扣 1 次  

### 次数不足时的表现

当剩余次数为 0 时，短链接返回 HTTP `403`，正文为：

```text
次数不足
```

可在快捷指令中根据错误提示用户联系管理员充值。

## 7. API 一览（管理员需登录 Cookie）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 管理员登录 |
| POST | `/api/logout` | 退出登录 |
| GET | `/api/users` | 用户列表 |
| GET | `/api/users/random-id` | 随机生成可用用户ID |
| POST | `/api/users` | 添加用户 |
| PUT | `/api/users/:userId/audio` | 修改音频 |
| POST | `/api/users/:userId/recharge` | 充值次数 |
| DELETE | `/api/users/:userId` | 删除用户 |
| GET | `/apl/gt/:userId` | 短链接播放并扣次 |
