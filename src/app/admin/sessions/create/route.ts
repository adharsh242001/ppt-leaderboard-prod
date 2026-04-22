import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSession } from "@/lib/store";

export async function POST(request: Request) {
  await requireAdmin();
  const formData = await request.formData();
  const title = String(formData.get("title") ?? "");
  const session = await createSession(title);
  return NextResponse.redirect(new URL(`/admin/sessions/${session.id}`, request.url));
}
