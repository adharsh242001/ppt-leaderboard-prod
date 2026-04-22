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
