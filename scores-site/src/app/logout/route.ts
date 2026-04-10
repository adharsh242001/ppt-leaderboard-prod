import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, destroyAdminSession } from "@/lib/auth";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  await destroyAdminSession(token);
  cookieStore.delete(ADMIN_COOKIE_NAME);
  return NextResponse.redirect(new URL("/login", request.url));
}
