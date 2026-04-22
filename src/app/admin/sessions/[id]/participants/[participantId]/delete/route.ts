import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { removeParticipantFromSession } from "@/lib/store";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; participantId: string }>;
  }
) {
  await requireAdmin();
  const { id, participantId } = await params;

  await removeParticipantFromSession(id, participantId);
  return NextResponse.redirect(new URL(`/admin/sessions/${id}`, request.url));
}
