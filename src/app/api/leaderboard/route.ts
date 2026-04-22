import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGlobalLeaderboard } from "@/lib/store";
import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!(await isValidAdminSession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getGlobalLeaderboard();
  return NextResponse.json({ rows });
}
