/**
 * Seed script — creates default admin + demo VIP / free users.
 * Usage: npm run seed
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mediavault";

async function main() {
  await mongoose.connect(MONGODB_URI);

  const UserSchema = new mongoose.Schema(
    {
      email: String,
      password: String,
      name: String,
      role: String,
      membership: String,
      membershipExpiresAt: Date,
      emailVerified: Boolean,
    },
    { timestamps: true }
  );

  const User = mongoose.models.User || mongoose.model("User", UserSchema);

  const users = [
    {
      email: "admin@mediavault.local",
      name: "Admin",
      role: "admin",
      membership: "yearly",
      password: "Admin123!",
      membershipExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    {
      email: "vip@mediavault.local",
      name: "VIP User",
      role: "vip",
      membership: "monthly",
      password: "Vip12345!",
      membershipExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    {
      email: "user@mediavault.local",
      name: "Free User",
      role: "user",
      membership: "free",
      password: "User1234!",
      membershipExpiresAt: null,
    },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 12);
    await User.findOneAndUpdate(
      { email: u.email },
      {
        $set: {
          name: u.name,
          password: hash,
          role: u.role,
          membership: u.membership,
          membershipExpiresAt: u.membershipExpiresAt,
          emailVerified: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`✓ ${u.email} / ${u.password}`);
  }

  await mongoose.disconnect();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
