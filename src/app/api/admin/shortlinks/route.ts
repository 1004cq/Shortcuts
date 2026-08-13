export const dynamic = "force-dynamic";

import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { ShortlinkUser } from "@/models/ShortlinkUser";
import { FileModel } from "@/models/File";
import { User } from "@/models/User";
import {
  ApiError,
  jsonOk,
  requireAdmin,
  withApiHandler,
} from "@/lib/api";
import { TimesAdjustLog } from "@/models/TimesAdjustLog";
import {
  buildPublicShortUrl,
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
  const file = await FileModel.findById(fileId)
    .select("_id name originalName category mimeType")
    .lean();
  if (!file) {
    throw new ApiError("音频文件不存在", 404);
  }
  return file;
}

async function assertLinkedUser(linkedUserId: string | null | undefined) {
  if (!linkedUserId) return null;
  if (!mongoose.Types.ObjectId.isValid(linkedUserId)) {
    throw new ApiError("无效的 MediaVault 用户 ID", 400);
  }
  const user = await User.findById(linkedUserId)
    .select("_id name email username")
    .lean();
  if (!user) {
    throw new ApiError("MediaVault 用户不存在", 404);
  }
  return user;
}

type LeanShortlink = {
  _id: mongoose.Types.ObjectId;
  userId: string;
  fileId?: mongoose.Types.ObjectId | null;
  linkedUserId?: mongoose.Types.ObjectId | null;
  remainingTimes?: number;
  usedTimes?: number;
  lastAccessTime?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

async function serializeMany(docs: LeanShortlink[]) {
  const fileIds = Array.from(
    new Set(
      docs.map((d) => (d.fileId ? String(d.fileId) : "")).filter(Boolean)
    )
  );
  const linkedIds = Array.from(
    new Set(
      docs
        .map((d) => (d.linkedUserId ? String(d.linkedUserId) : ""))
        .filter(Boolean)
    )
  );

  const [files, users] = await Promise.all([
    fileIds.length
      ? FileModel.find({ _id: { $in: fileIds } })
          .select("_id name originalName category mimeType")
          .lean()
      : Promise.resolve([]),
    linkedIds.length
      ? User.find({ _id: { $in: linkedIds } })
          .select("_id name email username")
          .lean()
      : Promise.resolve([]),
  ]);

  const fileMap = new Map(files.map((f) => [String(f._id), f]));
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return docs.map((doc) => {
    const file = doc.fileId ? fileMap.get(String(doc.fileId)) : null;
    const linked = doc.linkedUserId
      ? userMap.get(String(doc.linkedUserId))
      : null;
    return {
      _id: String(doc._id),
      userId: doc.userId,
      fileId: doc.fileId ? String(doc.fileId) : null,
      fileName: file?.name || file?.originalName || null,
      fileOriginalName: file?.originalName || null,
      fileCategory: file?.category || null,
      linkedUserId: linked ? String(linked._id) : null,
      linkedUserName: linked?.name || null,
      linkedUserEmail: linked?.email || null,
      linkedUsername: linked?.username || null,
      remainingTimes: Number(doc.remainingTimes) || 0,
      usedTimes: Number(doc.usedTimes) || 0,
      lastAccessTime: doc.lastAccessTime
        ? new Date(doc.lastAccessTime).toISOString()
        : null,
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
      shortUrl: buildPublicShortUrl(doc.userId),
    };
  });
}

async function serializeOne(doc: LeanShortlink) {
  const [item] = await serializeMany([doc]);
  return item;
}

/** GET /api/admin/shortlinks */
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
    // Also match by file name via pre-lookup
    const matchedFiles = await FileModel.find({
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { originalName: { $regex: escaped, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    const fileIds = matchedFiles.map((f) => f._id);

    filter.$or = [
      { userId: { $regex: escaped, $options: "i" } },
      ...(mongoose.Types.ObjectId.isValid(q) ? [{ fileId: q }] : []),
      ...(fileIds.length ? [{ fileId: { $in: fileIds } }] : []),
    ];
  }

  const items = await ShortlinkUser.find(filter).sort({ createdAt: -1 }).lean();
  return jsonOk({
    items: await serializeMany(items as LeanShortlink[]),
  });
});

const createSchema = z.object({
  userId: userIdSchema,
  fileId: z.string().min(1).nullable().optional(),
  remainingTimes: z.coerce.number().int().min(0).default(10),
  linkedUserId: z.string().nullable().optional(),
});

/** POST /api/admin/shortlinks — create */
export const POST = withApiHandler(async (req: Request) => {
  await requireAdmin();
  await connectDB();

  const body = createSchema.parse(await req.json());
  if (body.fileId) {
    await assertFileExists(body.fileId);
  }
  const linked = await assertLinkedUser(body.linkedUserId ?? null);

  if (linked) {
    const already = await ShortlinkUser.exists({ linkedUserId: linked._id });
    if (already) {
      throw new ApiError("该 MediaVault 用户已绑定短链接，请直接编辑", 409);
    }
  }

  const exists = await ShortlinkUser.exists({ userId: body.userId });
  if (exists) {
    throw new ApiError("用户ID已存在", 400);
  }

  const created = await ShortlinkUser.create({
    userId: body.userId,
    fileId: body.fileId || null,
    linkedUserId: linked?._id ?? null,
    remainingTimes: body.remainingTimes,
    usedTimes: 0,
    lastAccessTime: null,
  });

  return jsonOk({
    item: await serializeOne(created.toObject() as LeanShortlink),
  });
});

const patchSchema = z
  .object({
    /** Current shortlink userId (lookup key) */
    userId: userIdSchema,
    /** Optional rename — admin can manually change the public short path */
    newUserId: userIdSchema.optional(),
    fileId: z.string().min(1).optional(),
    addTimes: z.coerce.number().int().positive().optional(),
    /** Absolute remaining times (set) */
    remainingTimes: z.coerce.number().int().min(0).optional(),
    linkedUserId: z.string().nullable().optional(),
  })
  .refine(
    (v) =>
      v.newUserId !== undefined ||
      v.fileId !== undefined ||
      v.addTimes !== undefined ||
      v.remainingTimes !== undefined ||
      v.linkedUserId !== undefined,
    { message: "请提供要更新的字段" }
  );

/** PATCH /api/admin/shortlinks */
export const PATCH = withApiHandler(async (req: Request) => {
  const admin = await requireAdmin();
  await connectDB();

  const body = patchSchema.parse(await req.json());
  const doc = await ShortlinkUser.findOne({ userId: body.userId });
  if (!doc) {
    throw new ApiError("用户不存在", 404);
  }

  if (body.newUserId !== undefined && body.newUserId !== doc.userId) {
    const taken = await ShortlinkUser.exists({ userId: body.newUserId });
    if (taken) {
      throw new ApiError("该短链接 ID 已被占用", 409);
    }
    doc.userId = body.newUserId;
  }

  if (body.fileId !== undefined) {
    await assertFileExists(body.fileId);
    doc.fileId = new mongoose.Types.ObjectId(body.fileId);
  }

  const beforeRemaining = Number(doc.remainingTimes) || 0;
  let timesDelta = 0;
  if (body.remainingTimes !== undefined) {
    timesDelta = body.remainingTimes - beforeRemaining;
    doc.remainingTimes = body.remainingTimes;
  } else if (body.addTimes !== undefined) {
    timesDelta = body.addTimes;
    doc.remainingTimes = beforeRemaining + body.addTimes;
  }
  if (body.linkedUserId !== undefined) {
    const linked = await assertLinkedUser(body.linkedUserId);
    if (linked) {
      const clash = await ShortlinkUser.findOne({
        linkedUserId: linked._id,
        _id: { $ne: doc._id },
      }).lean();
      if (clash) {
        throw new ApiError("该 MediaVault 用户已绑定其他短链接", 409);
      }
    }
    doc.linkedUserId = linked?._id ?? null;
  }

  try {
    await doc.save();
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      throw new ApiError("该短链接 ID 已被占用", 409);
    }
    throw err;
  }

  if (timesDelta !== 0 && doc.linkedUserId) {
    await TimesAdjustLog.create({
      adminId: admin.id,
      adminEmail: admin.email,
      targetUserId: doc.linkedUserId,
      shortlinkUserId: doc.userId,
      delta: timesDelta,
      beforeRemaining,
      afterRemaining: Number(doc.remainingTimes) || 0,
      reason: body.addTimes !== undefined ? "管理员充次" : "管理员设置剩余次数",
    }).catch(() => null);
  }

  return jsonOk({
    item: await serializeOne(doc.toObject() as LeanShortlink),
  });
});

const deleteSchema = z.object({
  userId: userIdSchema,
});

/** DELETE /api/admin/shortlinks */
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
