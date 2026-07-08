import { readdir } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin, STORAGE_BUCKET, isSupabaseConfigured } from "@/lib/supabase";

const NORMALIZE_NAME_PATTERN = /[\s._\-()]+/g;

export function normalizeParticipantName(value: string): string {
  return value.trim().toLowerCase().replace(NORMALIZE_NAME_PATTERN, "");
}

export function getPhotoBaseName(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  const baseName = lastDotIndex === -1 ? fileName : fileName.slice(0, lastDotIndex);
  return normalizeParticipantName(baseName);
}

export function isSupportedPhotoFile(fileName: string): boolean {
  return /\.(avif|gif|jpe?g|png|webp)$/i.test(fileName);
}

export async function getParticipantPhotoUrl(participantName: string): Promise<string | null> {
  const normalizedName = normalizeParticipantName(participantName);
  if (!normalizedName) return null;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data: files } = await supabaseAdmin.storage.from(STORAGE_BUCKET).list();
      if (files) {
        const match = files.find((f) => getPhotoBaseName(f.name) === normalizedName);
        if (match) {
          const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(match.name);
          return data.publicUrl;
        }
      }
    } catch {
      return null;
    }
  }

  try {
    const photosDir = path.join(process.cwd(), "public", "photos");
    const entries = await readdir(photosDir);
    const match = entries.find(
      (e) => getPhotoBaseName(e) === normalizedName && isSupportedPhotoFile(e)
    );
    if (match) return `/photos/${match}`;
  } catch {
    return null;
  }

  return null;
}
