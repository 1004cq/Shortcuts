import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * TimesAdjustLog — admin manual add/set of shortlink play times.
 */
const TimesAdjustLogSchema = new Schema(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    adminEmail: { type: String, default: null },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    shortlinkUserId: { type: String, required: true, index: true },
    delta: { type: Number, required: true },
    beforeRemaining: { type: Number, required: true },
    afterRemaining: { type: Number, required: true },
    reason: { type: String, default: "", maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

TimesAdjustLogSchema.index({ createdAt: -1 });

export type TimesAdjustLogDocument = InferSchemaType<typeof TimesAdjustLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const TimesAdjustLog =
  models.TimesAdjustLog || model("TimesAdjustLog", TimesAdjustLogSchema);
