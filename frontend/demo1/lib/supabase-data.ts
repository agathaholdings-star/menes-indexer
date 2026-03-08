import "server-only";
import { supabaseAdmin as supabase } from "./supabase-admin";
import { excludePlaceholderNames } from "./therapist-utils";
import type { Prefecture, Area, Shop } from "@/types/database";

// =============================================================================
// Prefectures
// =============================================================================

export async function getPrefectureBySlug(slug: string): Promise<Prefecture | null> {
  const { data } = await supabase
    .from("prefectures")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
}

export async function getAllPrefectures(): Promise<Prefecture[]> {
  const { data } = await supabase
    .from("prefectures")
    .select("*")
    .order("display_order", { ascending: true });
  return data || [];
}

// =============================================================================
// Areas
// =============================================================================

export async function getAreasByPrefectureId(prefectureId: number): Promise<Area[]> {
  const { data } = await supabase
    .from("areas")
    .select("*")
    .eq("prefecture_id", prefectureId)
    .gt("salon_count", 0)
    .order("search_volume", { ascending: false });
  return data || [];
}

export async function getAreaBySlug(slug: string): Promise<Area | null> {
  const { data } = await supabase
    .from("areas")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
}

export interface NearbyAreaLink {
  name: string;
  slug: string;
  salon_count: number | null;
}

/** nearby_areas(パイプ区切りエリア名)からリンク用データを取得 */
export async function getNearbyAreas(
  nearbyAreasStr: string | null,
  prefectureId: number
): Promise<NearbyAreaLink[]> {
  if (!nearbyAreasStr) return [];
  const names = nearbyAreasStr.split("|").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) return [];

  const { data } = await supabase
    .from("areas")
    .select("name, slug, salon_count")
    .eq("prefecture_id", prefectureId)
    .in("name", names);

  if (!data || data.length === 0) return [];

  // seed順(パイプ区切り順)を維持
  const byName = new Map(data.map((a) => [a.name, a]));
  return names
    .map((n) => byName.get(n))
    .filter((a): a is NearbyAreaLink => a != null);
}

// =============================================================================
// Areas Grouped (for area-grid / area page)
// =============================================================================

export interface AreaItem {
  name: string;
  slug: string;
  prefSlug: string;
  salon_count: number;
}

export interface AreasGrouped {
  [region: string]: {
    [prefName: string]: {
      prefSlug: string;
      areas: AreaItem[];
    };
  };
}

const REGION_ORDER = ["関東", "関西", "東海", "北海道・東北", "北陸・甲信越", "中国・四国", "九州・沖縄"];

export async function getAllAreasGrouped(): Promise<{
  areasGrouped: AreasGrouped;
  popularAreas: (AreaItem & { name: string })[];
  regionOrder: string[];
}> {
  const [prefectures, areasResult] = await Promise.all([
    getAllPrefectures(),
    supabase
      .from("areas")
      .select("id, name, slug, prefecture_id, salon_count")
      .gt("salon_count", 0)
      .order("search_volume", { ascending: false }),
  ]);

  const areas = areasResult.data || [];
  const prefMap = new Map(prefectures.map((p) => [p.id, p]));

  const grouped: AreasGrouped = {};

  for (const pref of prefectures) {
    const region = pref.region || "その他";
    if (!grouped[region]) grouped[region] = {};

    const prefAreas = areas
      .filter((a) => a.prefecture_id === pref.id)
      .map((a) => ({
        name: a.name,
        slug: a.slug,
        prefSlug: pref.slug,
        salon_count: a.salon_count ?? 0,
      }));

    if (prefAreas.length > 0) {
      grouped[region][pref.name] = {
        prefSlug: pref.slug,
        areas: prefAreas,
      };
    }
  }

  // Popular areas: top 12 by salon_count
  const allAreaItems: (AreaItem & { name: string })[] = areas
    .map((a) => {
      const pref = prefMap.get(a.prefecture_id);
      return {
        name: a.name,
        slug: a.slug,
        prefSlug: pref?.slug || "",
        salon_count: a.salon_count ?? 0,
      };
    })
    .sort((a, b) => b.salon_count - a.salon_count)
    .slice(0, 12);

  const regionOrder = REGION_ORDER.filter((r) => grouped[r]);

  return { areasGrouped: grouped, popularAreas: allAreaItems, regionOrder };
}

// =============================================================================
// Shops
// =============================================================================

export async function getShopsByAreaSlug(areaSlug: string): Promise<Shop[]> {
  // area_slug → area_id → salon_areas → salon_id → salons
  const area = await getAreaBySlug(areaSlug);
  if (!area) return [];

  // salon_areasからsalon_idを取得
  const { data: shopAreaRows } = await supabase
    .from("salon_areas")
    .select("salon_id, display_order")
    .eq("area_id", area.id)
    .order("display_order", { ascending: true });

  if (!shopAreaRows || shopAreaRows.length === 0) return [];

  const shopIds = shopAreaRows.map((sa) => sa.salon_id);

  // salonsを取得
  const { data: shops } = await supabase
    .from("salons")
    .select("*")
    .in("id", shopIds)
    .eq("is_active", true);

  if (!shops) return [];

  // display_order順にソート
  const orderMap = new Map(shopAreaRows.map((sa) => [sa.salon_id, sa.display_order]));
  return shops.sort((a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0));
}

export async function getShopById(id: number): Promise<Shop | null> {
  const { data } = await supabase
    .from("salons")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const { data } = await supabase
    .from("salons")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
}

// =============================================================================
// Shop Area Info (for breadcrumbs)
// =============================================================================

export async function getShopAreaInfo(shopId: number): Promise<{
  areaName: string;
  areaSlug: string;
  prefName: string;
  prefSlug: string;
} | null> {
  let { data: shopArea } = await supabase
    .from("salon_areas")
    .select("area_id")
    .eq("salon_id", shopId)
    .eq("is_primary", true)
    .limit(1)
    .single();

  if (!shopArea) {
    // fallback: any area
    const { data: anyArea } = await supabase
      .from("salon_areas")
      .select("area_id")
      .eq("salon_id", shopId)
      .limit(1)
      .single();
    if (!anyArea) return null;
    shopArea = anyArea;
  }

  const { data: area } = await supabase
    .from("areas")
    .select("name, slug, prefecture_id")
    .eq("id", shopArea.area_id)
    .single();

  if (!area) return null;

  const { data: pref } = await supabase
    .from("prefectures")
    .select("name, slug")
    .eq("id", area.prefecture_id)
    .single();

  if (!pref) return null;

  return {
    areaName: area.name,
    areaSlug: area.slug,
    prefName: pref.name,
    prefSlug: pref.slug,
  };
}

// =============================================================================
// Therapists
// =============================================================================

export async function getTherapistsByShopId(shopId: number) {
  const { data } = await supabase
    .from("therapists")
    .select("*")
    .eq("salon_id", shopId)
    .eq("status", "active")
    .neq("name", "THERAPISTセラピスト")
    .order("id", { ascending: true });
  return data || [];
}

// =============================================================================
// 統計用
// =============================================================================

export async function getAreaShopCount(areaId: number): Promise<number> {
  const { count } = await supabase
    .from("salon_areas")
    .select("*", { count: "exact", head: true })
    .eq("area_id", areaId);
  return count || 0;
}

/** Get therapist counts for multiple salon IDs in one query */
export async function getTherapistCountsBySalonIds(
  salonIds: number[]
): Promise<Map<number, number>> {
  if (salonIds.length === 0) return new Map();
  const { data } = await excludePlaceholderNames(
    supabase
      .from("therapists")
      .select("salon_id")
      .in("salon_id", salonIds)
      .eq("status", "active")
  );
  const counts = new Map<number, number>();
  if (data) {
    for (const row of data) {
      counts.set(row.salon_id, (counts.get(row.salon_id) || 0) + 1);
    }
  }
  return counts;
}

// =============================================================================
// ランキング
// =============================================================================

export interface SalonRankingStats {
  salon_id: number;
  review_count: number;
  avg_score: number;
  bayesian_score: number;
  therapist_count: number;
  ranking_score: number;
  latest_review_at: string | null;
}

/** エリア内サロンをランキングスコア順で取得 */
export async function getRankedSalonsByArea(
  areaId: number,
  limit = 200
): Promise<SalonRankingStats[]> {
  const { data, error } = await supabase.rpc("get_ranked_salons_by_area", {
    p_area_id: areaId,
    p_limit: limit,
  });
  if (error) {
    console.error("getRankedSalonsByArea error:", error);
    return [];
  }
  return (data as SalonRankingStats[]) || [];
}

/** 指定サロンIDの口コミ統計をバッチ取得 */
export async function getSalonReviewStatsBatch(
  salonIds: number[]
): Promise<Map<number, { review_count: number; avg_score: number; therapist_count: number }>> {
  const result = new Map<number, { review_count: number; avg_score: number; therapist_count: number }>();
  if (salonIds.length === 0) return result;

  const { data, error } = await supabase.rpc("get_salon_review_stats_batch", {
    p_salon_ids: salonIds,
  });
  if (error) {
    console.error("getSalonReviewStatsBatch error:", error);
    return result;
  }
  if (data) {
    for (const row of data as { salon_id: number; review_count: number; avg_score: number; therapist_count: number }[]) {
      result.set(row.salon_id, {
        review_count: row.review_count,
        avg_score: Number(row.avg_score),
        therapist_count: row.therapist_count,
      });
    }
  }
  return result;
}

// =============================================================================
// 最新口コミプレビュー（サロンカード用）
// =============================================================================

export interface SalonLatestReview {
  salon_id: number;
  comment_first_impression: string;
  nickname: string | null;
  created_at: string;
}

/**
 * 指定サロンIDリストの最新承認済み口コミ1件ずつをバッチ取得。
 * DISTINCT ON (shop_id) + ORDER BY created_at DESC で N+1 なしの1クエリ。
 */
export async function getLatestReviewsBySalonIds(
  salonIds: number[]
): Promise<Map<number, SalonLatestReview>> {
  const result = new Map<number, SalonLatestReview>();
  if (salonIds.length === 0) return result;

  // Supabase JS client doesn't support DISTINCT ON, so use raw SQL via rpc
  // Instead, fetch all approved reviews for these salons ordered by created_at desc,
  // then pick the first per salon in JS. Limited to avoid huge payloads.
  const { data, error } = await supabase
    .from("reviews")
    .select("shop_id, comment_first_impression, created_at, profiles(nickname)")
    .in("shop_id", salonIds)
    .eq("moderation_status", "approved")
    .not("comment_first_impression", "is", null)
    .order("created_at", { ascending: false })
    .limit(salonIds.length * 3); // fetch a few per salon, pick first

  if (error) {
    console.error("getLatestReviewsBySalonIds error:", error);
    return result;
  }

  if (data) {
    for (const row of data as Array<{
      shop_id: number;
      comment_first_impression: string;
      created_at: string;
      profiles: { nickname: string | null } | null;
    }>) {
      // Only keep the first (latest) per salon
      if (!result.has(row.shop_id)) {
        result.set(row.shop_id, {
          salon_id: row.shop_id,
          comment_first_impression: row.comment_first_impression,
          nickname: row.profiles?.nickname ?? null,
          created_at: row.created_at,
        });
      }
    }
  }

  return result;
}
