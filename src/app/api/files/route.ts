import { z } from "zod";
import { connectDB } from "@/lib/db";
import { FileModel } from "@/models/File";
import { categoryFromMime } from "@/lib/utils";
import { saveUploadedFile, isUploadBlob } from "@/lib/storage";
import {
  ApiError,
  jsonError,
  jsonOk,
  requireAuth,
  requireUploadPermission,
  withApiHandler,
} from "@/lib/api";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  q: z.string().optional(),
  category: z
    .enum(["video", "audio", "document", "image", "other", "all"])
    .optional()
    .default("all"),
  sort: z.enum(["newest", "oldest", "name", "size", "downloads"]).optional().default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

/** GET /api/files — list / search (any authenticated user) */
export const GET = withApiHandler(async (req: Request) => {
  await requireAuth();
  await connectDB();

  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    q: url.searchParams.get("q") || undefined,
    category: url.searchParams.get("category") || undefined,
    sort: url.searchParams.get("sort") || undefined,
    page: url.searchParams.get("page") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return jsonError("查询参数无效", 400);
  }

  const { q, category, sort, page, limit } = parsed.data;
  const filter: Record<string, unknown> = { isPublic: true };

  if (category && category !== "all") {
    filter.category = category;
  }

  if (q?.trim()) {
    // Escape regex special chars to avoid ReDoS / injection-like patterns
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { originalName: { $regex: escaped, $options: "i" } },
      { tags: { $regex: escaped, $options: "i" } },
    ];
  }

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    name: { name: 1 },
    size: { size: -1 },
    downloads: { downloadCount: -1 },
  };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    FileModel.find(filter)
      .sort(sortMap[sort] || sortMap.newest)
      .skip(skip)
      .limit(limit)
      .populate("uploadedBy", "name email")
      .lean(),
    FileModel.countDocuments(filter),
  ]);

  return jsonOk({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

/** POST /api/files — upload (admin only) */
export const POST = withApiHandler(async (req: Request) => {
  const admin = await requireUploadPermission();
  await connectDB();

  const form = await req.formData();
  const file = form.get("file");
  // Avoid `instanceof File` — Node 18 may not expose global File (ReferenceError).
  if (!isUploadBlob(file)) {
    throw new ApiError("请选择要上传的文件", 400);
  }

  // 2 GB hard cap — adjust via env if needed
  const maxBytes = Number(process.env.MAX_UPLOAD_BYTES || 2 * 1024 * 1024 * 1024);
  if (file.size > maxBytes) {
    throw new ApiError("文件过大", 413);
  }

  const description = String(form.get("description") || "").slice(0, 2000);
  const tagsRaw = String(form.get("tags") || "");
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);

  const name =
    String(form.get("name") || "").trim() ||
    file.name.replace(/\.[^.]+$/, "") ||
    "未命名文件";

  const saved = await saveUploadedFile(file);
  const category =
    (form.get("category") as string) || categoryFromMime(saved.mimeType);

  const doc = await FileModel.create({
    name: name.slice(0, 255),
    originalName: saved.originalName,
    description,
    category: ["video", "audio", "document", "image", "other"].includes(category)
      ? category
      : categoryFromMime(saved.mimeType),
    mimeType: saved.mimeType,
    size: saved.size,
    path: saved.relativePath,
    tags,
    uploadedBy: admin.id,
    isPublic: true,
  });

  return jsonOk({ item: doc }, { status: 201 } as ResponseInit);
});
