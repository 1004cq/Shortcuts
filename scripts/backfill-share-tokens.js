/**
 * Backfill shareToken for files uploaded before auto-link feature.
 * Usage on server: node scripts/backfill-share-tokens.js
 */
const { webcrypto } = require("crypto");
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const mongoose = require("mongoose");

// Minimal nanoid-like token (avoid ESM nanoid in plain node)
function token() {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const bytes = require("crypto").randomBytes(24);
  let id = "f_";
  for (let i = 0; i < 24; i++) id += alphabet[bytes[i] % alphabet.length];
  return id;
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mediavault";

async function main() {
  await mongoose.connect(MONGODB_URI);
  const col = mongoose.connection.collection("files");
  const missing = await col.find({
    $or: [{ shareToken: null }, { shareToken: { $exists: false } }, { shareToken: "" }],
  }).toArray();
  console.log("files missing shareToken:", missing.length);
  for (const f of missing) {
    const shareToken = token();
    await col.updateOne({ _id: f._id }, { $set: { shareToken } });
    console.log("OK", f.name, shareToken);
  }
  await mongoose.disconnect();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
