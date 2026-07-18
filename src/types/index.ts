/**
 * MediaVault shared TypeScript types
 */

export type UserRole = "user" | "vip" | "admin";

export type MembershipPlan = "free" | "monthly" | "quarterly" | "yearly";

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
  /** Public handle (user-facing ID); null if not set */
  username?: string | null;
  /** Bound mobile number; null if not bound */
  phone?: string | null;
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
  /** Permanent Shortcuts share token (f_...) */
  shareToken?: string;
  /** Ready-made Shortcuts download URL */
  shortcutUrl?: string;
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
  interval: "month" | "quarter" | "year" | "forever";
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
    name: "月卡",
    price: 3,
    currency: "CNY",
    interval: "month",
    features: [
      "无限下载",
      "在线音视频播放",
      "流式传输大文件",
      "下载历史记录",
    ],
  },
  {
    id: "quarterly",
    name: "季卡",
    price: 9,
    currency: "CNY",
    interval: "quarter",
    highlighted: true,
    features: [
      "包含月卡全部权益",
      "有效期 3 个月",
      "优先客服支持",
    ],
  },
  {
    id: "yearly",
    name: "年卡",
    price: 36,
    currency: "CNY",
    interval: "year",
    features: [
      "包含月卡全部权益",
      "有效期 12 个月",
      "相当于每月 ¥3",
      "专属年度徽章",
    ],
  },
];
