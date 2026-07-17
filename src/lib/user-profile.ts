import { z } from "zod";

/** China mainland mobile: 11 digits starting with 1[3-9] */
export const PHONE_REGEX = /^1[3-9]\d{9}$/;

/** Public handle used as user-facing ID */
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{2,24}$/;

export const phoneSchema = z
  .string()
  .trim()
  .regex(PHONE_REGEX, "请输入有效的中国大陆手机号");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_REGEX, "用户名需为 2–24 位字母、数字或下划线");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "昵称不能为空")
  .max(80, "昵称最多 80 个字符");

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, "");
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
