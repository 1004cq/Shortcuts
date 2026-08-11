export const dynamic = "force-dynamic";

import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { ShortlinkUser } from "@/models/ShortlinkUser";
import { FileModel } from "@/models/File";
import {
  ApiError,
  jsonOk,
  requireAdmin,
  withApiHandler,
} from "@/lib/api";
import {
  buildAplUrl,
  generateShortlinkUserId,
  SHORTLINK_USER_ID_REGEXP,
} from "@/lib/shortlink";

const userIdSchema = z
  .string()
  .regex(SHORTLINK_USER_ID_REGEXP, "用户ID需为2-8位字母或数字");

async function assertFileExists(fileId: string) {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError("无效的音频文件 ID", 400);
  }
  const file = await FileModel.findById(fileId).select("_id name").lean();
  if (!file) {
    throw new ApiError("音频文件不存在", 404);
  }
  return file;
}

function serialize(doc: Record<string, unknown>, req: Request) {
  const userId = String(doc.userId);
  return {
    _id: String(doc._id),
    userId,
    fileId: String(doc.fileId),
    remainingTimes: Number(doc.remainingTimes) || 0,
    usedTimes: Number(doc.usedTimes) || 0,
    lastAccessTime: doc.lastAccessTime
      ? new Date(doc.lastAccessTime as Date).toISOString()
      : null,
    createdAt: doc.createdAt
      ? new Date(doc.createdAt as Date).toISOString()
      : null,
    updatedAt: doc.updatedAt
      ? new Date(doc.updatedAt as Date).toISOString()
      : null,
    shortUrl: buildAplUrl(userId, req),
  };
}

/** GET /api/admin/shortlinks — list (+ optional ?action=random-id) */
export const GET = withApiHandler(async (req: Request) => {
  await requireAdmin();
  await connectDB();

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "random-id") {
    const existing = await ShortlinkUser.find().select("userId").lean();
    const userId = generateShortlinkUserId(existing.map((u) => u.userId));
    return jsonOk({ userId });
  }

  const q = (url.searchParams.get("q") || "").trim();
  const filter: Record<string, unknown> = {};
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { userId: { $regex: escaped, $options: "i" } },
      ...(mongoose.Types.ObjectId.isValid(q) ? [{ fileId: q }] : []),
    ];
  }

  const items = await ShortlinkUser.find(filter).sort({ createdAt: -1 }).lean();
  return jsonOk({
    items: items.map((item) => serialize(item as Record<string, unknown>, req)),
  });
});

const createSchema = z.object({
  userId: userIdSchema,
  fileId: z.string().min(1, "请填写音频文件 ID"),
  remainingTimes: z.coerce.number().int().min(0).default(0),
});

/** POST /api/admin/shortlinks — create user */
export const POST = withApiHandler(async (req: Request) => {
  await requireAdmin();
  await connectDB();

  const body = createSchema.parse(await req.json());
  await assertFileExists(body.fileId);

  const exists = await ShortlinkUser.exists({ userId: body.userId });
  if (exists) {
    throw new ApiError("用户ID已存在", 400);
  }

  const created = await ShortlinkUser.create({
    userId: body.userId,
    fileId: body.fileId,
    remainingTimes: body.remainingTimes,
    usedTimes: 0,
    lastAccessTime: null,
  });

  return jsonOk({
    item: serialize(created.toObject() as Record<string, unknown>, req),
  });
});

const patchSchema = z
  .object({
    userId: userIdSchema,
    fileId: z.string().min(1).optional(),
    /** Add this many plays (recharge) */
    addTimes: z.coerce.number().int().positive().optional(),
  })
  .refine((v) => v.fileId !== undefined || v.addTimes !== undefined, {
    message: "请提供 fileId 或 addTimes",
  });

/** PATCH /api/admin/shortlinks — change fileId and/or recharge */
export const PATCH = withApiHandler(async (req: Request) => {
  await requireAdmin();
  await connectDB();

  const body = patchSchema.parse(await req.json());
  const doc = await ShortlinkUser.findOne({ userId: body.userId });
  if (!doc) {
    throw new ApiError("用户不存在", 404);
  }

  if (body.fileId !== undefined) {
    await assertFileExists(body.fileId);
    doc.fileId = new mongoose.Types.ObjectId(body.fileId);
  }
  if (body.addTimes !== undefined) {
    doc.remainingTimes = (doc.remainingTimes || 0) + body.addTimes;
  }

  await doc.save();
  return jsonOk({
    item: serialize(doc.toObject() as Record<string, unknown>, req),
  });
});

const deleteSchema = z.object({
  userId: userIdSchema,
});

/** DELETE /api/admin/shortlinks — delete by userId */
export const DELETE = withApiHandler(async (req: Request) => {
  await requireAdmin();
  await connectDB();

  const body = deleteSchema.parse(await req.json());
  const result = await ShortlinkUser.deleteOne({ userId: body.userId });
  if (result.deletedCount === 0) {
    throw new ApiError("用户不存在", 404);
  }
  return jsonOk({ success: true });
});
