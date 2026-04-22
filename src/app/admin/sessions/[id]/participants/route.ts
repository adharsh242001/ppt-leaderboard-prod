import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { addParticipantToSession } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "");

  await addParticipantToSession(id, name);
  return NextResponse.redirect(new URL(`/admin/sessions/${id}`, request.url));
}
