"use client";

import Link from "next/link";
import Image from "next/image";
import { Radar } from "lucide-react";
import type { Therapist } from "@/lib/data";

interface TherapistCardProps {
  therapist: Therapist;
}

export function TherapistCard({ therapist }: TherapistCardProps) {
  return (
    <Link
      href={`/therapist/${therapist.id}`}
      className="flex-shrink-0 w-40 group"
    >
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted">
        <Image
          src={therapist.images[0] || "/placeholder.svg"}
          alt={therapist.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-2 right-2 bg-card/90 backdrop-blur-sm rounded-full p-1.5">
          <Radar className="h-3.5 w-3.5 text-primary" />
        </div>
      </div>
      <div className="mt-2 px-1">
        <h3 className="font-semibold text-sm text-foreground truncate">
          {therapist.name}
        </h3>
        <p className="text-xs text-muted-foreground truncate">
          {therapist.shopName}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {therapist.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
