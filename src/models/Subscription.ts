import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";
import type { MembershipPlan, SubscriptionStatus } from "@/types";

/**
 * Subscription — membership purchase / renewal records.
 */
const SubscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"] satisfies Exclude<MembershipPlan, "free">[],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "canceled", "expired", "pending"] satisfies SubscriptionStatus[],
      default: "pending",
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "CNY",
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    /** Payment channel */
    provider: {
      type: String,
      enum: ["manual", "alipay", "stripe", "epay", "wechat"],
      default: "manual",
    },
    /** Merchant order no. (out_trade_no) */
    providerPaymentId: {
      type: String,
      default: null,
      index: true,
    },
    /** Alipay trade_no / channel transaction id */
    providerTradeNo: {
      type: String,
      default: null,
      index: true,
    },
    /** Processed Alipay notify_id list (anti-replay) */
    alipayNotifyIds: {
      type: [String],
      default: [],
    },
    refundAmount: {
      type: Number,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

SubscriptionSchema.index({ userId: 1, status: 1 });

export type SubscriptionDocument = InferSchemaType<typeof SubscriptionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Subscription =
  models.Subscription || model("Subscription", SubscriptionSchema);
