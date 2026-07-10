import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getPhotoBaseName,
  isSupportedPhotoFile,
} from "@/lib/photoMatching";
import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/auth";
import { supabaseAdmin, STORAGE_BUCKET, isSupabaseConfigured } from "@/lib/supabase";

type PhotoIndex = Record<string, string>;

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!(await isValidAdminSession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    return NextResponse.json({ photos: {} });
  }

  try {
    const { data: files, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .list();

    if (error) {
      console.error("Failed to list photos from Supabase Storage", error);
      return NextResponse.json(
        { error: "Failed to build photo index", photos: {} },
        { status: 500 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ photos: {} });
    }

    const fileNames = files
      .filter((entry) => isSupportedPhotoFile(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    const photoIndex: PhotoIndex = {};

    for (const fileName of fileNames) {
      const normalizedName = getPhotoBaseName(fileName);
      if (!normalizedName) continue;

      if (photoIndex[normalizedName]) {
        console.warn(
          `Duplicate normalized photo name "${normalizedName}" for "${fileName}". Using "${photoIndex[normalizedName]}".`
        );
        continue;
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName);

      photoIndex[normalizedName] = publicUrlData.publicUrl;
    }

    return NextResponse.json({ photos: photoIndex });
  } catch (error) {
    console.error("Failed to build photo index", error);
    return NextResponse.json(
      { error: "Failed to build photo index", photos: {} },
      { status: 500 }
    );
  }
}
