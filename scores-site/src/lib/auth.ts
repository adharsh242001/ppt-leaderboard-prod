import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE_NAME = "ppt-admin-session";

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? "ppt-admin";
}

function getSessionSecret() {
  return process.env.SESSION_SECRET ?? "dev-session-secret";
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

export function verifyAdminPassword(password: string) {
  return password === getAdminPassword();
}

export function createAdminSessionToken() {
  const payload = "admin";
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

export function isValidAdminSession(token?: string | null) {
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  const expected = signValue(payload);
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!isValidAdminSession(token)) {
    redirect("/login");
  }
}
