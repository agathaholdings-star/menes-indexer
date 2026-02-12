"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { isPlaceholderName } from "@/lib/therapist-utils";
import type { Therapist } from "@/lib/data";

interface RecommendationsProps {
  therapist: Therapist;
}

interface SimilarTherapist {
  id: number;
  name: string;
  age: number | null;
  image_urls: string[] | null;
  salon_id: number;
}

export function Recommendations({ therapist }: RecommendationsProps) {
  const [similar, setSimilar] = useState<SimilarTherapist[]>([]);
  const [shopName, setShopName] = useState(therapist.shopName);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    async function fetchSimilar() {
      const salonId = Number(therapist.shopId);
      if (!salonId) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from("therapists")
        .select("id, name, age, image_urls, salon_id")
        .eq("salon_id", salonId)
        .neq("id", Number(therapist.id))
        .not("name", "ilike", "%プロフィール%")
        .not("name", "ilike", "%profile%")
        .not("name", "ilike", "%THERAPIST%")
        .not("name", "ilike", "%セラピスト%")
        .not("name", "ilike", "%キャスト紹介%")
        .not("name", "ilike", "%在籍表%")
        .not("name", "ilike", "%ランキング%")
        .limit(12);

      const { data } = await query;

      if (data) {
        const filtered = data.filter((t) => !isPlaceholderName(t.name));
        setSimilar(filtered.slice(0, 6));
      }
      setLoading(false);
    }

    fetchSimilar();
  }, [therapist.shopId, therapist.id]);

  if (loading) return null;
  if (similar.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          {shopName}の他のセラピスト
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {similar.map((t) => {
              const images = t.image_urls || [];
              const displayName = t.name.replace(/\s*\(\d{2}\)$/, "");

              return (
                <Link
                  key={t.id}
                  href={`/therapist/${t.id}`}
                  className="w-[160px] flex-shrink-0"
                >
                  <Card className="h-full transition-all hover:shadow-md hover:border-primary/20 overflow-hidden">
                    <div className="relative h-40 w-full overflow-hidden">
                      <Image
                        src={images[0] || "/placeholder.svg"}
                        alt={displayName}
                        fill
                        className="object-cover transition-transform hover:scale-105"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <div className="flex items-center gap-1 text-white">
                          <span className="font-bold text-sm">{displayName}</span>
                        </div>
                        {t.age && t.age > 0 && (
                          <p className="text-xs text-white/80">{t.age}歳</p>
                        )}
                      </div>
                    </div>
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
