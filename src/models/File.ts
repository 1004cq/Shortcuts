import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";
import type { FileCategory } from "@/types";

/**
 * File schema — metadata for uploaded media and documents.
 * Binary content lives on local disk under /uploads (path field).
 */
const FileSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
      index: "text",
    },
    originalName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    category: {
      type: String,
      enum: ["video", "audio", "document", "image", "other"] satisfies FileCategory[],
      required: true,
      index: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Relative path under UPLOAD_DIR, never expose absolute server paths to clients */
    path: {
      type: String,
      required: true,
    },
    thumbnailPath: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

FileSchema.index({ createdAt: -1 });
FileSchema.index({ category: 1, createdAt: -1 });

export type FileDocument = InferSchemaType<typeof FileSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const FileModel = models.File || model("File", FileSchema);
