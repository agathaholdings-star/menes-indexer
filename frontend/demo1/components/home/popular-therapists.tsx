"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, ChevronRight, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { mockTherapists } from "@/lib/data";

export function PopularTherapists() {
  const popularTherapists = [...mockTherapists]
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 8);

  return (
    <section className="mt-10">
      <Card className="border-0 shadow-sm bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              今週の人気セラピスト
            </CardTitle>
            <Link
              href="/ranking"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              ランキングを見る
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {popularTherapists.map((therapist, index) => (
                <Link
                  key={therapist.id}
                  href={`/therapist/${therapist.id}`}
                  className="w-[160px] flex-shrink-0"
                >
                  <Card className="group h-full transition-all hover:shadow-md border-muted/50 overflow-hidden">
                    <div className="relative h-44 w-full overflow-hidden">
                      <Image
                        src={therapist.images[0] || "/placeholder.svg"}
                        alt={therapist.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Rank Badge */}
                      {index < 3 && (
                        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? "bg-amber-400 text-amber-900" :
                          index === 1 ? "bg-slate-300 text-slate-700" :
                          "bg-amber-600 text-amber-100"
                        }`}>
                          {index + 1}
                        </div>
                      )}
                      {/* Gradient Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
                        <div className="flex items-center gap-1 text-white">
                          <span className="font-bold text-sm">{therapist.name}</span>
                          <span className="text-xs opacity-80">({therapist.age})</span>
                        </div>
                        <p className="text-xs text-white/70 truncate">{therapist.shopName}</p>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      {/* Tags - シンプルに統一 */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-0">
                          {therapist.tags[0]}
                        </Badge>
                        {therapist.tags[1] && (
                          <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground border-0">
                            {therapist.tags[1]}
                          </Badge>
                        )}
                      </div>
                      {/* Score */}
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-primary text-primary" />
                        <span className="font-bold text-sm">{therapist.averageScore}</span>
                        <span className="text-xs text-muted-foreground">点</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </section>
  );
}
