"use client";

import { useRef } from "react";
import Icon from "./Icon";

export default function CameraButton({
  onImageCapture,
  disabled,
}: {
  onImageCapture: (file: File) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImageCapture(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled}
        className="flex min-h-11 items-center gap-2 text-xs font-medium text-[#58664f]"
      >
        <Icon name="camera" width="18" />
        <span>Attach image</span>
      </button>
    </>
  );
}
