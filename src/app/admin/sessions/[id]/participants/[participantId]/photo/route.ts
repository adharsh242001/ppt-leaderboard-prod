import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/auth";
import { getParticipantFromSession } from "@/lib/store";
import {
  getPhotoBaseName,
  isSupportedPhotoFile,
  normalizeParticipantName,
} from "@/lib/photoMatching";
import { supabaseAdmin, STORAGE_BUCKET, isSupabaseConfigured } from "@/lib/supabase";

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
  const { id, participantId } = await params;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

    if (!(await isValidAdminSession(token))) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const baseUrl = new URL(`/admin/sessions/${id}`, request.url);
    const participant = await getParticipantFromSession(id, participantId);
    if (!participant) return NextResponse.redirect(baseUrl);

    const formData = await request.formData();
    const file = formData.get("photo");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.redirect(baseUrl);
    }

    if (!isSupportedPhotoFile(file.name)) {
      return NextResponse.redirect(baseUrl);
    }

    const normalizedName = normalizeParticipantName(participant.name);
    const ext = path.extname(file.name).toLowerCase() || ".jpg";
    const baseName = sanitizeFileName(participant.name).replace(/\s+/g, "-") || participant.personId;
    const finalName = `${baseName}${ext}`;

    if (isSupabaseConfigured && supabaseAdmin) {
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
    } else {
      const bytes = Buffer.from(await file.arrayBuffer());

      if (process.env.VERCEL) {
        console.error(
          "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for Vercel."
        );
        return NextResponse.json(
          { error: "Photo upload requires Supabase configuration. Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL." },
          { status: 500 }
        );
      }

      const photosDir = path.join(process.cwd(), "public", "photos");
      await mkdir(photosDir, { recursive: true });

      const entries = await readdir(photosDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !isSupportedPhotoFile(entry.name)) continue;
        if (getPhotoBaseName(entry.name) === normalizedName) {
          await rm(path.join(photosDir, entry.name), { force: true });
        }
      }

      await writeFile(path.join(photosDir, finalName), bytes);
    }

    return NextResponse.redirect(new URL(`/admin/sessions/${id}`, request.url));
  } catch {
    return NextResponse.redirect(new URL(`/admin/sessions/${id}`, request.url));
  }
}
