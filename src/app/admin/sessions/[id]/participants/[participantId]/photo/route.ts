import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getParticipantFromSession,
} from "@/lib/store";
import {
  getPhotoBaseName,
  isSupportedPhotoFile,
  normalizeParticipantName,
} from "@/lib/photoMatching";

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").trim();
}

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

  const photosDir = path.join(process.cwd(), "public", "photos");
  await mkdir(photosDir, { recursive: true });

  const normalizedName = normalizeParticipantName(participant.name);
  const entries = await readdir(photosDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !isSupportedPhotoFile(entry.name)) {
      continue;
    }

    if (getPhotoBaseName(entry.name) === normalizedName) {
      await rm(path.join(photosDir, entry.name), { force: true });
    }
  }

  const ext = path.extname(file.name).toLowerCase() || ".jpg";
  const baseName = sanitizeFileName(participant.name).replace(/\s+/g, "-") || participant.personId;
  const finalName = `${baseName}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  await writeFile(path.join(photosDir, finalName), bytes);

  return NextResponse.redirect(new URL(`/admin/sessions/${id}`, request.url));
}
