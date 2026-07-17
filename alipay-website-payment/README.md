# 支付宝电脑网站支付（Node.js + Express）

完整可运行的 **电脑网站支付** 集成示例：沙箱 / 生产一键切换，官方 `alipay-sdk`，RSA2 验签。

## 项目结构

```text
alipay-website-payment/
├── config/
│   └── alipay.js              # 读取 .env（APP_ID / PRIVATE_KEY / GATEWAY…）
├── controllers/
│   └── payment.js             # 下单、notify、return、查单（内存订单）
├── routes/
│   └── payment.js             # 路由挂载
├── utils/
│   ├── alipaySDK.js           # page.pay Form、RSA2 验签、查单
│   └── logger.js
├── public/
│   ├── index.html             # 商品页 + 立即支付（Bootstrap）
│   └── success.html           # 支付结果页（成功/失败/超时）
├── .env.example
├── .gitignore
├── server.js
├── package.json
└── README.md
```

## 核心接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 首页商品展示 |
| POST | `/create-payment` | 生成 `ORDER_` 订单号，调用 `alipay.trade.page.pay`，返回 Form HTML |
| GET | `/return` | 同步跳转 → 验签/查单 → `success.html` |
| POST | `/notify` | 异步通知 → **RSA2 严格验签** → 更新订单 → 返回 `success` |
| GET | `/api/order?outTradeNo=` | 查询订单（前端轮询） |
| GET | `/api/health` | 环境与配置摘要 |

---

## 第一步：安装依赖并配置密钥

```bash
cd alipay-website-payment
npm install
cp .env.example .env
```

编辑 `.env`：

```env
APP_ID=你的APPID
PRIVATE_KEY=你的应用私钥
ALIPAY_PUBLIC_KEY=支付宝公钥
KEY_TYPE=PKCS8

# 沙箱网关（联调）
GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
ALIPAY_SANDBOX=true

# 本地先这样；要测异步通知请换成公网 HTTPS
APP_URL=http://localhost:4000
NOTIFY_URL=http://localhost:4000/notify
RETURN_URL=http://localhost:4000/return

# 首页商品（金额/标题可改）
PRODUCT_TITLE=测试商品 - MediaVault 会员
PRODUCT_AMOUNT=0.01
PRODUCT_DESC=沙箱建议使用 0.01 元完成联调
```

### 沙箱 ↔ 生产切换

| 环境 | `GATEWAY` | `ALIPAY_SANDBOX` | 密钥来源 |
|------|-----------|------------------|----------|
| 沙箱 | `https://openapi-sandbox.dl.alipaydev.com/gateway.do` | `true` | 沙箱应用 |
| 生产 | `https://openapi.alipay.com/gateway.do` | `false` | 正式应用 |

> 生产务必使用 HTTPS 的 `NOTIFY_URL` / `RETURN_URL`，并在开放平台配置一致。

---

## 第二步：启动服务

```bash
npm start
# 开发热重载：npm run dev
```

浏览器打开：http://localhost:4000

---

## 第三步：沙箱测试流程

1. 登录 [支付宝开放平台](https://open.alipay.com) → 开发者中心 → **沙箱**  
2. 确认沙箱应用已开通「电脑网站支付」  
3. 在「沙箱账号」中拿到买家账号 / 登录密码 / 支付密码  
4. 本项目 `.env` 使用沙箱 `APP_ID`、沙箱应用私钥、沙箱支付宝公钥  
5. 打开首页，确认徽章显示 **沙箱 sandbox**、**密钥已配置**  
6. 点击 **立即支付** → 自动跳转支付宝收银台  
7. 使用沙箱买家账号完成支付  
8. 浏览器回到 `/return` → `success.html` 展示结果  
9. 若配置了公网 `NOTIFY_URL`，服务端日志应出现 `订单支付成功`，并返回 `success`

### 本地如何收到异步 notify？

支付宝服务器必须能访问你的 `NOTIFY_URL`。本地请使用内网穿透（ngrok / frp / cpolar）：

```env
APP_URL=https://xxxx.ngrok-free.app
NOTIFY_URL=https://xxxx.ngrok-free.app/notify
RETURN_URL=https://xxxx.ngrok-free.app/return
```

然后重启 `npm start`，再测一笔支付。

---

## 支付时序（简要）

```text
浏览器                你的服务                 支付宝
  |--POST /create-payment-->|                     |
  |                         |--page.pay 签名------>|
  |<----- Form HTML --------|                     |
  |--自动提交 Form -------------------------------->|
  |                         |                     | 用户付款
  |<---------------- GET /return（同步）-----------|
  |                         |<--- POST /notify ---|
  |                         |--- 验签+更新订单 --->|
  |                         |--- "success" ------>|
```

> **以异步 `/notify` 为准**；`/return` 仅用于展示。

---

## 常见错误排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 首页提示「未配置密钥」 | `.env` 未填或未重启 | 检查 `APP_ID` / `PRIVATE_KEY` / `ALIPAY_PUBLIC_KEY`，重启 |
| 跳转支付宝报签名错误 | 私钥与 APPID 不匹配，或 `KEY_TYPE` 不对 | PKCS8/PKCS1 与密钥头一致；确认用的是**应用私钥** |
| notify 验签失败 | 配成了应用公钥 | 必须填**支付宝公钥** |
| 支付成功但一直「处理中」 | 本地收不到 notify | 配置公网 `NOTIFY_URL`；或点「刷新订单状态」（会 `trade.query`） |
| `TRADE_CLOSED` / 超时 | 未付款或超时关闭 | 重新下单；沙箱确认买家账号可用 |
| 金额不一致 fail | 回调金额与本地订单不符 | 勿篡改订单金额；核对 `PRODUCT_AMOUNT` |
| 服务重启后订单查不到 | 内存存储 | 演示限制；生产请换 MongoDB/MySQL |

查看日志：

```bash
# 终端会输出 JSON 结构化日志，关注 tag=notify / alipaySDK / payment
npm start
```

---

## 安全说明

- 私钥 **只** 放在 `.env`（已 `.gitignore`），禁止写进代码仓库  
- `/notify`、`/return` **必须验签**  
- 订单号格式：`ORDER_` + 时间戳 + 随机数，创建前做唯一性检查  
- 使用 `notify_id` 防重放；已支付订单重复通知仍返回 `success`（幂等）

---

## 部署建议（生产）

1. 服务器安装 Node.js ≥ 18.20  
2. 上传代码（不含 `.env`），配置生产环境变量  
3. `GATEWAY=https://openapi.alipay.com/gateway.do`  
4. Nginx 反代 HTTPS → `http://127.0.0.1:4000`  
5. 使用 `pm2` / `systemd` 守护进程  
6. 将内存订单替换为数据库，并做对账任务  

```bash
npm install --production
# 配置好 .env 后
npm start
# 或
pm2 start server.js --name alipay-pay
```

---

## 订单状态说明

| status | 含义 |
|--------|------|
| `pending` | 已下单，等待支付 |
| `paid` | 支付成功（notify 或 query 确认） |
| `closed` | 关闭/超时未付 |
| `timedOut`（展示字段） | 本地超过 30 分钟仍 pending |

前端 `success.html` 会区分：成功 / 处理中 / 失败超时 / 验签失败。
