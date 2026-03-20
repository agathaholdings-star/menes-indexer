import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopPageClient } from "./shop-page-client";
import { getShopById, getShopBySlug, getTherapistsBySalonId, getSalonAreaInfo, getSalonReviewStatsBatch } from "@/lib/supabase-data";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { SeoContentSection, SalonGuideSection, FaqSection } from "@/components/shared/seo-content-section";

export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

import type { Shop as DbShop, Therapist as DbTherapist } from "@/types/database";
import type { Shop, Therapist, Review } from "@/lib/data";
import { parseNameAge } from "@/lib/therapist-utils";

interface ShopPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const { id } = await params;
  const isNumeric = /^\d+$/.test(id);
  const dbSalon = isNumeric ? await getShopById(Number(id)) : await getShopBySlug(id);
  if (!dbSalon) return {};
  const name = dbSalon.display_name || dbSalon.name;
  const [areaInfo, statsMap] = await Promise.all([
    getSalonAreaInfo(dbSalon.id),
    getSalonReviewStatsBatch([dbSalon.id]),
  ]);
  const areaText = areaInfo ? `（${areaInfo.areaName}）` : "";
  const stats = statsMap.get(dbSalon.id);
  const reviewCount = stats?.review_count ?? 0;
  const therapistCount = stats?.therapist_count ?? 0;

  // 料金情報
  const priceText = dbSalon.base_price
    ? `料金${dbSalon.base_duration || 60}分${dbSalon.base_price.toLocaleString()}円〜。`
    : "";

  // 動的な統計テキスト
  const statsTexts: string[] = [];
  if (reviewCount > 0) statsTexts.push(`口コミ${reviewCount}件`);
  if (therapistCount > 0) statsTexts.push(`セラピスト${therapistCount}名`);
  const statsText = statsTexts.length > 0 ? `${statsTexts.join("・")}掲載。` : "";

  const desc = `${name}${areaText}の在籍セラピスト口コミ体験談一覧。${statsText}${priceText}施術内容やサービスの質、セラピストの評判をリアルな口コミで比較できます。`;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://menes-skr.com";
  const titleText = `${name}の口コミ体験談`;
  const pageUrl = `${baseUrl}/salon/${dbSalon.id}`;
  const ogImage = dbSalon.image_url || `${baseUrl}/og-image.png`;
  return {
    title: titleText,
    description: desc,
    alternates: { canonical: `${baseUrl}/salon/${dbSalon.id}` },
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

// DBのShop → フロントのShop型
function toFrontendShop(
  dbSalon: DbShop,
  stats?: { review_count: number; avg_score: number; therapist_count: number }
): Shop {
  const reviewCount = stats?.review_count ?? 0;
  const avgScore = stats?.avg_score ?? 0;

  return {
    id: String(dbSalon.id),
    name: dbSalon.display_name || dbSalon.name,
    area: "",
    district: "",
    access: dbSalon.access || "",
    hours: dbSalon.business_hours || "",
    priceRange: dbSalon.base_price
      ? `${dbSalon.base_duration || 60}分 ¥${dbSalon.base_price.toLocaleString()}〜`
      : "",
    genres: dbSalon.service_tags || [],
    description: dbSalon.description || dbSalon.salon_overview || "",
    therapistCount: stats?.therapist_count ?? 0,
    reviewCount,
    averageScore: avgScore,
    rating: avgScore,
    thumbnail: dbSalon.image_url || "/placeholder.svg",
    images: dbSalon.image_url ? [dbSalon.image_url] : [],
    courses: [],
  };
}

// DBのTherapist → フロントのTherapist型
function toFrontendTherapist(t: DbTherapist, salonName: string): Therapist {
  const { name, age } = parseNameAge(t.name, t.age);
  return {
    id: String(t.id),
    name,
    age,
    salonId: String(t.salon_id),
    salonName,
    area: "",
    district: "",
    images: (t.image_urls as string[]) || [],
    profile: {
      height: t.height || 0,
      bust: t.bust || "",
      waist: t.waist || 0,
      hip: t.hip || 0,
      cup: t.cup || "",
    },
    comment: t.profile_text || "",
    schedule: {},
    tags: [],
    typeId: "",
    primaryType: "",
    types: [],
    bodyType: "",
    parameters: {
      conversation: 0,
      distance: 0,
      technique: 0,
      personality: 0,
    },
    reviewCount: 0,
    averageScore: 0,
    rating: 0,
  };
}

// DB reviewsレコード → フロントのReview型
function toFrontendReview(r: Record<string, unknown>): Review {
  return {
    id: String(r.id),
    therapistId: String(r.therapist_id),
    therapistName: "",
    salonName: "",
    score: (r.score as number) || 0,
    typeId: r.looks_type_id ? String(r.looks_type_id) : "",
    bodyType: r.body_type_id ? String(r.body_type_id) : "",
    serviceType: r.service_level_id ? String(r.service_level_id) : "",
    parameters: {
      conversation: (r.param_conversation as number) || 0,
      distance: (r.param_distance as number) || 0,
      technique: (r.param_technique as number) || 0,
      personality: (r.param_personality as number) || 0,
    },
    tags: [],
    commentReason: (r.comment_reason as string) || "",
    commentFirstImpression: (r.comment_first_impression as string) || "",
    commentStyle: (r.comment_style as string) || "",
    commentService: (r.comment_service as string) || "",
    commentServiceDetail: (r.comment_service_detail as string) || "",
    commentCost: (r.comment_cost as string) || "",
    commentRevisit: (r.comment_revisit as string) || "",
    commentAdvice: (r.comment_advice as string) || "",
    createdAt: (r.created_at as string) || "",
    userId: (r.user_id as string) || "",
    realCount: (r.real_count as number) || 0,
    fakeCount: (r.fake_count as number) || 0,
    viewCount: (r.view_count as number) || 0,
    verificationImagePath: (r.verification_image_path as string) || null,
  };
}

export default async function ShopPage({ params }: ShopPageProps) {
  const { id } = await params;

  // IDが数値ならIDで検索、そうでなければslugで検索
  const isNumeric = /^\d+$/.test(id);
  const dbSalon = isNumeric
    ? await getShopById(Number(id))
    : await getShopBySlug(id);

  if (!dbSalon) {
    notFound();
  }

  // 独立した4クエリを並列実行
  const [statsMap, dbTherapists, areaInfo, { data: reviewRows }, seoContents] = await Promise.all([
    getSalonReviewStatsBatch([dbSalon.id]),
    getTherapistsBySalonId(dbSalon.id),
    getSalonAreaInfo(dbSalon.id),
    supabase.from("reviews").select("*, therapists(name, image_urls)").eq("salon_id", dbSalon.id).eq("moderation_status", "approved").order("created_at", { ascending: false }).limit(50),
    supabase.from("page_contents").select("content_key, title, body").eq("page_type", "salon").eq("entity_id", dbSalon.id).then(({ data }) => data || []),
  ]);

  const seoMap = Object.fromEntries((seoContents || []).map(c => [c.content_key, c]));
  const stats = statsMap.get(dbSalon.id);
  const shop = toFrontendShop(dbSalon, stats);
  const therapists = dbTherapists.map((t) =>
    toFrontendTherapist(t, shop.name)
  );
  shop.therapistCount = therapists.length;

  const shopReviews: Review[] = (reviewRows || []).map((r) => {
    const row = r as Record<string, unknown>;
    const review = toFrontendReview(row);
    const therapistData = row.therapists as { name: string; image_urls?: string[] } | null;
    if (therapistData?.name) {
      review.therapistName = therapistData.name;
    }
    review.salonName = shop.name;
    review.therapistImageUrl = therapistData?.image_urls?.[0] || undefined;
    return review;
  });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://menes-skr.com";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: shop.name,
    image: shop.images.length > 0 ? shop.images : (shop.thumbnail ? [shop.thumbnail] : undefined),
    description: shop.description || `${shop.name}の口コミ体験談・セラピスト一覧`,
    url: `${baseUrl}/salon/${shop.id}`,
    address: areaInfo
      ? { "@type": "PostalAddress", addressRegion: areaInfo.prefName || undefined, addressLocality: areaInfo.areaName || undefined }
      : undefined,
    aggregateRating: shop.reviewCount > 0
      ? { "@type": "AggregateRating", ratingValue: Number(shop.averageScore.toFixed(1)), reviewCount: shop.reviewCount, bestRating: 100, worstRating: 1 }
      : undefined,
  };

  const breadcrumbItems: { name: string; item: string }[] = [
    { name: "トップ", item: baseUrl },
  ];
  if (areaInfo?.prefSlug && areaInfo?.prefName) {
    breadcrumbItems.push({
      name: `${areaInfo.prefName}のメンズエステ`,
      item: `${baseUrl}/area/${areaInfo.prefSlug}`,
    });
  }
  if (areaInfo?.prefSlug && areaInfo?.areaSlug && areaInfo?.areaName) {
    breadcrumbItems.push({
      name: `${areaInfo.areaName}のメンズエステ`,
      item: `${baseUrl}/area/${areaInfo.prefSlug}/${areaInfo.areaSlug}`,
    });
  }
  breadcrumbItems.push({
    name: shop.name,
    item: `${baseUrl}/salon/${shop.id}`,
  });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.item,
    })),
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
      <ShopPageClient
        shop={shop}
        therapists={therapists}
        shopReviews={shopReviews}
        officialUrl={dbSalon.official_url || null}
        areaName={areaInfo?.areaName || ""}
        areaSlug={areaInfo?.areaSlug || ""}
        prefName={areaInfo?.prefName || ""}
        prefSlug={areaInfo?.prefSlug || ""}
        seoContentHtml={
          <>
            {seoMap["salon_overview"] && (
              <SeoContentSection
                title={seoMap["salon_overview"].title}
                body={seoMap["salon_overview"].body}
              />
            )}
            <SalonGuideSection
              salonName={shop.name}
              basePrice={dbSalon.base_price}
              businessHours={dbSalon.business_hours}
              access={dbSalon.access}
              officialUrl={dbSalon.official_url}
            />
            <FaqSection
              title={`${shop.name}の口コミでよくある質問`}
              items={[
                {
                  question: `${shop.name}の予約方法は？`,
                  answer: `${shop.name}は完全予約制です。電話またはWEB予約でご予約ください。${dbSalon.official_url ? `公式サイト: ${dbSalon.official_url}` : ""}`,
                },
                {
                  question: `${shop.name}の料金はいくらから？`,
                  answer: `${shop.name}の基本料金は60分${dbSalon.base_price ? dbSalon.base_price.toLocaleString() + "円〜" : "要確認"}です。コース時間やオプションによって異なります。`,
                },
                {
                  question: `${shop.name}の営業時間は？`,
                  answer: `${shop.name}の営業時間は${dbSalon.business_hours || "店舗にお問い合わせください"}です。`,
                },
                {
                  question: `指名料はかかる？`,
                  answer: `メンズエステでは一般的に1,000円〜3,000円程度の指名料がかかります。${shop.name}の詳しい料金は予約時にご確認ください。`,
                },
              ]}
            />
          </>
        }
      />
    </>
  );
}
