/**
 * MediaVault shared TypeScript types
 */

export type UserRole = "user" | "vip" | "admin";

export type MembershipPlan = "free" | "monthly" | "yearly";

export type FileCategory =
  | "video"
  | "audio"
  | "document"
  | "image"
  | "other";

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "expired"
  | "pending";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  membership: MembershipPlan;
  membershipExpiresAt?: string | null;
  emailVerified: boolean;
  image?: string | null;
}

export interface FileItem {
  _id: string;
  name: string;
  originalName: string;
  description?: string;
  category: FileCategory;
  mimeType: string;
  size: number;
  path: string;
  thumbnailPath?: string;
  tags: string[];
  uploadedBy: string;
  downloadCount: number;
  viewCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadLogItem {
  _id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  fileId: string;
  fileName?: string;
  action: "download" | "stream" | "preview";
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface PricingPlan {
  id: MembershipPlan;
  name: string;
  price: number;
  currency: string;
  interval: "month" | "year" | "forever";
  features: string[];
  highlighted?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "免费版",
    price: 0,
    currency: "CNY",
    interval: "forever",
    features: ["浏览文件列表", "查看文件元信息", "搜索与分类筛选"],
  },
  {
    id: "monthly",
    name: "月度会员",
    price: 29,
    currency: "CNY",
    interval: "month",
    highlighted: true,
    features: [
      "无限下载",
      "在线音视频播放",
      "流式传输大文件",
      "下载历史记录",
      "优先客服支持",
    ],
  },
  {
    id: "yearly",
    name: "年度会员",
    price: 288,
    currency: "CNY",
    interval: "year",
    features: [
      "包含月度全部权益",
      "相当于每月 ¥24",
      "专属年度徽章",
      "优先新功能体验",
    ],
  },
];
