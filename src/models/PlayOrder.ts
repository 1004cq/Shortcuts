import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * PlayOrder — play-times purchase orders (Alipay / demo / admin).
 */
const PlayOrderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    packId: {
      type: Schema.Types.ObjectId,
      ref: "PlayPack",
      default: null,
    },
    times: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "CNY" },
    status: {
      type: String,
      enum: ["pending", "paid", "canceled", "failed"],
      default: "pending",
      index: true,
    },
    provider: {
      type: String,
      enum: ["manual", "alipay", "demo", "admin"],
      default: "manual",
    },
    providerPaymentId: {
      type: String,
      default: null,
      index: true,
    },
    providerTradeNo: {
      type: String,
      default: null,
    },
    alipayNotifyIds: {
      type: [String],
      default: [],
    },
    paidAt: { type: Date, default: null },
    note: { type: String, default: null, maxlength: 200 },
  },
  { timestamps: true }
);

PlayOrderSchema.index({ userId: 1, createdAt: -1 });
PlayOrderSchema.index({ providerPaymentId: 1 }, { unique: true, sparse: true });

export type PlayOrderDocument = InferSchemaType<typeof PlayOrderSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PlayOrder = models.PlayOrder || model("PlayOrder", PlayOrderSchema);
