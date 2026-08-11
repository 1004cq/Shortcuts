import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * ShortlinkUser — per-user fixed Shortcuts URL with play-count billing.
 * Public URL: /apl/{userId} → deduct 1 → redirect to file download.
 */
const ShortlinkUserSchema = new Schema(
  {
    /** Public short id: 2–8 alphanumeric, unique */
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 8,
      match: /^[a-zA-Z0-9]{2,8}$/,
      index: true,
    },
    /** MediaVault File ObjectId (audio binding) */
    fileId: {
      type: Schema.Types.ObjectId,
      ref: "File",
      required: true,
      index: true,
    },
    /** One-to-one link to a MediaVault account (required for users-module binding) */
    linkedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    remainingTimes: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    usedTimes: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastAccessTime: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

ShortlinkUserSchema.index({ createdAt: -1 });
/** At most one shortlink per MediaVault user */
ShortlinkUserSchema.index(
  { linkedUserId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { linkedUserId: { $type: "objectId" } } }
);
export type ShortlinkUserDocument = InferSchemaType<typeof ShortlinkUserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ShortlinkUser =
  models.ShortlinkUser || model("ShortlinkUser", ShortlinkUserSchema);
