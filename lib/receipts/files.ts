export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

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
