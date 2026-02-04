"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ImageCarouselProps {
  images: string[];
  name: string;
}

export function ImageCarousel({ images, name }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <div className="relative">
      <div className="relative aspect-[4/5] w-full bg-muted">
        <Image
          src={images[currentIndex] || "/placeholder.svg"}
          alt={`${name}の写真 ${currentIndex + 1}`}
          fill
          className="object-cover"
          priority
        />
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, index) => (
            <button
              key={`dot-${
                // biome-ignore lint/suspicious/noArrayIndexKey: index is stable
                index
              }`}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentIndex
                  ? "bg-card w-4"
                  : "bg-card/60"
              )}
              aria-label={`写真 ${index + 1} を表示`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
