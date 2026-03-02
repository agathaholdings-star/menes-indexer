"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { Camera } from "lucide-react";

type TherapistImageProps = Omit<ImageProps, "src"> & {
  src: string | null | undefined;
};

export function TherapistImage({ src, alt, ...props }: TherapistImageProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
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
      src={src}
      alt={alt ?? ""}
      onError={() => setError(true)}
      unoptimized
      {...props}
    />
  );
}
