import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/auth";
import { addParticipantToSession } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!(await isValidAdminSession(token))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "");
  await addParticipantToSession(id, name);
  return NextResponse.redirect(new URL(`/admin/sessions/${id}`, request.url));
}
