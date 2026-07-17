import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";
import type { UserRole, MembershipPlan } from "@/types";

/**
 * User schema — accounts, roles, and membership state.
 * Passwords are stored as bcrypt hashes only.
 */
const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // never return hash by default
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    role: {
      type: String,
      enum: ["user", "vip", "admin"] satisfies UserRole[],
      default: "user",
    },
    membership: {
      type: String,
      enum: ["free", "monthly", "yearly"] satisfies MembershipPlan[],
      default: "free",
    },
    membershipExpiresAt: {
      type: Date,
      default: null,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      select: false,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
      default: null,
    },
    image: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    /**
     * Personal API token for Apple Shortcuts / external clients.
     * Sent as ?token= or Authorization: Bearer — never log the raw value.
     */
    apiToken: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ role: 1, membership: 1 });

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User = models.User || model("User", UserSchema);
