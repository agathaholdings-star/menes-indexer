import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ChevronRight, Store } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Sidebar } from "@/components/layout/sidebar";
import { getPrefectureBySlug, getAreasByPrefectureId } from "@/lib/supabase-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ prefecture: string }>;
}): Promise<Metadata> {
  const { prefecture } = await params;
  const pref = await getPrefectureBySlug(prefecture);
  if (!pref) return {};
  return {
    title: `${pref.name}のメンズエステ`,
    description: `${pref.name}エリアのメンズエステ店舗・セラピスト情報を掲載。口コミやレーダーチャートで自分に合ったセラピストを見つけよう。`,
  };
}

export default async function AreaPrefecturePage({
  params,
}: {
  params: Promise<{ prefecture: string }>;
}) {
  const { prefecture } = await params;

  // Supabaseからデータ取得
  const pref = await getPrefectureBySlug(prefecture);
  if (!pref) {
    notFound();
  }

  const areas = await getAreasByPrefectureId(pref.id);

  const totalSalonCount = areas.reduce((sum, a) => sum + (a.salon_count || 0), 0);

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
          <span className="text-foreground">{pref.name}</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {/* Hero */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{pref.name}のメンズエステ</h1>
                  <p className="text-muted-foreground">
                    {areas.length}エリア / {totalSalonCount}店舗
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {pref.name}エリアのメンズエステ店舗・セラピスト情報を掲載。
                口コミやレーダーチャートで自分に合ったセラピストを見つけよう。
              </p>
            </div>

            {/* Area Grid */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">エリアから探す</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {areas.map((area) => (
                  <Link
                    key={area.id}
                    href={`/area/${prefecture}/${area.slug}`}
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardContent className="p-4">
                        <h3 className="font-bold text-lg mb-2">{area.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Store className="h-4 w-4" />
                            {area.salon_count || 0}店舗
                          </span>
                          {area.search_volume ? (
                            <span className="text-xs">
                              SV: {area.search_volume.toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-80 flex-shrink-0">
            <Sidebar />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
