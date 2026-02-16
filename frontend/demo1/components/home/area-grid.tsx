"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// region表示順
const regionOrder = ["関東", "関西", "東海", "北海道・東北", "北陸・甲信越", "中国・四国", "九州・沖縄"];

interface AreaItem {
  name: string;
  slug: string;
  salon_count: number;
}

interface PrefectureWithAreas {
  name: string;
  slug: string;
  areas: AreaItem[];
}

type RegionData = Record<string, PrefectureWithAreas[]>;

export function AreaGrid() {
  const [activeRegion, setActiveRegion] = useState("関東");
  const [regionData, setRegionData] = useState<RegionData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [prefsRes, areasRes] = await Promise.all([
        fetch("/api/prefectures"),
        fetch("/api/areas"),
      ]);
      const prefectures = await prefsRes.json();
      const areas = await areasRes.json();

      if (!Array.isArray(prefectures) || !Array.isArray(areas)) return;

      // エリアをprefecture_idでグルーピング
      const areasByPref = new Map<number, AreaItem[]>();
      for (const area of areas) {
        const list = areasByPref.get(area.prefecture_id) || [];
        list.push({ name: area.name, slug: area.slug, salon_count: area.salon_count ?? 0 });
        areasByPref.set(area.prefecture_id, list);
      }

      // リージョンごとにまとめる
      const result: RegionData = {};
      for (const pref of prefectures) {
        const region = pref.region || "その他";
        if (!result[region]) result[region] = [];
        const prefAreas = areasByPref.get(pref.id) || [];
        if (prefAreas.length > 0) {
          result[region].push({
            name: pref.name,
            slug: pref.slug,
            areas: prefAreas,
          });
        }
      }

      setRegionData(result);
      setLoading(false);
    }

    fetchData();
  }, []);

  const regions = regionOrder.filter((r) => regionData[r]);

  if (loading) {
    return (
      <section className="mt-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              エリアから探す
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-muted rounded" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            エリアから探す
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeRegion} onValueChange={setActiveRegion}>
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
              {regions.map((region) => (
                <TabsTrigger key={region} value={region} className="text-sm">
                  {region}
                </TabsTrigger>
              ))}
            </TabsList>
            {regions.map((region) => (
              <TabsContent key={region} value={region} className="mt-4">
                <div className="space-y-4">
                  {regionData[region].map((pref) => (
                    <div key={pref.slug}>
                      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                        <Link href={`/area/${pref.slug}`} className="hover:text-primary transition-colors">
                          {pref.name}
                        </Link>
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {pref.areas.map((area) => (
                          <Link
                            key={area.slug}
                            href={`/area/${pref.slug}/${area.slug}`}
                            className="px-3 py-1.5 text-sm bg-muted hover:bg-primary/10 hover:text-primary rounded-full transition-colors"
                          >
                            {area.name}
                            <span className="text-xs text-muted-foreground ml-1">({area.salon_count})</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
