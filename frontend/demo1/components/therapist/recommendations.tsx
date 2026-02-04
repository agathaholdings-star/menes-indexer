"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { getSimilarTherapists, therapistTypes, type Therapist } from "@/lib/data";

interface RecommendationsProps {
  therapist: Therapist;
}

export function Recommendations({ therapist }: RecommendationsProps) {
  const similarTherapists = getSimilarTherapists(therapist, 6);
  const currentTypeLabel = therapistTypes.find(t => t.id === therapist.typeId)?.label || "";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          このセラピストが好きな人はこちらも
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {similarTherapists.map((t) => {
              const typeMatch = t.typeId === therapist.typeId;
              const bodyMatch = t.bodyType === therapist.bodyType;
              let reason = "";
              if (typeMatch && bodyMatch) {
                reason = `同じ${currentTypeLabel}で同じスタイル`;
              } else if (typeMatch) {
                reason = `同じ${currentTypeLabel}で高評価`;
              } else if (bodyMatch) {
                reason = "同じスタイルで人気";
              } else {
                reason = "似た雰囲気で人気";
              }

              return (
                <Link
                  key={t.id}
                  href={`/therapist/${t.id}`}
                  className="w-[160px] flex-shrink-0"
                >
                  <Card className="h-full transition-all hover:shadow-md hover:border-primary/20 overflow-hidden">
                    <div className="relative h-40 w-full overflow-hidden">
                      <Image
                        src={t.images[0] || "/placeholder.svg"}
                        alt={t.name}
                        fill
                        className="object-cover transition-transform hover:scale-105"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <div className="flex items-center gap-1 text-white">
                          <span className="font-bold text-sm">{t.name}</span>
                        </div>
                        <p className="text-xs text-white/80 truncate">{t.shopName}</p>
                      </div>
                    </div>
                    <CardContent className="p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-primary text-primary" />
                          <span className="font-bold text-xs">{t.averageScore}点</span>
                        </div>
                      </div>
                      <p className="text-xs text-primary bg-primary/10 px-2 py-1 rounded text-center truncate">
                        {reason}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
