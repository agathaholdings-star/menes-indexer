import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, ChevronRight, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getAllPrefectures } from "@/lib/supabase-data";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

export const metadata: Metadata = {
  title: "エリア一覧",
  description: "全国のメンズエステをエリアから探す。関東・関西・東海など7地方、821エリアのメンズエステ店舗情報を掲載。",
};

const regionOrder = ["関東", "関西", "東海", "北海道・東北", "北陸・甲信越", "中国・四国", "九州・沖縄"];

interface AreaItem {
  name: string;
  slug: string;
  salon_count: number;
  prefecture_slug: string;
}

export default async function AreaIndexPage() {
  const prefectures = await getAllPrefectures();

  // エリアを全件取得（salon_count > 0 のみ）
  const { data: areas } = await supabase
    .from("areas")
    .select("id, prefecture_id, name, slug, salon_count")
    .gt("salon_count", 0)
    .order("search_volume", { ascending: false });

  // prefecture_id → slug マッピング
  const prefMap = new Map(prefectures.map((p) => [p.id, p]));

  // リージョンごとにデータ構築
  const regionData: Record<string, { name: string; slug: string; areas: AreaItem[] }[]> = {};

  for (const pref of prefectures) {
    const region = pref.region || "その他";
    if (!regionData[region]) regionData[region] = [];

    const prefAreas = (areas || [])
      .filter((a) => a.prefecture_id === pref.id)
      .map((a) => ({
        name: a.name,
        slug: a.slug,
        salon_count: a.salon_count ?? 0,
        prefecture_slug: pref.slug,
      }));

    if (prefAreas.length > 0) {
      regionData[region].push({
        name: pref.name,
        slug: pref.slug,
        areas: prefAreas,
      });
    }
  }

  const regions = regionOrder.filter((r) => regionData[r] && regionData[r].length > 0);
  const totalAreas = (areas || []).length;
  const totalShops = (areas || []).reduce((sum, a) => sum + (a.salon_count ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition-colors">
            ホーム
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">エリア一覧</span>
        </nav>

        {/* Hero */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">エリアからメンズエステを探す</h1>
              <p className="text-muted-foreground">
                {regions.length}地方 / {totalAreas}エリア / {totalShops.toLocaleString()}店舗
              </p>
            </div>
          </div>
        </div>

        {/* Region Cards */}
        <div className="space-y-8">
          {regions.map((region) => (
            <Card key={region}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{region}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {regionData[region].map((pref) => (
                    <div key={pref.slug}>
                      <h3 className="font-semibold mb-2">
                        <Link
                          href={`/area/${pref.slug}`}
                          className="hover:text-primary transition-colors"
                        >
                          {pref.name}
                        </Link>
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {pref.areas.map((area) => (
                          <Link
                            key={area.slug}
                            href={`/area/${pref.slug}/${area.slug}`}
                            className="px-3 py-1.5 text-sm bg-muted hover:bg-primary/10 hover:text-primary rounded-full transition-colors"
                          >
                            {area.name}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({area.salon_count})
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
