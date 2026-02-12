"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { cleanTherapistName, isPlaceholderName } from "@/lib/therapist-utils";

interface PopularTherapist {
  id: number;
  name: string;
  age: number | null;
  image_url: string | null;
  shop_name: string;
}

export function PopularTherapists() {
  const [therapists, setTherapists] = useState<PopularTherapist[]>([]);

  useEffect(() => {
    async function fetchTherapists() {
      const { data } = await supabase
        .from("therapists")
        .select("id, name, age, image_urls, salons(name, display_name)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8);
      if (data) {
        setTherapists(
          data
            .filter((t) => !isPlaceholderName(t.name))
            .map((t) => {
              const imgs = t.image_urls as string[] | null;
              const shop = t.salons as { name: string; display_name: string | null } | null;
              return {
                id: Number(t.id),
                name: cleanTherapistName(t.name),
                age: t.age,
                image_url: imgs?.[0] || null,
                shop_name: shop?.display_name || shop?.name || "",
              };
            })
        );
      }
    }
    fetchTherapists();
  }, []);

  if (therapists.length === 0) return null;

  return (
    <section className="mt-10">
      <Card className="border-0 shadow-sm bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              新着セラピスト
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
              {therapists.map((therapist, index) => (
                <Link
                  key={therapist.id}
                  href={`/therapist/${therapist.id}`}
                  className="w-[160px] flex-shrink-0"
                >
                  <Card className="group h-full transition-all hover:shadow-md border-muted/50 overflow-hidden">
                    <div className="relative h-44 w-full overflow-hidden bg-muted">
                      {therapist.image_url ? (
                        <Image
                          src={therapist.image_url}
                          alt={therapist.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          unoptimized
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-2xl text-muted-foreground">
                          {therapist.name[0]}
                        </div>
                      )}
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
                          {therapist.age && (
                            <span className="text-xs opacity-80">({therapist.age})</span>
                          )}
                        </div>
                        <p className="text-xs text-white/70 truncate">{therapist.shop_name}</p>
                      </div>
                    </div>
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
