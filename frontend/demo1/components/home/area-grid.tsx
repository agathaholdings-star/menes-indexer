"use client";

import { useState } from "react";
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
import type { AreasGrouped, AreaItem } from "@/lib/supabase-data";

interface AreaGridProps {
  areasGrouped: AreasGrouped;
  popularAreas: (AreaItem & { name: string })[];
  regionOrder: string[];
}

export function AreaGrid({ areasGrouped, popularAreas, regionOrder }: AreaGridProps) {
  const [activeRegion, setActiveRegion] = useState(regionOrder[0] || "関東");

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
                  key={`${area.prefSlug}-${area.slug}`}
                  href={`/area/${area.prefSlug}/${area.slug}`}
                  className="px-3 py-1.5 text-sm bg-primary/10 text-primary hover:bg-primary/20 rounded-full transition-colors font-medium"
                >
                  {area.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Region Tabs */}
          <Tabs value={activeRegion} onValueChange={setActiveRegion}>
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
              {regionOrder.map((region) => (
                <TabsTrigger key={region} value={region} className="text-sm">
                  {region}
                </TabsTrigger>
              ))}
            </TabsList>
            {regionOrder.map((region) => (
              <TabsContent key={region} value={region} className="mt-4">
                <Accordion type="multiple" className="w-full">
                  {Object.entries(areasGrouped[region] || {}).map(([prefName, prefData]) => (
                    <AccordionItem key={prefName} value={prefName}>
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{prefName}</span>
                          <span className="text-xs text-muted-foreground">
                            ({prefData.areas.length}エリア)
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-wrap gap-2">
                          {prefData.areas.map((area) => (
                            <Link
                              key={area.slug}
                              href={`/area/${area.prefSlug}/${area.slug}`}
                              className="px-3 py-1.5 text-sm bg-muted hover:bg-primary/10 hover:text-primary rounded-full transition-colors"
                            >
                              {area.name}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({area.salon_count})
                              </span>
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
