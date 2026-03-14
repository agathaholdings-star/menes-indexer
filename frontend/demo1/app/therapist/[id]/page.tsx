import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Heart, Share2 } from "lucide-react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { Therapist, Review } from "@/lib/data";
import { therapistTypes, bodyTypes, serviceTypes } from "@/lib/data";
import { TherapistImage } from "@/components/shared/therapist-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/layout/site-header";
import { Sidebar } from "@/components/layout/sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProfileTable } from "@/components/therapist/profile-table";
import { parseNameAge } from "@/lib/therapist-utils";
import { getSalonAreaInfo } from "@/lib/supabase-data";
import { ImageGallery } from "./image-gallery";
import { ReviewsSection } from "./reviews-section";
import { WriteReviewTrigger } from "./write-review-trigger";
import { ReviewModalProvider } from "./review-modal-context";
import { HydrationSwitch } from "./hydration-switch";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { data } = await supabase
    .from("reviews")
    .select("therapist_id")
    .eq("moderation_status", "approved");
  const uniqueIds = [...new Set((data || []).map((r) => r.therapist_id))];
  return uniqueIds.map((id) => ({ id: String(id) }));
}

interface TherapistPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: TherapistPageProps): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return {};
  const { data } = await supabase
    .from("therapists")
    .select("name, age, salon_id, height, cup, image_urls")
    .eq("id", Number(id))
    .single();
  if (!data) return {};
  const [{ data: shop }, areaInfo] = await Promise.all([
    supabase.from("salons").select("display_name, name").eq("id", data.salon_id).single(),
    getSalonAreaInfo(data.salon_id),
  ]);
  const salonName = shop?.display_name || shop?.name || "";
  const areaText = areaInfo ? `（${areaInfo.areaName}）` : "";

  const specs: string[] = [];
  if (data.age) specs.push(`${data.age}歳`);
  if (data.height) specs.push(`${data.height}cm`);
  if (data.cup) specs.push(`${data.cup}カップ`);
  const specText = specs.length > 0 ? `（${specs.join("・")}）` : "";

  const desc = `${salonName}${areaText}の${data.name}${specText}の口コミ体験談。サービスの質や施術内容、密着度、雰囲気などリアルな評判を掲載。`;
  const titleText = `${salonName}「${data.name}」の口コミや評判が分かる体験談`;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://menes-skr.com";
  const pageUrl = `${baseUrl}/therapist/${id}`;
  const images = (data.image_urls as string[]) || [];
  const ogImage = images.length > 0 ? images[0] : `${baseUrl}/og-image.png`;
  return {
    title: titleText,
    description: desc,
    alternates: { canonical: `/therapist/${id}` },
    openGraph: {
      title: titleText,
      description: desc,
      url: pageUrl,
      images: [{ url: ogImage }],
      type: "article",
      siteName: "メンエスSKR",
      locale: "ja_JP",
    },
    twitter: {
      card: "summary_large_image",
      title: titleText,
      description: desc,
      images: [ogImage],
    },
  };
}

// Helper to get label from type ID
function getTypeLabel(id: string) {
  return therapistTypes.find(t => t.id === id)?.label || id;
}
function getBodyLabel(id: string) {
  return bodyTypes.find(b => b.id === id)?.label || id;
}
function getServiceLabel(id: string) {
  return serviceTypes.find(s => s.id === id)?.label || id;
}

export default async function TherapistPage({ params }: TherapistPageProps) {
  const { id } = await params;

  const isNumeric = /^\d+$/.test(id);
  if (!isNumeric) {
    notFound();
  }

  const { data: dbTherapist } = await supabase
    .from("therapists")
    .select("*")
    .eq("id", Number(id))
    .single();

  if (!dbTherapist) {
    notFound();
  }

  const { name: parsedName, age: parsedAge } = parseNameAge(dbTherapist.name, dbTherapist.age);

  const [{ data: shop }, areaInfo, { data: dbReviews }, { data: sameShopTherapists }] = await Promise.all([
    supabase.from("salons").select("name, display_name, business_hours, base_price, base_duration, access").eq("id", dbTherapist.salon_id).single(),
    getSalonAreaInfo(dbTherapist.salon_id),
    supabase.from("reviews").select("*, profiles:reviews_user_id_fkey(nickname, total_review_count)").eq("therapist_id", Number(id)).eq("moderation_status", "approved").order("created_at", { ascending: false }).limit(100),
    supabase.from("therapists").select("id, name, age, image_urls").eq("salon_id", dbTherapist.salon_id).neq("id", Number(id)).eq("status", "active")
      .not("name", "ilike", "%プロフィール%").not("name", "ilike", "%profile%").not("name", "ilike", "%THERAPIST%")
      .not("name", "ilike", "%セラピスト%").not("name", "ilike", "%キャスト紹介%").not("name", "ilike", "%在籍表%")
      .not("name", "ilike", "%staff%").not("name", "ilike", "%ランキング%").not("name", "eq", "---")
      .order("review_count", { ascending: false, nullsFirst: false }).limit(8),
  ]);

  const reviewCount = (dbReviews || []).length;
  const averageScore = reviewCount > 0
    ? Math.round((dbReviews || []).reduce((sum: number, r: any) => sum + (r.score || 0), 0) / reviewCount)
    : 0;

  const salonName = shop?.display_name || shop?.name || "";
  const images = (dbTherapist.image_urls as string[]) || [];

  const therapist: Therapist = {
    id: String(dbTherapist.id),
    name: parsedName,
    age: parsedAge,
    salonId: String(dbTherapist.salon_id),
    salonName,
    area: areaInfo?.prefSlug || "",
    district: areaInfo?.areaSlug || "",
    images,
    profile: {
      height: dbTherapist.height || 0,
      bust: dbTherapist.bust || "",
      waist: dbTherapist.waist || 0,
      hip: dbTherapist.hip || 0,
      cup: dbTherapist.cup || "",
    },
    comment: dbTherapist.profile_text || "",
    schedule: {},
    tags: [],
    typeId: "",
    primaryType: "",
    types: [],
    bodyType: "",
    parameters: { conversation: 0, distance: 0, technique: 0, personality: 0 },
    reviewCount,
    averageScore,
    rating: 0,
    source_url: dbTherapist.source_url || "",
  };

  const reviews: Review[] = (dbReviews || []).map((r: any) => ({
    id: r.id,
    therapistId: String(r.therapist_id),
    therapistName: therapist.name,
    salonName: therapist.salonName,
    score: r.score || 0,
    typeId: r.looks_type_id ? String(r.looks_type_id) : "",
    bodyType: r.body_type_id ? String(r.body_type_id) : "",
    serviceType: r.service_level_id ? String(r.service_level_id) : "",
    parameters: {
      conversation: r.param_conversation || 3,
      distance: r.param_distance || 3,
      technique: r.param_technique || 3,
      personality: r.param_personality || 3,
    },
    tags: [r.looks_type_id ? String(r.looks_type_id) : "", r.body_type_id ? String(r.body_type_id) : ""].filter(Boolean),
    commentReason: r.comment_reason || "",
    commentFirstImpression: r.comment_first_impression || "",
    commentStyle: r.comment_style || "",
    commentService: r.comment_service || "",
    commentServiceDetail: r.comment_service_detail || "",
    commentCost: r.comment_cost || "",
    commentRevisit: r.comment_revisit || "",
    commentAdvice: r.comment_advice || "",
    createdAt: new Date(r.created_at).toLocaleDateString("ja-JP"),
    userId: r.user_id || "",
    userName: (r as any).profiles?.nickname || "匿名",
    reviewerLevel: (r as any).profiles?.total_review_count || 0,
    realCount: r.real_count || 0,
    fakeCount: r.fake_count || 0,
    viewCount: r.view_count || 0,
    helpfulCount: r.helpful_count || 0,
    verificationImagePath: r.verification_image_path || null,
  }));

  // Structured data
  const reviewStructuredData = (dbReviews || []).slice(0, 5).reduce<Record<string, unknown>[]>((items, r: any) => {
    const reviewBody = [
      r.comment_reason, r.comment_first_impression, r.comment_style,
      r.comment_service, r.comment_service_detail, r.comment_cost,
      r.comment_revisit, r.comment_advice,
    ].filter(Boolean).join(" ").slice(0, 300);
    if (!reviewBody && !r.score) return items;
    items.push({
      "@type": "Review",
      author: { "@type": "Person", name: r.profiles?.nickname || "匿名" },
      reviewRating: { "@type": "Rating", ratingValue: r.score || 0, bestRating: 100, worstRating: 1 },
      reviewBody,
      datePublished: r.created_at,
    });
    return items;
  }, []);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://menes-skr.com";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: therapist.salonName || therapist.name,
    image: therapist.images.length > 0 ? therapist.images : undefined,
    description: `${therapist.name}${therapist.age ? `（${therapist.age}歳）` : ""}${therapist.salonName ? `（${therapist.salonName}）` : ""}${therapist.comment ? ` ${therapist.comment}` : ""}`,
    url: `${baseUrl}/therapist/${therapist.id}`,
    address: areaInfo
      ? { "@type": "PostalAddress", addressRegion: areaInfo.prefName, addressLocality: areaInfo.areaName }
      : undefined,
    employee: {
      "@type": "Person",
      name: therapist.name,
      image: therapist.images[0] || undefined,
      description: therapist.comment || undefined,
      url: `${baseUrl}/therapist/${therapist.id}`,
    },
    aggregateRating: reviewCount > 0
      ? { "@type": "AggregateRating", ratingValue: averageScore, reviewCount, bestRating: 100, worstRating: 1 }
      : undefined,
    review: reviewStructuredData.length > 0 ? reviewStructuredData : undefined,
  };

  // ペイウォール構造化データ（Google推奨）
  const paywallJsonLd = reviewCount > 0 ? {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${salonName}「${therapist.name}」の口コミや評判が分かる体験談`,
    isAccessibleForFree: false,
    hasPart: reviews.map((r) => ({
      "@type": "WebPageElement",
      isAccessibleForFree: false,
      cssSelector: `[data-review-id="${r.id}"]`,
    })),
  } : null;

  const breadcrumbItems: { name: string; item: string }[] = [
    { name: "トップ", item: baseUrl },
  ];
  if (areaInfo?.prefSlug && areaInfo?.prefName) {
    breadcrumbItems.push({ name: `${areaInfo.prefName}のメンズエステ`, item: `${baseUrl}/area/${areaInfo.prefSlug}` });
  }
  if (areaInfo?.prefSlug && areaInfo?.areaSlug && areaInfo?.areaName) {
    breadcrumbItems.push({ name: `${areaInfo.areaName}のメンズエステ`, item: `${baseUrl}/area/${areaInfo.prefSlug}/${areaInfo.areaSlug}` });
  }
  if (therapist.salonName && therapist.salonId) {
    breadcrumbItems.push({ name: therapist.salonName, item: `${baseUrl}/salon/${therapist.salonId}` });
  }
  breadcrumbItems.push({ name: therapist.name, item: `${baseUrl}/therapist/${therapist.id}` });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, i) => ({
      "@type": "ListItem", position: i + 1, name: item.name, item: item.item,
    })),
  };

  const salonInfo = {
    businessHours: shop?.business_hours || null,
    basePrice: shop?.base_price || null,
    baseDuration: shop?.base_duration || null,
    access: shop?.access || null,
  };

  const prefill = {
    therapistId: therapist.id,
    therapistName: therapist.name,
    salonId: therapist.salonId,
    salonName: therapist.salonName,
    areaName: therapist.area,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      {paywallJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(paywallJsonLd).replace(/</g, "\\u003c") }}
        />
      )}

      <ReviewModalProvider defaultPrefill={prefill}>
        <div className="min-h-screen flex flex-col bg-background">
          <SiteHeader />

          <main className="flex-1">
            <div className="mx-auto max-w-7xl px-4 py-6">
              {/* Breadcrumb - SSR */}
              <nav className="mb-4 text-sm text-muted-foreground">
                <Link href="/" className="hover:text-foreground">トップ</Link>
                <span className="mx-2">/</span>
                {areaInfo?.prefName && (
                  <>
                    <Link href={`/area/${therapist.area}`} className="hover:text-foreground">{areaInfo.prefName}</Link>
                    <span className="mx-2">/</span>
                  </>
                )}
                {areaInfo?.areaName && (
                  <>
                    <Link href={`/area/${therapist.area}/${therapist.district}`} className="hover:text-foreground">{areaInfo.areaName}</Link>
                    <span className="mx-2">/</span>
                  </>
                )}
                <Link href={`/salon/${therapist.salonId}`} className="hover:text-foreground">{therapist.salonName}</Link>
                <span className="mx-2">/</span>
                <span className="text-foreground">{therapist.name}</span>
              </nav>

              {/* 2-column layout */}
              <div className="flex flex-col gap-8 lg:flex-row">
                {/* Main Column */}
                <div className="flex-1 space-y-6">
                  {/* Profile Card */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-6 md:flex-row">
                        {/* Image Gallery - Client Component */}
                        <ImageGallery images={images} name={therapist.name} />

                        {/* Profile Info - SSR */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold">{therapist.name}</h1>
                                {therapist.age > 0 && (
                                  <span className="text-muted-foreground">({therapist.age})</span>
                                )}
                              </div>
                              <Link href={`/salon/${therapist.salonId}`} className="text-primary hover:underline">
                                {therapist.salonName}
                              </Link>
                              {therapist.reviewCount > 0 && (
                                <div className="mt-2">
                                  <span className="text-sm text-muted-foreground">({therapist.reviewCount}件の口コミ)</span>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="icon">
                                <Heart className="h-4 w-4" />
                                <span className="sr-only">お気に入りに追加</span>
                              </Button>
                              <Button variant="outline" size="icon">
                                <Share2 className="h-4 w-4" />
                                <span className="sr-only">共有</span>
                              </Button>
                            </div>
                          </div>
                          <ProfileTable therapist={therapist} />
                        </div>
                      </div>

                      {/* 所属サロン情報 - SSR */}
                      {salonInfo && (salonInfo.access || salonInfo.businessHours || (salonInfo.basePrice && salonInfo.baseDuration)) && (
                        <div className="mt-6 border-t pt-4">
                          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">所属サロン情報</h2>
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <tbody>
                                {salonInfo.access && (
                                  <tr className="bg-muted/30">
                                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-32">アクセス</th>
                                    <td className="px-4 py-2.5">{salonInfo.access}</td>
                                  </tr>
                                )}
                                {salonInfo.businessHours && (
                                  <tr className={salonInfo.access ? "bg-background" : "bg-muted/30"}>
                                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-32">営業時間</th>
                                    <td className="px-4 py-2.5">{salonInfo.businessHours}</td>
                                  </tr>
                                )}
                                {salonInfo.basePrice && salonInfo.baseDuration && (
                                  <tr className={[salonInfo.access, salonInfo.businessHours].filter(Boolean).length % 2 === 0 ? "bg-muted/30" : "bg-background"}>
                                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-32">料金</th>
                                    <td className="px-4 py-2.5">{salonInfo.baseDuration}分 {salonInfo.basePrice.toLocaleString()}円〜</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Reviews: SSR content for crawlers, replaced by client component after hydration */}
                  <HydrationSwitch
                    ssrContent={
                      reviews.length > 0 ? (
                        <section>
                          <h2 className="text-lg font-bold mb-4">{therapist.name}の口コミ ({reviewCount}件)</h2>
                          <div className="space-y-4">
                            {reviews.map((review) => (
                              <article key={`ssr-${review.id}`} data-review-id={review.id} className="overflow-hidden shadow-md rounded-lg border bg-card">
                                <div className="bg-gradient-to-r from-primary to-blue-600 px-5 py-3">
                                  <h3 className="text-white font-bold text-base">{salonName || "サロン"}</h3>
                                  <p className="text-blue-100 text-sm mt-0.5">
                                    <span className="text-white font-bold">{therapist.name}{therapist.age > 0 ? ` (${therapist.age})` : ""}</span> さんの口コミ体験レポート
                                  </p>
                                </div>
                                <div className="p-5 border-b">
                                  <div className="flex gap-1">
                                    {review.typeId && <Badge variant="secondary" className="text-[10px]">{getTypeLabel(review.typeId)}</Badge>}
                                    {review.bodyType && <Badge variant="secondary" className="text-[10px]">{getBodyLabel(review.bodyType)}</Badge>}
                                    {review.serviceType && <Badge variant="secondary" className="text-[10px]">{getServiceLabel(review.serviceType)}</Badge>}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-2">
                                    <p>投稿者: <span className="text-primary font-medium">{review.userName || "匿名"}</span></p>
                                    {review.createdAt && <p className="mt-0.5">{review.createdAt}</p>}
                                  </div>
                                </div>
                                {/* Real review text - blurred via CSS. Googlebot reads text despite blur. */}
                                <div className="px-5 pt-4 pb-4 space-y-3 text-sm select-none" style={{ filter: "blur(5px)" }}>
                                  {review.commentFirstImpression && (
                                    <div><p className="font-medium text-xs text-muted-foreground mb-1">顔の印象</p><p className="leading-relaxed">{review.commentFirstImpression}</p></div>
                                  )}
                                  {review.commentStyle && (
                                    <div><p className="font-medium text-xs text-muted-foreground mb-1">スタイル</p><p className="leading-relaxed">{review.commentStyle}</p></div>
                                  )}
                                  {review.commentService && (
                                    <div><p className="font-medium text-xs text-muted-foreground mb-1">施術の流れ</p><p className="leading-relaxed">{review.commentService}</p></div>
                                  )}
                                  {review.commentServiceDetail && (
                                    <div><p className="font-medium text-xs text-muted-foreground mb-1">どこまでいけた</p><p className="leading-relaxed">{review.commentServiceDetail}</p></div>
                                  )}
                                  {review.commentCost && (
                                    <div><p className="font-medium text-xs text-muted-foreground mb-1">お値段</p><p className="leading-relaxed">{review.commentCost}</p></div>
                                  )}
                                  {review.commentRevisit && (
                                    <div><p className="font-medium text-xs text-muted-foreground mb-1">また行きたい？</p><p className="leading-relaxed">{review.commentRevisit}</p></div>
                                  )}
                                  {review.commentAdvice && (
                                    <div><p className="font-medium text-xs text-muted-foreground mb-1">アドバイス</p><p className="leading-relaxed">{review.commentAdvice}</p></div>
                                  )}
                                </div>
                              </article>
                            ))}
                          </div>
                        </section>
                      ) : (
                        <Card>
                          <CardContent className="p-8 text-center">
                            <h3 className="text-lg font-bold mb-2">このセラピストの口コミを最初に投稿しませんか?</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              口コミを投稿すると5クレジット獲得(スクショ付きで10クレジット)
                            </p>
                          </CardContent>
                        </Card>
                      )
                    }
                  >
                    <ReviewsSection
                      reviews={reviews}
                      therapistId={therapist.id}
                      therapistName={therapist.name}
                      therapistAge={therapist.age}
                      therapistImage={images[0] || ""}
                      salonId={therapist.salonId}
                      salonName={therapist.salonName}
                      areaSlug={therapist.area}
                    />
                  </HydrationSwitch>

                  {/* Same-shop therapists - SSR */}
                  {sameShopTherapists && sameShopTherapists.length > 0 && (
                    <div className="mt-6">
                      <h2 className="text-lg font-bold mb-4">{therapist.salonName}の他のセラピスト</h2>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {sameShopTherapists.map((t: any) => {
                          const displayName = t.name.replace(/\s*\(\d{2}\)$/, "");
                          const imgUrl = (t.image_urls || [])[0] || null;
                          return (
                            <Link key={t.id} href={`/therapist/${t.id}`} className="group">
                              <div className="relative h-36 rounded-lg overflow-hidden">
                                <TherapistImage src={imgUrl} alt={displayName} fill className="object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                  <p className="font-bold text-sm text-white">{displayName}</p>
                                  {t.age && <p className="text-xs text-white/80">{t.age}歳</p>}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sidebar */}
                <div className="hidden lg:block lg:w-80 lg:shrink-0">
                  <div className="lg:sticky lg:top-24">
                    <Sidebar prefectureName={therapist.area} />
                  </div>
                </div>
              </div>
            </div>
          </main>

          <SiteFooter />
        </div>

        {/* ?write=true auto-open trigger */}
        <Suspense fallback={null}>
          <WriteReviewTrigger prefill={prefill} />
        </Suspense>
      </ReviewModalProvider>
    </>
  );
}
