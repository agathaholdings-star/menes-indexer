import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { therapistTypes, bodyTypes } from "@/lib/data";
import { ShopListPageClient } from "./shop-list-client";
import { getPrefectureBySlug, getAreaBySlug, getShopsByAreaSlug, getRankedSalonsByArea, getLatestReviewsBySalonIds, getNearbyAreas } from "@/lib/supabase-data";
import type { SalonLatestReview, NearbyAreaLink } from "@/lib/supabase-data";

export const revalidate = 3600;
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
  };
}

interface ShopListPageProps {
  params: Promise<{ prefecture: string; district: string }>;
}

// DBのShop → フロントのShop型に変換
function toFrontendShop(
  dbShop: DbShop,
  stats?: SalonRankingStats,
  rank?: number
): Shop {
  const reviewCount = stats?.review_count ?? 0;
  const avgScore = stats ? Number(stats.avg_score) : 0;

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
    description: dbShop.description || (dbShop as Record<string, unknown>).salon_overview as string || "",
    therapistCount: stats?.therapist_count ?? 0,
    reviewCount,
    averageScore: avgScore,
    rating: avgScore,
    thumbnail: dbShop.image_url || "/placeholder.svg",
    images: dbShop.image_url ? [dbShop.image_url] : [],
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
  const [dbShops, rankingData] = await Promise.all([
    getShopsByAreaSlug(district),
    getRankedSalonsByArea(area.id),
  ]);
  const shopMap = new Map(dbShops.map((s) => [s.id, s]));

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
    const dbShop = shopMap.get(r.salon_id);
    if (!dbShop) continue;
    shops.push(toFrontendShop(dbShop, r, rank++));
  }

  // 最新口コミプレビューと近隣エリアリンクを並列取得
  const allSalonIds = dbShops.map((s) => s.id);
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
  for (const dbShop of dbShops) {
    if (!rankedIds.has(dbShop.id)) {
      shops.push(toFrontendShop(dbShop, undefined, rank++));
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
      <ShopListPageClient
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
