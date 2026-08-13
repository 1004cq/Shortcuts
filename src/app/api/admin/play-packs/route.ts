export const dynamic = "force-dynamic";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { PlayPack } from "@/models/PlayPack";
import {
  ApiError,
  jsonOk,
  requireAdmin,
  withApiHandler,
} from "@/lib/api";
import {
  ensureDefaultPlayPacks,
  listAllPlayPacks,
  serializePack,
} from "@/lib/play-recharge";

/** GET /api/admin/play-packs */
export const GET = withApiHandler(async () => {
  await requireAdmin();
  await connectDB();
  const items = await listAllPlayPacks();
  return jsonOk({ items: items.map(serializePack) });
});

const upsertSchema = z.object({
  _id: z.string().optional(),
  label: z.string().trim().min(1).max(40),
  times: z.coerce.number().int().min(1).max(100000),
  priceYuan: z.coerce.number().min(0).max(100000),
  enabled: z.boolean().optional().default(true),
  sort: z.coerce.number().int().optional().default(0),
  highlighted: z.boolean().optional().default(false),
});

/** POST /api/admin/play-packs — create or update */
export const POST = withApiHandler(async (req: Request) => {
  await requireAdmin();
  await connectDB();
  await ensureDefaultPlayPacks();

  const body = upsertSchema.parse(await req.json());
  if (body._id) {
    const doc = await PlayPack.findById(body._id);
    if (!doc) throw new ApiError("档位不存在", 404);
    doc.label = body.label;
    doc.times = body.times;
    doc.priceYuan = body.priceYuan;
    doc.enabled = body.enabled;
    doc.sort = body.sort;
    doc.highlighted = body.highlighted;
    await doc.save();
    return jsonOk({ item: serializePack(doc.toObject()) });
  }

  const created = await PlayPack.create({
    label: body.label,
    times: body.times,
    priceYuan: body.priceYuan,
    enabled: body.enabled,
    sort: body.sort,
    highlighted: body.highlighted,
  });
  return jsonOk({ item: serializePack(created.toObject()) });
});

const deleteSchema = z.object({ _id: z.string().min(1) });

/** DELETE /api/admin/play-packs */
export const DELETE = withApiHandler(async (req: Request) => {
  await requireAdmin();
  await connectDB();
  const body = deleteSchema.parse(await req.json());
  const result = await PlayPack.deleteOne({ _id: body._id });
  if (result.deletedCount === 0) throw new ApiError("档位不存在", 404);
  return jsonOk({ ok: true });
});
