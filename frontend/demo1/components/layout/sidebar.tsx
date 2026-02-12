"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Crown, TrendingUp, Star, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
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

export function Sidebar() {
  const [shops, setShops] = useState<SidebarShop[]>([]);
  const [therapists, setTherapists] = useState<SidebarTherapist[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [shopRes, therapistRes] = await Promise.all([
          supabase
            .from("salons")
            .select("id, name, display_name, slug, access")
            .eq("is_active", true)
            .limit(5),
          supabase
            .from("therapists")
            .select("id, name, image_urls, salon_id, salons(name, display_name)")
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
        if (shopRes.data) setShops(shopRes.data as SidebarShop[]);
        if (therapistRes.data) {
          setTherapists(
            therapistRes.data
              .filter((t) => !isPlaceholderName(t.name))
              .map((t) => {
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
      } catch (err) {
        console.error("サイドバーデータ取得エラー:", err);
      }
    }
    fetchData();
  }, []);

  return (
    <aside className="flex flex-col gap-6">
      {/* Ranking Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-5 w-5 text-primary" />
            新着セラピスト
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {therapists.length > 0 ? (
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
                      {therapist.image_url ? (
                        <Image
                          src={therapist.image_url}
                          alt={therapist.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                          {therapist.name[0]}
                        </div>
                      )}
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
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              セラピスト情報を準備中です。<br />もう少々お待ちください。
            </p>
          )}
          <Link
            href="/ranking"
            className="mt-4 flex items-center justify-center gap-1 text-sm text-primary hover:underline"
          >
            <TrendingUp className="h-4 w-4" />
            ランキングをもっと見る
          </Link>
        </CardContent>
      </Card>

      {/* Recommended Shops - Real Data */}
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
                  href={`/shop/${shop.slug || shop.id}`}
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

      {/* Ad Banner */}
      <Card className="overflow-hidden">
        <div className="aspect-[3/2] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-sm font-medium text-muted-foreground">広告枠</p>
            <p className="text-xs text-muted-foreground mt-1">300x200</p>
          </div>
        </div>
      </Card>
    </aside>
  );
}
