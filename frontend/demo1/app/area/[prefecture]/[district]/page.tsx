import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { therapistTypes, bodyTypes } from "@/lib/data";
import { ShopListPageClient } from "./shop-list-client";
import { getPrefectureBySlug, getAreaBySlug, getShopsByAreaSlug, getRankedSalonsByArea } from "@/lib/supabase-data";

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
  return {
    title: `${area.name}のおすすめメンズエステランキング`,
    description: `${pref.name}${area.name}エリアのおすすめメンズエステ${salonCount}店舗をランキング。口コミ・評価で比較。`,
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

  // サロン基本情報を取得
  const dbShops = await getShopsByAreaSlug(district);
  const shopMap = new Map(dbShops.map((s) => [s.id, s]));

  // ランキングデータを取得（RPC）
  const rankingData = await getRankedSalonsByArea(area.id);

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

  // RPCに含まれなかったサロン（is_active=falseなど）を末尾に追加
  const rankedIds = new Set(rankingData.map((r) => r.salon_id));
  for (const dbShop of dbShops) {
    if (!rankedIds.has(dbShop.id)) {
      shops.push(toFrontendShop(dbShop, undefined, rank++));
    }
  }

  return (
    <ShopListPageClient
      prefecture={prefecture}
      district={district}
      decodedPrefecture={pref.name}
      decodedDistrict={area.name}
      shops={shops}
      allTherapists={[]}
      therapistTypes={therapistTypes}
      bodyTypes={bodyTypes}
    />
  );
}
