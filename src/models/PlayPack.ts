import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * PlayPack — admin-configurable recharge packages (times + price).
 */
const PlayPackSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 40 },
    times: { type: Number, required: true, min: 1 },
    priceYuan: { type: Number, required: true, min: 0 },
    enabled: { type: Boolean, default: true, index: true },
    sort: { type: Number, default: 0 },
    /** Highlighted on recharge page */
    highlighted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PlayPackSchema.index({ enabled: 1, sort: 1 });

export type PlayPackDocument = InferSchemaType<typeof PlayPackSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PlayPack = models.PlayPack || model("PlayPack", PlayPackSchema);
