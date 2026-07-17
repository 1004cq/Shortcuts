export const dynamic = 'force-dynamic';

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { deleteStoredFile } from "@/lib/storage";
import {
  ApiError,
  jsonOk,
  requireAuth,
  requireAdmin,
  withApiHandler,
} from "@/lib/api";

type Ctx = { params: { id: string } };

export const GET = withApiHandler(async (_req: Request, ctx: unknown) => {
  await requireAuth();
  const { id } = (ctx as Ctx).params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("无效的文件 ID", 400);
  }

  await connectDB();
  const item = await FileModel.findById(id).populate("uploadedBy", "name email").lean();
  if (!item) {
    throw new ApiError("文件不存在", 404);
  }

  await FileModel.updateOne({ _id: id }, { $inc: { viewCount: 1 } });

  return jsonOk({ item });
});

export const DELETE = withApiHandler(async (_req: Request, ctx: unknown) => {
  await requireAdmin();
  const { id } = (ctx as Ctx).params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("无效的文件 ID", 400);
  }

  await connectDB();
  const item = await FileModel.findById(id);
  if (!item) {
    throw new ApiError("文件不存在", 404);
  }

  await deleteStoredFile(item.path);
  if (item.thumbnailPath) {
    await deleteStoredFile(item.thumbnailPath);
  }
  await item.deleteOne();

  return jsonOk({ message: "已删除" });
});
