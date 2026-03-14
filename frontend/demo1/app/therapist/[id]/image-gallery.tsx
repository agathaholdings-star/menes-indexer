"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TherapistImage } from "@/components/shared/therapist-image";

interface ImageGalleryProps {
  images: string[];
  name: string;
}

export function ImageGallery({ images, name }: ImageGalleryProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === images.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  return (
    <div className="relative w-full md:w-64 flex-shrink-0">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
        <TherapistImage
          src={images[currentImageIndex]}
          alt={name}
          fill
          className="object-cover"
          priority={currentImageIndex === 0}
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center shadow hover:bg-card transition-colors"
              aria-label="前の画像"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center shadow hover:bg-card transition-colors"
              aria-label="次の画像"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-2">
          {images.map((img, index) => (
            <button
              key={img}
              type="button"
              onClick={() => setCurrentImageIndex(index)}
              className={`relative w-12 h-12 rounded overflow-hidden border-2 transition-colors ${
                index === currentImageIndex
                  ? "border-primary"
                  : "border-transparent"
              }`}
              aria-label={`画像${index + 1}を表示`}
            >
              <TherapistImage
                src={img}
                alt=""
                fill
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
