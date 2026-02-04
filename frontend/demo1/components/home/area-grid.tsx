"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { areasData } from "@/lib/data";

export function AreaGrid() {
  const [activeRegion, setActiveRegion] = useState("関東");

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
              {Object.keys(areasData).map((region) => (
                <TabsTrigger key={region} value={region} className="text-sm">
                  {region}
                </TabsTrigger>
              ))}
            </TabsList>
            {Object.entries(areasData).map(([region, prefectures]) => (
              <TabsContent key={region} value={region} className="mt-4">
                <div className="space-y-4">
                  {Object.entries(prefectures).map(([prefecture, districts]) => (
                    <div key={prefecture}>
                      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                        {prefecture}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {districts.map((district) => (
                          <Link
                            key={district}
                            href={`/area/${prefecture}/${district}`}
                            className="px-3 py-1.5 text-sm bg-muted hover:bg-primary/10 hover:text-primary rounded-full transition-colors"
                          >
                            {district}
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
