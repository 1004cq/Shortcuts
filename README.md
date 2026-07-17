# MediaVault

会员制媒体文件管理与流媒体播放平台。免费用户可浏览文件列表；VIP 可下载与在线播放；管理员可上传文件并查看下载统计。

## 技术栈

- **前端 / 后端**: Next.js 14 (App Router) + TypeScript
- **UI**: Tailwind CSS + Shadcn/ui + lucide-react（深色优先）
- **认证**: NextAuth.js (Credentials + JWT)
- **数据库**: MongoDB + Mongoose
- **存储**: 本地 `uploads/`（可扩展 OSS）
- **播放**: Video.js（支持 Range / 流式传输）

## 项目结构

```
src/
  app/
    (pages) login, register, verify, pricing, profile, files/[id]
    admin/           # 管理后台
    api/
      auth/          # NextAuth + 注册/邮箱验证
      files/         # 列表、上传、详情、下载、流式播放
      downloads/     # 下载记录 + CSV 导出
      subscriptions/ # 会员开通（演示模式）
      admin/         # 统计 / 用户管理
  components/
    layout/          # Sidebar, Topbar, MainContent, AppShell, AdminShell
    files/           # FileTable, FileGrid, VideoPlayer, UploadDialog
    ui/              # Shadcn 组件
  lib/               # db, auth, permissions, storage, api helpers
  models/            # User, File, DownloadLog, Subscription
  types/
scripts/seed.ts
uploads/
Dockerfile
docker-compose.yml
```

## 数据库 Schema

| 集合 | 说明 |
|------|------|
| **User** | 邮箱、bcrypt 密码、role(`user`/`vip`/`admin`)、membership、验证令牌 |
| **File** | 名称、分类、MIME、大小、本地路径、标签、下载/浏览计数 |
| **DownloadLog** | userId、fileId、action(`download`/`stream`/`preview`)、IP、UA |
| **Subscription** | plan、status、金额、起止时间、支付渠道字段 |

## 权限规则

| 能力 | 免费用户 | VIP | 管理员 |
|------|----------|-----|--------|
| 浏览列表 / 搜索 | ✓ | ✓ | ✓ |
| 下载 / 流媒体播放 | ✗ | ✓ | ✓ |
| 上传 / 删除文件 | ✗ | ✗ | ✓ |
| 查看全站下载统计 | ✗ | ✗ | ✓ |

中间件：`src/middleware.ts`（路由级）+ `src/lib/permissions.ts` + API `require*` 助手。

## 本地运行

### 1. 依赖

```bash
npm install
cp .env.example .env.local
```

编辑 `.env.local`，至少设置：

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=请换成长随机字符串
MONGODB_URI=mongodb://127.0.0.1:27017/mediavault
```

### 2. 启动 MongoDB

```bash
# 若已安装 Docker：
docker run -d --name mediavault-mongo -p 27017:27017 mongo:7
```

### 3. 初始化账号

```bash
npm run seed
```

默认账号：

| 邮箱 | 密码 | 角色 |
|------|------|------|
| admin@mediavault.local | Admin123! | 管理员 |
| vip@mediavault.local | Vip12345! | VIP |
| user@mediavault.local | User1234! | 免费用户 |

### 4. 开发服务器

```bash
npm run dev
```

打开 http://localhost:3000

未配置 SMTP 时，注册接口会在响应 / 控制台输出邮箱验证链接。

## Docker 部署

```bash
docker compose up -d --build
```

- 应用: http://localhost:3000  
- MongoDB: `mongo:27017`（容器网络内）  
- 上传卷: `mediavault_uploads`

生产环境请务必修改 `NEXTAUTH_SECRET`，并配置 HTTPS 与真实支付（Stripe / 易支付）。

## 主要 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/verify` | 邮箱验证 |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth |
| GET/POST | `/api/files` | 列表 / 上传 |
| GET/DELETE | `/api/files/:id` | 详情 / 删除 |
| GET | `/api/files/:id/download` | VIP 下载 |
| GET | `/api/files/:id/stream` | VIP 流式（Range） |
| GET | `/api/downloads` | 下载记录 / CSV |
| POST | `/api/subscriptions` | 开通会员（演示） |
| GET | `/api/admin/stats` | 仪表盘 |
| GET/PATCH | `/api/admin/users` | 用户管理 |

## UI 布局

- 全局：`Sidebar` + `Topbar` + `MainContent`
- 手机端：侧栏抽屉 + 底部 `MobileTabBar`
- 登录/注册：全屏居中卡片
- 视频页：沉浸式播放器 + 右侧信息栏
- 管理后台：独立深色 `AdminShell`

主色 `#3b82f6`，成功色 `#10b981`，深色模式优先，支持浅色切换。

## 后续可扩展

- Stripe / 易支付 / 微信支付 Webhook
- 对象存储（S3 / OSS）替换 `src/lib/storage.ts`
- HLS 转码流水线
- WebDAV 挂载
