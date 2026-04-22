import { createHash, randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const ADMIN_COOKIE_NAME = "ppt-admin-session";

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getAdminUsername() {
  return (process.env.ADMIN_USERNAME ?? "admin").trim() || "admin";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? "ppt-admin";
}

function getSessionSecret() {
  return process.env.SESSION_SECRET ?? "dev-session-secret";
}

function hashSessionToken(token: string) {
  return createHash("sha256")
    .update(`${getSessionSecret()}:${token}`)
    .digest("hex");
}

async function ensureDefaultAdmin() {
  const username = getAdminUsername();
  const passwordHash = await hash(getAdminPassword(), 12);
  return prisma.admin.upsert({
    where: {
      username,
    },
    update: {},
    create: {
      username,
      passwordHash,
    },
  });
}

export async function verifyAdminPassword(password: string) {
  const admin = await ensureDefaultAdmin();
  return compare(password, admin.passwordHash);
}

export async function createAdminSessionToken() {
  const admin = await ensureDefaultAdmin();
  const token = randomBytes(32).toString("hex");

  await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000),
    },
  });

  return token;
}

export async function isValidAdminSession(token?: string | null) {
  if (!token) {
    return false;
  }

  const session = await prisma.adminSession.findUnique({
    where: {
      tokenHash: hashSessionToken(token),
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  if (!session) {
    return false;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.adminSession.delete({
      where: {
        id: session.id,
      },
    });
    return false;
  }

  return true;
}

export async function destroyAdminSession(token?: string | null) {
  if (!token) {
    return;
  }

  await prisma.adminSession.deleteMany({
    where: {
      tokenHash: hashSessionToken(token),
    },
  });
}

export async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!(await isValidAdminSession(token))) {
    redirect("/login");
  }
}
