import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/auth";
import { removeParticipantFromSession } from "@/lib/store";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; participantId: string }>;
  }
) {
  const { id, participantId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!(await isValidAdminSession(token))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  await removeParticipantFromSession(id, participantId);
  return NextResponse.redirect(new URL(`/admin/sessions/${id}`, request.url));
}
