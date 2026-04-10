import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateSessionStatus } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const formData = await request.formData();
  const status = String(formData.get("status") ?? "draft") as
    | "draft"
    | "live"
    | "closed";

  await updateSessionStatus(id, status);
  return NextResponse.redirect(new URL(`/admin/sessions/${id}`, request.url));
}
