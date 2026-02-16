"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";

interface PopularShop {
  id: number;
  name: string;
  display_name: string | null;
  slug: string | null;
  image_url: string | null;
  access: string | null;
  description: string | null;
}

interface AreaSection {
  areaName: string;
  areaSlug: string;
  prefSlug: string;
  shops: PopularShop[];
}

// 人気エリア定義（検索ボリューム上位から各リージョン代表を選出）
const popularAreaSlugs = [
  { slug: "ikebukuro", label: "池袋" },
  { slug: "nagoya", label: "名古屋" },
  { slug: "kyoto", label: "京都" },
  { slug: "hakata", label: "博多" },
];

function AreaSectionCard({ section, defaultOpen }: { section: AreaSection; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
      >
        <span>{section.areaName}エリアのおすすめメンズエステ</span>
        <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="p-4 bg-background">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.shops.map((shop) => (
              <div key={shop.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative">
                  <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded z-10">
                    {shop.display_name || shop.name}
                  </span>
                  <Image
                    src={shop.image_url || "/placeholder.svg"}
                    alt={shop.display_name || shop.name}
                    width={400}
                    height={200}
                    className="w-full h-32 object-cover"
                  />
                </div>
                <div className="p-3">
                  {shop.access && (
                    <p className="text-xs text-muted-foreground mb-1">{shop.access}</p>
                  )}
                  {shop.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {shop.description}
                    </p>
                  )}
                  <Link href={`/shop/${shop.slug || shop.id}`}>
                    <Button variant="outline" className="w-full text-primary border-primary hover:bg-primary/5 bg-transparent">
                      口コミと店舗詳細を見る
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link href={`/area/${section.prefSlug}/${section.areaSlug}`}>
              <Button variant="ghost" className="text-primary">
                {section.areaName}の全店舗を見る
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function AreaPopularShops() {
  const [sections, setSections] = useState<AreaSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const results: AreaSection[] = [];

      // Fetch all areas and prefectures once
      const [areasRes, prefsRes] = await Promise.all([
        fetch("/api/areas"),
        fetch("/api/prefectures"),
      ]);
      const allAreas = await areasRes.json();
      const allPrefs = await prefsRes.json();
      if (!Array.isArray(allAreas) || !Array.isArray(allPrefs)) { setLoading(false); return; }

      const prefMap = new Map(allPrefs.map((p: any) => [p.id, p.slug]));

      for (const pa of popularAreaSlugs) {
        const area = allAreas.find((a: any) => a.slug === pa.slug);
        if (!area) continue;

        const prefSlug = prefMap.get(area.prefecture_id);
        if (!prefSlug) continue;

        const salonsRes = await fetch(`/api/salons?area_id=${area.id}&limit=4`);
        const shops = await salonsRes.json();
        if (!Array.isArray(shops) || shops.length === 0) continue;

        results.push({
          areaName: area.name,
          areaSlug: area.slug,
          prefSlug,
          shops: shops as PopularShop[],
        });
      }

      setSections(results);
      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <section className="mt-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              人気エリアのおすすめサロン
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-14 bg-muted rounded" />
              <div className="h-14 bg-muted rounded" />
              <div className="h-14 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (sections.length === 0) return null;

  return (
    <section className="mt-8">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            人気エリアのおすすめサロン
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sections.map((section, i) => (
            <AreaSectionCard
              key={section.areaSlug}
              section={section}
              defaultOpen={i === 0}
            />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
