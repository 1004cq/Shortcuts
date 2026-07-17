import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";
import type { MembershipPlan, SubscriptionStatus } from "@/types";

/**
 * Subscription — membership purchase / renewal records.
 * Stripe / 易支付 provider fields are optional for future payment integration.
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
      enum: ["monthly", "yearly"] satisfies Exclude<MembershipPlan, "free">[],
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
    /** External payment provider reference (Stripe session id / 易支付 order no.) */
    provider: {
      type: String,
      enum: ["manual", "stripe", "epay", "wechat"],
      default: "manual",
    },
    providerPaymentId: {
      type: String,
      default: null,
      index: true,
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
