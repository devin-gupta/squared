export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
export const HEIC_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
];
export const MAX_HEIC_SOURCE_BYTES = 25 * 1024 * 1024;

export function isHeicFile(
  file: Pick<File, "type"> & { name?: string },
): boolean {
  return (
    HEIC_TYPES.includes(file.type.toLowerCase()) ||
    /\.(?:heic|heif)$/i.test(file.name || "")
  );
}

export function transferredFiles(
  data: Pick<DataTransfer, "files" | "items">,
): File[] {
  const files = Array.from(data.files);
  return files.length
    ? files
    : Array.from(data.items)
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
}

export function receiptFileError(
  file: Pick<File, "type" | "size">,
): string | null {
  if (!RECEIPT_TYPES.includes(file.type))
    return "Use a JPEG, PNG, or WebP image. Convert HEIC or PDF files first.";
  if (!file.size) return "This image is empty. Choose another image.";
  if (file.size > MAX_RECEIPT_BYTES) return "Use an image smaller than 4 MB.";
  return null;
}

export function receiptSourceFileError(
  file: Pick<File, "type" | "size"> & { name?: string },
): string | null {
  if (!file.size) return "This image is empty. Choose another image.";
  if (isHeicFile(file))
    return file.size > MAX_HEIC_SOURCE_BYTES
      ? "Use a HEIC or HEIF image smaller than 25 MB."
      : null;
  if (!RECEIPT_TYPES.includes(file.type))
    return "Use a JPEG, PNG, WebP, HEIC, or HEIF image.";
  if (file.size > MAX_RECEIPT_BYTES) return "Use an image smaller than 4 MB.";
  return null;
}
