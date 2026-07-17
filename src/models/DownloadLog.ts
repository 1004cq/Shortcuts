import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * DownloadLog — audit trail for downloads, streams, and previews.
 * Visible to admins for analytics / CSV export.
 */
const DownloadLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fileId: {
      type: Schema.Types.ObjectId,
      ref: "File",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["download", "stream", "preview"],
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
      maxlength: 512,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

DownloadLogSchema.index({ createdAt: -1 });
DownloadLogSchema.index({ userId: 1, createdAt: -1 });

export type DownloadLogDocument = InferSchemaType<typeof DownloadLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DownloadLog =
  models.DownloadLog || model("DownloadLog", DownloadLogSchema);
