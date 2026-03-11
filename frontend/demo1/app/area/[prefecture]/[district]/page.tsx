import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { therapistTypes, bodyTypes } from "@/lib/data";
import { SalonListPageClient } from "./salon-list-client";
import { getPrefectureBySlug, getAreaBySlug, getShopsByAreaSlug, getRankedSalonsByArea, getLatestReviewsBySalonIds, getNearbyAreas } from "@/lib/supabase-data";
import type { SalonLatestReview, NearbyAreaLink } from "@/lib/supabase-data";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { data } = await supabase
    .from("areas")
    .select("slug, prefectures(slug)")
    .gt("salon_count", 0);
  return (data || []).map((a: any) => ({
    prefecture: a.prefectures?.slug,
    district: a.slug,
  })).filter((p: any) => p.prefecture);
}
import type { Shop as DbShop } from "@/types/database";
import type { Shop } from "@/lib/data";
import type { SalonRankingStats } from "@/lib/supabase-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ prefecture: string; district: string }>;
}): Promise<Metadata> {
  const { prefecture, district } = await params;
  const pref = await getPrefectureBySlug(prefecture);
  const area = await getAreaBySlug(district);
  if (!pref || !area) return {};

  const salonCount = area.salon_count || 0;
  const defaultDescription = `${pref.name}${area.name}のメンズエステ${salonCount}店舗を口コミ・評価でランキング。料金や施術内容、サービスの質、密着度、セラピストの評判を比較して最適なサロンを見つけよう。`;
  return {
    title: `${area.name}のおすすめメンズエステランキング`,
    description: area.meta_description || defaultDescription,
    alternates: { canonical: `/area/${prefecture}/${district}` },
  };
}

interface ShopListPageProps {
  params: Promise<{ prefecture: string; district: string }>;
}

// DBのShop → フロントのShop型に変換
function toFrontendShop(
  dbSalon: DbShop,
  stats?: SalonRankingStats,
  rank?: number
): Shop {
  const reviewCount = stats?.review_count ?? 0;
  const avgScore = stats ? Number(stats.avg_score) : 0;

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
    description: dbSalon.description || (dbSalon as Record<string, unknown>).salon_overview as string || "",
    therapistCount: stats?.therapist_count ?? 0,
    reviewCount,
    averageScore: avgScore,
    rating: avgScore,
    thumbnail: dbSalon.image_url || "/placeholder.svg",
    images: dbSalon.image_url ? [dbSalon.image_url] : [],
    courses: [],
    rank: rank,
    rankingScore: stats ? Number(stats.ranking_score) : 0,
  };
}

export default async function ShopListPage({ params }: ShopListPageProps) {
  const { prefecture, district } = await params;

  const pref = await getPrefectureBySlug(prefecture);
  if (!pref) {
    notFound();
  }

  const area = await getAreaBySlug(district);
  if (!area || !area.salon_count) {
    notFound();
  }

  // サロン基本情報とランキングデータを並列取得
  const [dbSalons, rankingData] = await Promise.all([
    getShopsByAreaSlug(district),
    getRankedSalonsByArea(area.id),
  ]);
  const salonMap = new Map(dbSalons.map((s) => [s.id, s]));

  // statsMapとrankMapを作成
  const statsMap = new Map<number, SalonRankingStats>();
  for (const r of rankingData) {
    statsMap.set(r.salon_id, r);
  }

  // 全サロンをランキング順に1〜N位で順位付け
  // RPCの返り値はranking_score DESC順。口コミ0件は末尾に来る
  const shops: Shop[] = [];
  let rank = 1;
  for (const r of rankingData) {
    const dbSalon = salonMap.get(r.salon_id);
    if (!dbSalon) continue;
    shops.push(toFrontendShop(dbSalon, r, rank++));
  }

  // 最新口コミプレビューと近隣エリアリンクを並列取得
  const allSalonIds = dbSalons.map((s) => s.id);
  const [latestReviewsMap, nearbyAreas] = await Promise.all([
    getLatestReviewsBySalonIds(allSalonIds),
    getNearbyAreas(area.nearby_areas ?? null, area.prefecture_id),
  ]);
  // シリアライズ可能な形式に変換（Map → Record）
  const latestReviews: Record<string, SalonLatestReview> = {};
  for (const [salonId, review] of latestReviewsMap) {
    latestReviews[String(salonId)] = review;
  }

  // RPCに含まれなかったサロン（is_active=falseなど）を末尾に追加
  const rankedIds = new Set(rankingData.map((r) => r.salon_id));
  for (const dbSalon of dbSalons) {
    if (!rankedIds.has(dbSalon.id)) {
      shops.push(toFrontendShop(dbSalon, undefined, rank++));
    }
  }

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
      {
        "@type": "ListItem",
        position: 3,
        name: `${area.name}のメンズエステ`,
        item: `${baseUrl}/area/${prefecture}/${district}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <SalonListPageClient
        prefecture={prefecture}
        district={district}
        decodedPrefecture={pref.name}
        decodedDistrict={area.name}
        shops={shops}
        allTherapists={[]}
        therapistTypes={therapistTypes}
        bodyTypes={bodyTypes}
        latestReviews={latestReviews}
        nearbyAreas={nearbyAreas}
        prefectureSlug={prefecture}
        seoDescription={area.seo_description ?? undefined}
      />
    </>
  );
}
