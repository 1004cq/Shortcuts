# MediaVault Admin Realtime Dashboard

现代化管理后台仪表盘（玻璃态 / SSE / Recharts / Zustand）。

> 当前生产栈为 **Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui 风格组件**。  
> 已按 Next.js 15 的 Server/Client Components 最佳实践组织代码；若要升级到 Next 15，见文末。

## 功能

- 深色优先 + `next-themes` 明暗切换
- 折叠侧边栏 + 顶部 Header
- KPI 卡片、折线/面积图、柱状图、饼图、实时表格
- Zustand 管理仪表盘状态与侧栏折叠
- SSE：`/api/admin/stats/stream` 每 5 秒推送快照

## 初始化（本仓库已集成）

```bash
# 依赖
npm install
npm install recharts zustand

# 开发
npm run dev

# 生产构建
npm run build && npm start
```

打开：`http://localhost:3000/admin`（管理员登录后）  
线上：`https://cq.imim.chat/admin`

## 代码结构

```
src/app/admin/page.tsx                 # Server Component 入口
src/components/admin/AdminDashboardClient.tsx
src/components/admin/GlassCard.tsx
src/components/admin/KpiCard.tsx
src/components/admin/charts/*
src/components/layout/AdminShell.tsx   # 液态玻璃壳层
src/store/admin-dashboard.ts           # Zustand
src/lib/admin-stats.ts                 # 聚合查询
src/app/api/admin/stats/route.ts       # REST 快照
src/app/api/admin/stats/stream/route.ts# SSE
```

## 后续开发建议

1. **图表扩展**：在 `collectAdminStats()` 增加转化漏斗、ARPU 等序列，再挂到新 chart 组件。
2. **SSE 鉴权**：当前用 NextAuth JWT cookie；若要跨域面板，可改为短期 admin stream token。
3. **性能**：大屏可对表格做虚拟列表；图表数据先做服务端聚合，避免客户端二次计算。
4. **告警**：在 SSE `error` 事件或 KPI 阈值上接 toast / webhook。
5. **主题**：玻璃材质变量集中在 `globals.css`（`.liquid-glass` / `.aurora-blob`）。

## 可选：升级到 Next.js 15

```bash
npm install next@15 react@19 react-dom@19
npm install -D eslint-config-next@15 @types/react@19 @types/react-dom@19
```

升级后注意：

- 复查 `next-auth` v4 与 React 19 兼容性（必要时迁 Auth.js v5）
- App Router 里部分 `params` / `searchParams` 变为 Promise
- 重新跑 `npm run build` 与管理后台 SSE 冒烟测试
