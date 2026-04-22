import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  getPhotoBaseName,
  isSupportedPhotoFile,
} from "@/lib/photoMatching";

type PhotoIndex = Record<string, string>;

export async function GET() {
  const photosDir = path.join(process.cwd(), "public", "photos");

  try {
    const entries = await readdir(photosDir, { withFileTypes: true });
    const fileNames = entries
      .filter((entry) => entry.isFile() && isSupportedPhotoFile(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    const photoIndex: PhotoIndex = {};

    for (const fileName of fileNames) {
      const normalizedName = getPhotoBaseName(fileName);
      if (!normalizedName) {
        continue;
      }

      if (photoIndex[normalizedName]) {
        console.warn(
          `Duplicate normalized photo name "${normalizedName}" for "${fileName}". Using "${photoIndex[normalizedName]}".`
        );
        continue;
      }

      photoIndex[normalizedName] = `/photos/${fileName}`;
    }

    return NextResponse.json({ photos: photoIndex });
  } catch (error) {
    const isMissingDirectory =
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT";

    if (isMissingDirectory) {
      return NextResponse.json({ photos: {} });
    }

    console.error("Failed to build photo index", error);
    return NextResponse.json(
      { error: "Failed to build photo index", photos: {} },
      { status: 500 }
    );
  }
}
