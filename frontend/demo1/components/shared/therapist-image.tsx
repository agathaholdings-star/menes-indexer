"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { Camera } from "lucide-react";

type TherapistImageProps = Omit<ImageProps, "src"> & {
  src: string | null | undefined;
};

const SUPABASE_STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
const LOCAL_STORAGE_BASE = "http://127.0.0.1:54321/storage/v1/object/public/";

function normalizeStorageUrl(url: string): string {
  // ローカル開発環境
  if (url.startsWith(LOCAL_STORAGE_BASE)) {
    return url.replace(LOCAL_STORAGE_BASE, SUPABASE_STORAGE_BASE);
  }
  // 本番: Supabase Storage URL → /img/ パスに変換（Vercel CDN経由で配信）
  if (url.startsWith(SUPABASE_STORAGE_BASE)) {
    return url.replace(SUPABASE_STORAGE_BASE, "/img/");
  }
  // oycay... 直指定の場合も変換
  if (url.includes("supabase.co/storage/v1/object/public/")) {
    return "/img/" + url.split("/storage/v1/object/public/")[1];
  }
  return url;
}

export function TherapistImage({ src, alt, sizes, ...props }: TherapistImageProps) {
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
      sizes={sizes ?? (props.fill ? "(max-width: 768px) 100vw, 200px" : undefined)}
      {...props}
    />
  );
}
