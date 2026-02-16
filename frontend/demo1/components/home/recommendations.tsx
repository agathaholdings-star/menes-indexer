"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Radar } from "lucide-react";
import { cleanTherapistName, isPlaceholderName } from "@/lib/therapist-utils";

interface RecommendTherapist {
  id: number;
  name: string;
  image_url: string | null;
  shop_name: string;
}

export function Recommendations() {
  const [therapists, setTherapists] = useState<RecommendTherapist[]>([]);

  useEffect(() => {
    async function fetchTherapists() {
      const res = await fetch("/api/therapists/recommendations?limit=10");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTherapists(
          data
            .filter((t: any) => {
              if (isPlaceholderName(t.name)) return false;
              const cleaned = cleanTherapistName(t.name);
              if (cleaned.length > 15) return false;
              const shop = t.salons as { name: string; display_name: string | null } | null;
              if (shop && (cleaned === shop.name || cleaned === shop.display_name)) return false;
              return true;
            })
            .slice(0, 10)
            .map((t: any) => {
              const imgs = t.image_urls as string[] | null;
              const shop = t.salons as { name: string; display_name: string | null } | null;
              return {
                id: Number(t.id),
                name: cleanTherapistName(t.name),
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
    <section className="py-6">
      <div className="px-4 mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          あなたへのおすすめ
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          人気のセラピストをチェック
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
        {therapists.map((therapist) => (
          <Link
            key={therapist.id}
            href={`/therapist/${therapist.id}`}
            className="flex-shrink-0 w-40 group"
          >
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted">
              {therapist.image_url ? (
                <Image
                  src={therapist.image_url}
                  alt={therapist.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-2xl text-muted-foreground">
                  {therapist.name[0]}
                </div>
              )}
              <div className="absolute top-2 right-2 bg-card/90 backdrop-blur-sm rounded-full p-1.5">
                <Radar className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            <div className="mt-2 px-1">
              <h3 className="font-semibold text-sm text-foreground truncate">
                {therapist.name}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {therapist.shop_name}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
