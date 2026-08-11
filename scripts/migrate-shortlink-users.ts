#!/usr/bin/env tsx
/**
 * Migrate legacy shortcuts-shortlink JSON users into MediaVault MongoDB.
 *
 * Usage:
 *   MONGODB_URI=mongodb://127.0.0.1:27017/mediavault \
 *   npx tsx scripts/migrate-shortlink-users.ts [path/to/users.json]
 *
 * Default JSON path: shortcuts-shortlink/data/users.json
 *
 * Notes:
 * - Skips invalid userId / missing fileId
 * - Skips rows whose fileId is not a valid ObjectId or file does not exist
 * - Existing Mongo userId is left unchanged (no overwrite)
 */

import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { ShortlinkUser } from "../src/models/ShortlinkUser";
import { FileModel } from "../src/models/File";
import { isValidShortlinkUserId } from "../src/lib/shortlink";

type LegacyUser = {
  userId?: string;
  fileId?: string;
  remainingTimes?: number;
  usedTimes?: number;
  lastAccessTime?: string | null;
  createdAt?: string | null;
};

async function main() {
  const jsonPath = path.resolve(
    process.argv[2] ||
      path.join(process.cwd(), "shortcuts-shortlink/data/users.json")
  );

  if (!fs.existsSync(jsonPath)) {
    console.error(`JSON not found: ${jsonPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as LegacyUser[];
  if (!Array.isArray(raw)) {
    console.error("Expected users.json to be an array");
    process.exit(1);
  }

  await connectDB();

  let inserted = 0;
  let skipped = 0;

  for (const row of raw) {
    const userId = String(row.userId || "").trim();
    const fileId = String(row.fileId || "").trim();

    if (!isValidShortlinkUserId(userId)) {
      console.warn(`skip invalid userId: ${row.userId}`);
      skipped++;
      continue;
    }
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      console.warn(`skip ${userId}: invalid fileId ${fileId}`);
      skipped++;
      continue;
    }

    const fileExists = await FileModel.exists({ _id: fileId });
    if (!fileExists) {
      console.warn(`skip ${userId}: file not found ${fileId}`);
      skipped++;
      continue;
    }

    const exists = await ShortlinkUser.exists({ userId });
    if (exists) {
      console.warn(`skip ${userId}: already in MongoDB`);
      skipped++;
      continue;
    }

    await ShortlinkUser.create({
      userId,
      fileId,
      remainingTimes: Math.max(0, Number(row.remainingTimes) || 0),
      usedTimes: Math.max(0, Number(row.usedTimes) || 0),
      lastAccessTime: row.lastAccessTime ? new Date(row.lastAccessTime) : null,
      createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
    });
    inserted++;
    console.log(`inserted ${userId}`);
  }

  console.log(`done. inserted=${inserted} skipped=${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
