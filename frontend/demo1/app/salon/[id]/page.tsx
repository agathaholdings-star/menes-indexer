import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopPageClient } from "./shop-page-client";
import { getShopById, getShopBySlug, getTherapistsByShopId, getShopAreaInfo, getSalonReviewStatsBatch } from "@/lib/supabase-data";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

export const revalidate = 3600;
import type { Shop as DbShop, Therapist as DbTherapist } from "@/types/database";
import type { Shop, Therapist, Review } from "@/lib/data";
import { parseNameAge } from "@/lib/therapist-utils";

interface ShopPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const { id } = await params;
  const isNumeric = /^\d+$/.test(id);
  const dbShop = isNumeric ? await getShopById(Number(id)) : await getShopBySlug(id);
  if (!dbShop) return {};
  const name = dbShop.display_name || dbShop.name;
  const areaInfo = await getShopAreaInfo(dbShop.id);
  const areaText = areaInfo ? `（${areaInfo.areaName}）` : "";

  // 口コミ件数・セラピスト数を取得
  const statsMap = await getSalonReviewStatsBatch([dbShop.id]);
  const stats = statsMap.get(dbShop.id);
  const reviewCount = stats?.review_count ?? 0;
  const therapistCount = stats?.therapist_count ?? 0;

  // 料金情報
  const priceText = dbShop.base_price
    ? `料金${dbShop.base_duration || 60}分${dbShop.base_price.toLocaleString()}円〜。`
    : "";

  // 動的な統計テキスト
  const statsTexts: string[] = [];
  if (reviewCount > 0) statsTexts.push(`口コミ${reviewCount}件`);
  if (therapistCount > 0) statsTexts.push(`セラピスト${therapistCount}名`);
  const statsText = statsTexts.length > 0 ? `${statsTexts.join("・")}掲載。` : "";

  const desc = `${name}${areaText}の口コミ体験談。${statsText}${priceText}施術内容やサービスの質、セラピストの評判をリアルな口コミで比較できます。`;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://menes-skr.com";
  return {
    title: dbShop.seo_title || `${name}の口コミ体験談`,
    description: desc,
    alternates: { canonical: `${baseUrl}/salon/${dbShop.id}` },
  };
}

// DBのShop → フロントのShop型
function toFrontendShop(
  dbShop: DbShop,
  stats?: { review_count: number; avg_score: number; therapist_count: number }
): Shop {
  const reviewCount = stats?.review_count ?? 0;
  const avgScore = stats?.avg_score ?? 0;

  return {
    id: String(dbShop.id),
    name: dbShop.display_name || dbShop.name,
    area: "",
    district: "",
    access: dbShop.access || "",
    hours: dbShop.business_hours || "",
    priceRange: dbShop.base_price
      ? `${dbShop.base_duration || 60}分 ¥${dbShop.base_price.toLocaleString()}〜`
      : "",
    genres: dbShop.service_tags || [],
    description: dbShop.description || dbShop.salon_overview || "",
    therapistCount: stats?.therapist_count ?? 0,
    reviewCount,
    averageScore: avgScore,
    rating: avgScore,
    thumbnail: dbShop.image_url || "/placeholder.svg",
    images: dbShop.image_url ? [dbShop.image_url] : [],
    courses: [],
  };
}

// DBのTherapist → フロントのTherapist型
function toFrontendTherapist(t: DbTherapist, shopName: string): Therapist {
  const { name, age } = parseNameAge(t.name, t.age);
  return {
    id: String(t.id),
    name,
    age,
    shopId: String(t.salon_id),
    shopName,
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
    shopName: "",
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
  };
}

export default async function ShopPage({ params }: ShopPageProps) {
  const { id } = await params;

  // IDが数値ならIDで検索、そうでなければslugで検索
  const isNumeric = /^\d+$/.test(id);
  const dbShop = isNumeric
    ? await getShopById(Number(id))
    : await getShopBySlug(id);

  if (!dbShop) {
    notFound();
  }

  // 口コミ統計をバッチ取得
  const statsMap = await getSalonReviewStatsBatch([dbShop.id]);
  const stats = statsMap.get(dbShop.id);

  const shop = toFrontendShop(dbShop, stats);

  // セラピスト取得
  const dbTherapists = await getTherapistsByShopId(dbShop.id);
  const therapists = dbTherapists.map((t) =>
    toFrontendTherapist(t, shop.name)
  );
  shop.therapistCount = therapists.length;

  // エリア情報取得（パンくず用）
  const areaInfo = await getShopAreaInfo(dbShop.id);

  // 口コミ取得（approved のみ）+ セラピスト名をjoin
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("*, therapists(name, image_urls)")
    .eq("salon_id", dbShop.id)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  const shopReviews: Review[] = (reviewRows || []).map((r) => {
    const row = r as Record<string, unknown>;
    const review = toFrontendReview(row);
    const therapistData = row.therapists as { name: string; image_urls?: string[] } | null;
    if (therapistData?.name) {
      review.therapistName = therapistData.name;
    }
    review.shopName = shop.name;
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
        officialUrl={dbShop.official_url || null}
        areaName={areaInfo?.areaName || ""}
        areaSlug={areaInfo?.areaSlug || ""}
        prefName={areaInfo?.prefName || ""}
        prefSlug={areaInfo?.prefSlug || ""}
      />
    </>
  );
}
