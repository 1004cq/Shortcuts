# 支付宝电脑网站支付示例

独立 Express 演示，目录结构：

```text
alipay-website-payment/
├── config/alipay.js       # 配置（读 .env）
├── controllers/payment.js # 下单 / 通知 / 回跳 / 查单
├── routes/payment.js      # 路由
├── utils/alipaySDK.js     # alipay-sdk 封装
├── public/
│   ├── index.html         # 商品页
│   └── success.html       # 支付结果页
├── .env.example
├── server.js
└── package.json
```

> MediaVault 主站已内置同等能力（`src/lib/alipay.ts` + `/api/payments/alipay/*`）。本目录用于单独调试支付宝对接。

## 快速开始

```bash
cd alipay-website-payment
npm install
cp .env.example .env
# 编辑 .env，填入开放平台 APPID、应用私钥、支付宝公钥
npm start
```

浏览器打开 `http://localhost:4000`。

## 开放平台准备

1. [支付宝开放平台](https://open.alipay.com) 创建应用  
2. 开通能力：**电脑网站支付**、**手机网站支付**  
3. 设置接口加签方式（RSA2），上传应用公钥，保存**支付宝公钥**  
4. 密钥格式：本项目默认 `ALIPAY_KEY_TYPE=PKCS8`（与密钥工具「PKCS8」一致）

## 回调地址

| 类型 | 默认地址 | 说明 |
|------|----------|------|
| 异步通知 `notify_url` | `{APP_URL}/api/payment/notify` | 必须公网可达；验签成功后返回纯文本 `success` |
| 同步回跳 `return_url` | `{APP_URL}/api/payment/return` | 仅展示；最终以异步通知 / 查单为准 |

本地调试可用内网穿透（如 frp / ngrok）把 `APP_URL` 指到本机。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查与配置状态 |
| GET | `/api/payment/products` | 商品列表 |
| POST | `/api/payment/create` | `{ "productId": "monthly" \| "yearly" }` → `{ payUrl }` |
| POST | `/api/payment/notify` | 支付宝异步通知 |
| GET | `/api/payment/return` | 同步回跳 → 重定向 `success.html` |
| GET | `/api/payment/query?outTradeNo=` | 查询订单 |

## 与 MediaVault 对接

生产环境请在 MediaVault 根目录 `.env` / 服务器 `/opt/mediavault/.env` 配置相同的 `ALIPAY_*` 变量，会员页会跳转官方收银台并在通知中开通 VIP。不必单独长期运行本演示服务。

## 注意

- **不要**把 `.env` 提交到 Git  
- 演示订单存在内存中，进程重启会丢失；生产务必落库并做幂等  
- Node 18 已内置 `File`/`Blob` polyfill，与腾讯云当前运行环境兼容  
