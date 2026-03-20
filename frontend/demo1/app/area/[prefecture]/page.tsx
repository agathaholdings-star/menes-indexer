import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ChevronRight, Store, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TherapistImage } from "@/components/shared/therapist-image";

export const revalidate = 86400;
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Sidebar } from "@/components/layout/sidebar";
import { getPrefectureBySlug, getAreasByPrefectureId } from "@/lib/supabase-data";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { SeoContentSection, FaqSection } from "@/components/shared/seo-content-section";

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ prefecture: string }>;
}): Promise<Metadata> {
  const { prefecture } = await params;
  const pref = await getPrefectureBySlug(prefecture);
  if (!pref) return {};
  return {
    title: `${pref.name}のメンズエステ一覧`,
    description: `${pref.name}のメンズエステをエリア別に探せます。口コミ体験談・料金・施術内容・セラピストの評判を比較して、自分に合ったサロンを見つけよう。`,
    alternates: { canonical: `/area/${prefecture}` },
  };
}

export default async function AreaPrefecturePage({
  params,
}: {
  params: Promise<{ prefecture: string }>;
}) {
  const { prefecture } = await params;

  const pref = await getPrefectureBySlug(prefecture);
  if (!pref) {
    notFound();
  }

  const [areas, popularTherapists, seoContents] = await Promise.all([
    getAreasByPrefectureId(pref.id),
    supabase
      .from("therapists")
      .select("id, name, age, image_urls, review_count, salons!inner(id, name, display_name, salon_areas!inner(areas!inner(prefecture_id)))")
      .eq("salons.salon_areas.areas.prefecture_id", pref.id)
      .gt("review_count", 0)
      .order("review_count", { ascending: false })
      .limit(8)
      .then(({ data }) => data || []),
    supabase
      .from("page_contents")
      .select("content_key, title, body")
      .eq("page_type", "prefecture")
      .eq("entity_id", pref.id)
      .then(({ data }) => data || []),
  ]);

  const seoGuide = seoContents.find((c) => c.content_key === "guide");
  const seoHighlights = seoContents.find((c) => c.content_key === "highlights");

  const totalSalonCount = areas.reduce((sum, a) => sum + (a.salon_count || 0), 0);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://menes-skr.com";
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "トップ",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: `${pref.name}のメンズエステ`,
        item: `${baseUrl}/area/${prefecture}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
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

            {/* Popular Therapists in Prefecture */}
            {popularTherapists.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  {pref.name}の人気セラピスト
                </h2>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                  {popularTherapists.map((t: any) => {
                    const images = t.image_urls || [];
                    const salonName = t.salons?.display_name || t.salons?.name || "";
                    const displayName = t.name.replace(/\s*\(\d{2}\)$/, "");
                    return (
                      <Link key={t.id} href={`/therapist/${t.id}`}>
                        <Card className="hover:shadow-md transition-shadow overflow-hidden">
                          <div className="relative h-36 w-full overflow-hidden">
                            <TherapistImage
                              src={images[0]}
                              alt={displayName}
                              fill
                              sizes="(max-width: 640px) 50vw, 160px"
                              className="object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                              <p className="font-bold text-sm text-white">{displayName}</p>
                              {t.age && <p className="text-xs text-white/80">{t.age}歳</p>}
                            </div>
                          </div>
                          <CardContent className="p-2">
                            <p className="text-xs text-muted-foreground truncate">{salonName}</p>
                            <p className="text-xs text-primary">{t.review_count}件の口コミ</p>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* SEO Content Sections */}
            {seoGuide && (
              <SeoContentSection title={seoGuide.title} body={seoGuide.body} />
            )}
            {seoHighlights && (
              <SeoContentSection title={seoHighlights.title} body={seoHighlights.body} />
            )}

            {/* FAQ (テンプレート) */}
            <FaqSection
              title={`${pref.name}のメンズエステ よくある質問`}

              items={[
                {
                  question: `${pref.name}で一番サロンが多いエリアは？`,
                  answer: `${pref.name}のメンズエステは各エリアに店舗が点在しています。当サイトのエリア一覧から、店舗数の多いエリアを確認できます。`,
                },
                {
                  question: `${pref.name}のメンズエステの料金相場は？`,
                  answer: `${pref.name}のメンズエステの料金は、60分で12,000円〜20,000円程度が一般的です。エリアや店舗のグレードによって異なります。`,
                },
                {
                  question: `初めてでも利用しやすいエリアは？`,
                  answer: `駅近で口コミ評価の高いエリアがおすすめです。当サイトの口コミを参考に、自分に合ったエリアを探してみてください。`,
                },
                {
                  question: `深夜営業しているエリアは？`,
                  answer: `${pref.name}の多くのメンズエステは深夜まで営業しています。翌5時まで営業している店舗も多数あります。`,
                },
                {
                  question: `予約なしでも行ける？`,
                  answer: `ほとんどのメンズエステは完全予約制です。事前に電話またはWEB予約を入れてから来店しましょう。`,
                },
              ]}
            />
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block w-full lg:w-80 flex-shrink-0">
            <Sidebar prefectureName={pref.name} />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
    </>
  );
}
