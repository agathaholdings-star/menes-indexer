"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Therapist } from "@/lib/data";

interface TherapistCardProps {
  therapist: Therapist;
  showShop?: boolean;
  size?: "sm" | "md" | "lg";
}

export function TherapistCard({ therapist, showShop = true, size = "md" }: TherapistCardProps) {
  const imageHeight = size === "sm" ? "h-40" : size === "lg" ? "h-64" : "h-52";

  return (
    <Link href={`/therapist/${therapist.id}`}>
      <Card className="group overflow-hidden transition-all hover:shadow-lg">
        <div className={`relative ${imageHeight} overflow-hidden`}>
          <Image
            src={therapist.images[0] || "/placeholder.svg"}
            alt={therapist.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <div className="flex items-center gap-2 text-white">
              <span className="text-lg font-bold">{therapist.name}</span>
              <span className="text-sm opacity-80">({therapist.age})</span>
            </div>
            {showShop && (
              <p className="text-xs text-white/80">{therapist.shopName}</p>
            )}
          </div>
        </div>
        <CardContent className="p-3">
          <div className="mb-2 flex flex-wrap gap-1">
            {therapist.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-primary">
              <Star className="h-4 w-4 fill-current" />
              <span className="font-bold">{therapist.averageScore}点</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span className="text-xs">{therapist.reviewCount}件</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
