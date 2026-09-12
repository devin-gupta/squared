"use client";

import {
  isHeicFile,
  MAX_RECEIPT_BYTES,
  receiptFileError,
  receiptSourceFileError,
} from "./files";

function jpegName(name: string): string {
  const base = name.replace(/\.(?:heic|heif)$/i, "") || "receipt";
  return `${base}.jpg`;
}

function canvasJpeg(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("This Apple photo couldn’t be compressed.")),
      "image/jpeg",
      quality,
    ),
  );
}

async function fitJpeg(blob: Blob): Promise<Blob> {
  if (blob.size <= MAX_RECEIPT_BYTES) return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    let scale = Math.min(
      1,
      Math.sqrt((MAX_RECEIPT_BYTES * 0.85) / blob.size),
    );
    for (let attempt = 0; attempt < 5; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
      canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("This browser couldn’t prepare the Apple photo.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const result = await canvasJpeg(canvas, attempt < 2 ? 0.82 : 0.7);
      if (result.size <= MAX_RECEIPT_BYTES) return result;
      scale *= Math.min(
        0.85,
        Math.sqrt((MAX_RECEIPT_BYTES * 0.85) / result.size),
      );
    }
  } finally {
    bitmap.close();
  }
  throw new Error(
    "This Apple photo is too large to prepare. Try cropping it and attach it again.",
  );
}

export async function prepareReceiptFile(file: File): Promise<File> {
  const sourceError = receiptSourceFileError(file);
  if (sourceError) throw new Error(sourceError);
  if (!isHeicFile(file)) return file;

  try {
    const { heicTo } = await import("heic-to");
    const output = await heicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.82,
    });
    const converted = await fitJpeg(output);
    const result = new File([converted], jpegName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
    const outputError = receiptFileError(result);
    if (outputError) throw new Error(outputError);
    return result;
  } catch (error) {
    if (
      error instanceof Error &&
      /too large|couldn.t|smaller than/i.test(error.message)
    )
      throw error;
    throw new Error(
      "This HEIC or HEIF photo couldn’t be converted. Try another photo or crop it first.",
    );
  }
}
