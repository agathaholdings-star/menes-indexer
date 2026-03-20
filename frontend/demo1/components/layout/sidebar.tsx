"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { TherapistImage } from "@/components/shared/therapist-image";
import { Crown, TrendingUp, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cleanTherapistName, isPlaceholderName } from "@/lib/therapist-utils";

interface SidebarShop {
  id: number;
  name: string;
  display_name: string | null;
  slug: string | null;
  access: string | null;
}

interface SidebarTherapist {
  id: number;
  name: string;
  image_url: string | null;
  shop_name: string;
}

interface SidebarProps {
  prefectureName?: string;
  initialTherapists?: SidebarTherapist[];
  initialShops?: SidebarShop[];
}

function SidebarInner({ prefectureName, initialTherapists, initialShops }: SidebarProps) {
  const [shops, setShops] = useState<SidebarShop[]>(initialShops ?? []);
  const [therapists, setTherapists] = useState<SidebarTherapist[]>(initialTherapists ?? []);

  useEffect(() => {
    // Skip fetch if pre-fetched data was provided
    if (initialTherapists && initialShops) return;

    async function fetchData() {
      try {
        const fetches: Promise<Response>[] = [];

        if (!initialShops) {
          const shopsUrl = prefectureName
            ? `/api/salons?limit=5&area=${encodeURIComponent(prefectureName)}`
            : "/api/salons?limit=5";
          fetches.push(fetch(shopsUrl));
        }
        if (!initialTherapists) {
          fetches.push(fetch("/api/therapists/recommendations?limit=5"));
        }

        const responses = await Promise.all(fetches);
        let idx = 0;

        if (!initialShops) {
          const shopsData = await responses[idx++].json();
          if (Array.isArray(shopsData)) setShops(shopsData as SidebarShop[]);
        }
        if (!initialTherapists) {
          const therapistsData = await responses[idx++].json();
          if (Array.isArray(therapistsData)) {
            setTherapists(
              therapistsData
                .filter((t: any) => {
                  if (isPlaceholderName(t.name)) return false;
                  const cleaned = cleanTherapistName(t.name);
                  if (cleaned.length > 15) return false;
                  const shop = t.salons as { name: string; display_name: string | null } | null;
                  if (shop && (cleaned === shop.name || cleaned === shop.display_name)) return false;
                  return true;
                })
                .slice(0, 5)
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
      } catch (err) {
        console.error("サイドバーデータ取得エラー:", err);
      }
    }
    fetchData();
  }, [prefectureName, initialTherapists, initialShops]);

  return (
    <aside className="flex flex-col gap-6">
      {/* Ranking Card */}
      {therapists.length > 0 && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-5 w-5 text-primary" />
            新着セラピスト
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-3">
            {therapists.map((therapist, index) => (
              <li key={therapist.id}>
                <Link
                  href={`/therapist/${therapist.id}`}
                  className="flex items-center gap-3 group"
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0
                        ? "bg-primary text-primary-foreground"
                        : index === 1
                        ? "bg-primary/70 text-primary-foreground"
                        : index === 2
                        ? "bg-primary/50 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="relative h-10 w-10 overflow-hidden rounded-full bg-muted">
                    <TherapistImage
                      src={therapist.image_url}
                      alt={therapist.name}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {therapist.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {therapist.shop_name}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/ranking"
            className="mt-4 flex items-center justify-center gap-1 text-sm text-primary hover:underline"
          >
            <TrendingUp className="h-4 w-4" />
            ランキングをもっと見る
          </Link>
        </CardContent>
      </Card>
      )}

      {/* Recommended Shops */}
      {shops.length > 0 && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-primary" />
            おすすめ店舗
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-2">
            {shops.map((shop) => (
              <li key={shop.id}>
                <Link
                  href={`/salon/${shop.id}`}
                  className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{shop.display_name || shop.name}</p>
                    {shop.access && (
                      <p className="text-xs text-muted-foreground">{shop.access}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      )}
    </aside>
  );
}

export const Sidebar = React.memo(SidebarInner);
