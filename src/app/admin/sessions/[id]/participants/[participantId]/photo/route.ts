import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getParticipantFromSession } from "@/lib/store";
import {
  getPhotoBaseName,
  isSupportedPhotoFile,
  normalizeParticipantName,
} from "@/lib/photoMatching";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";

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
  const participant = await getParticipantFromSession(id, participantId);

  if (!participant) {
    return NextResponse.redirect(new URL(`/admin/sessions/${id}`, request.url));
  }

  const formData = await request.formData();
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.redirect(new URL(`/admin/sessions/${id}`, request.url));
  }

  if (!isSupportedPhotoFile(file.name)) {
    return NextResponse.redirect(new URL(`/admin/sessions/${id}`, request.url));
  }

  const normalizedName = normalizeParticipantName(participant.name);

  const { data: existingFiles } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .list();

  if (existingFiles) {
    const oldFiles = existingFiles.filter((entry) => {
      if (!isSupportedPhotoFile(entry.name)) return false;
      return getPhotoBaseName(entry.name) === normalizedName;
    });

    if (oldFiles.length > 0) {
      await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove(oldFiles.map((f) => f.name));
    }
  }

  const ext = file.name.toLowerCase().match(/\.(avif|gif|jpe?g|png|webp)$/)?.[0] ?? ".jpg";
  const baseName = participant.name.trim().replace(/\s+/g, "-").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "") || participant.personId;
  const finalName = `${baseName}${ext}`;

  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(finalName, bytes, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    console.error("Supabase storage upload failed", uploadError);
  }

  return NextResponse.redirect(new URL(`/admin/sessions/${id}`, request.url));
}
