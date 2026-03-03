"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { MapPin, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { areasData } from "@/lib/data";

// Build a flat list of all districts with their region/prefecture for popularity ranking
function getPopularAreas(limit: number) {
  const allAreas: { region: string; prefecture: string; district: string }[] = [];
  for (const [region, prefectures] of Object.entries(areasData)) {
    for (const [prefecture, districts] of Object.entries(prefectures)) {
      for (const district of districts) {
        allAreas.push({ region, prefecture, district });
      }
    }
  }
  // Use a deterministic ranking: prioritize well-known areas
  // Since we don't have salon_count in static data, use a hardcoded popularity order
  const popularOrder = [
    "新宿", "渋谷", "池袋", "五反田", "梅田", "難波",
    "六本木", "上野", "栄", "銀座", "心斎橋", "三宮",
    "中洲", "天神", "秋葉原",
  ];
  const sorted = allAreas.sort((a, b) => {
    const aIdx = popularOrder.indexOf(a.district);
    const bIdx = popularOrder.indexOf(b.district);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
  return sorted.slice(0, limit);
}

export function AreaGrid() {
  const [activeRegion, setActiveRegion] = useState("関東");

  const popularAreas = useMemo(() => getPopularAreas(12), []);

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
          {/* Popular Areas Section */}
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              人気エリア
            </h4>
            <div className="flex flex-wrap gap-2">
              {popularAreas.map((area) => (
                <Link
                  key={`${area.prefecture}-${area.district}`}
                  href={`/area/${area.prefecture}/${area.district}`}
                  className="px-3 py-1.5 text-sm bg-primary/10 text-primary hover:bg-primary/20 rounded-full transition-colors font-medium"
                >
                  {area.district}
                </Link>
              ))}
            </div>
          </div>

          {/* Region Tabs */}
          <Tabs value={activeRegion} onValueChange={setActiveRegion}>
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
              {Object.keys(areasData).map((region) => (
                <TabsTrigger key={region} value={region} className="text-sm">
                  {region}
                </TabsTrigger>
              ))}
            </TabsList>
            {Object.entries(areasData).map(([region, prefectures]) => (
              <TabsContent key={region} value={region} className="mt-4">
                <Accordion type="multiple" className="w-full">
                  {Object.entries(prefectures).map(([prefecture, districts]) => (
                    <AccordionItem key={prefecture} value={prefecture}>
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{prefecture}</span>
                          <span className="text-xs text-muted-foreground">
                            ({districts.length}エリア)
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-wrap gap-2">
                          {(districts as readonly string[]).map((district) => (
                            <Link
                              key={district}
                              href={`/area/${prefecture}/${district}`}
                              className="px-3 py-1.5 text-sm bg-muted hover:bg-primary/10 hover:text-primary rounded-full transition-colors"
                            >
                              {district}
                            </Link>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </TabsContent>
            ))}
          </Tabs>

          {/* Link to full area page */}
          <div className="mt-4 text-center">
            <Link
              href="/area"
              className="text-sm text-primary hover:underline"
            >
              全エリア一覧を見る
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
