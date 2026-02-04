"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Crown, Star, Heart, Smile, Flame, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { therapistTypes, mockTherapists } from "@/lib/data";

const typeIcons: Record<string, React.ElementType> = {
  idol: Sparkles,
  seiso: Heart,
  gal: Crown,
  model: Star,
  imouto: Smile,
  yoen: Flame,
};

// セラピスト数をタイプ別にカウント
const getTherapistCount = (typeId: string) => {
  return mockTherapists.filter((t) => t.typeId === typeId).length * 127; // ダミーで水増し
};

export function TypeGrid() {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            タイプから探す
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
              独自機能
            </span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            好みの系統から、理想のセラピストを発見
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {therapistTypes.map((type) => {
          const Icon = typeIcons[type.id] || Sparkles;
          const count = getTherapistCount(type.id);
          
          return (
            <Link key={type.id} href={`/search?type=${type.id}`}>
              <Card className="group h-full cursor-pointer border-2 border-transparent transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1">
                <CardContent className="flex flex-col items-center p-5 text-center bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg h-full">
                  <div className="mb-3 rounded-2xl bg-primary/10 p-4 text-primary transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="font-bold text-base">{type.label}</span>
                  <span className="mt-1 text-xs text-muted-foreground line-clamp-1">
                    {type.description}
                  </span>
                  <span className="mt-3 text-xs font-medium text-primary">
                    {count.toLocaleString()}人
                  </span>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    探す <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
