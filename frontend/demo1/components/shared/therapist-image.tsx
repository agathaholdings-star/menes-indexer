"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { Camera } from "lucide-react";

type TherapistImageProps = Omit<ImageProps, "src"> & {
  src: string | null | undefined;
};

const SUPABASE_STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;

function normalizeStorageUrl(url: string): string {
  // ローカルSupabase URL → 環境に合わせたStorage URLに変換
  if (url.startsWith("http://127.0.0.1:54321/storage/v1/object/public/")) {
    return url.replace(
      "http://127.0.0.1:54321/storage/v1/object/public/",
      SUPABASE_STORAGE_BASE
    );
  }
  return url;
}

export function TherapistImage({ src, alt, ...props }: TherapistImageProps) {
  const [error, setError] = useState(false);
  const normalizedSrc = src ? normalizeStorageUrl(src) : src;

  if (!normalizedSrc || error) {
    return (
      <div
        className="bg-muted flex flex-col items-center justify-center text-muted-foreground"
        style={
          props.fill
            ? { position: "absolute", inset: 0 }
            : { width: props.width as number, height: props.height as number }
        }
      >
        <Camera className="h-6 w-6 mb-1 opacity-50" />
        <span className="text-[10px] opacity-50">No Photo</span>
      </div>
    );
  }

  return (
    <Image
      src={normalizedSrc}
      alt={alt ?? ""}
      onError={() => setError(true)}
      unoptimized
      {...props}
    />
  );
}
