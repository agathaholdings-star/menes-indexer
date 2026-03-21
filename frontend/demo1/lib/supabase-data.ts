import "server-only";
import { supabaseAdmin as supabase } from "./supabase-admin";
import { excludePlaceholderNames, cleanTherapistName, isPlaceholderName } from "./therapist-utils";
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

  // Popular areas: 手動キュレーション（主要都市の人気エリア）
  const CURATED_AREAS: { prefSlug: string; slug: string }[] = [
    // 東京
    { prefSlug: "tokyo", slug: "shinjuku" },
    { prefSlug: "tokyo", slug: "ikebukuro" },
    { prefSlug: "tokyo", slug: "ebisu" },
    { prefSlug: "tokyo", slug: "shibuya" },
    { prefSlug: "tokyo", slug: "gotanda" },
    { prefSlug: "tokyo", slug: "shinbashi" },
    // 神奈川
    { prefSlug: "kanagawa", slug: "yokohama" },
    { prefSlug: "kanagawa", slug: "kawasaki" },
    // 大阪
    { prefSlug: "osaka", slug: "nipponbashi" },
    { prefSlug: "osaka", slug: "umeda" },
    { prefSlug: "osaka", slug: "osakaminami" },
    // 愛知
    { prefSlug: "aichi", slug: "nagoya" },
    { prefSlug: "aichi", slug: "sakae" },
    // 福岡
    { prefSlug: "fukuoka", slug: "hakata" },
    { prefSlug: "fukuoka", slug: "nakasu" },
    // 北海道
    { prefSlug: "hokkaido", slug: "hokkaido-sapporo-city" },
  ];

  const areaLookup = new Map(
    areas.map((a) => {
      const pref = prefMap.get(a.prefecture_id);
      return [`${pref?.slug}/${a.slug}`, { name: a.name, slug: a.slug, prefSlug: pref?.slug || "", salon_count: a.salon_count ?? 0 }];
    })
  );

  const allAreaItems: (AreaItem & { name: string })[] = CURATED_AREAS
    .map((c) => areaLookup.get(`${c.prefSlug}/${c.slug}`))
    .filter((a): a is AreaItem & { name: string } => a !== undefined);

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
  const { data: salonAreaRows } = await supabase
    .from("salon_areas")
    .select("salon_id, display_order")
    .eq("area_id", area.id)
    .order("display_order", { ascending: true });

  if (!salonAreaRows || salonAreaRows.length === 0) return [];

  const salonIds = salonAreaRows.map((sa) => sa.salon_id);

  // salonsを取得
  const { data: shops } = await supabase
    .from("salons")
    .select("*")
    .in("id", salonIds)
    .eq("is_active", true)
    .not("published_at", "is", null);

  if (!shops) return [];

  // display_order順にソート
  const orderMap = new Map(salonAreaRows.map((sa) => [sa.salon_id, sa.display_order]));
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

export async function getSalonAreaInfo(salonId: number): Promise<{
  areaName: string;
  areaSlug: string;
  prefName: string;
  prefSlug: string;
} | null> {
  // Single query with nested joins: salon_areas → areas → prefectures
  let { data } = await supabase
    .from("salon_areas")
    .select("area_id, areas(name, slug, prefecture_id, prefectures(name, slug))")
    .eq("salon_id", salonId)
    .eq("is_primary", true)
    .limit(1)
    .single();

  if (!data) {
    // fallback: any area
    const { data: anyArea } = await supabase
      .from("salon_areas")
      .select("area_id, areas(name, slug, prefecture_id, prefectures(name, slug))")
      .eq("salon_id", salonId)
      .limit(1)
      .single();
    if (!anyArea) return null;
    data = anyArea;
  }

  const area = data.areas as any;
  if (!area) return null;

  const pref = area.prefectures as any;
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

export async function getTherapistsBySalonId(salonId: number) {
  const { data } = await supabase
    .from("therapists")
    .select("*")
    .eq("salon_id", salonId)
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
// Sidebar Data (server-side prefetch to eliminate client-side API calls)
// =============================================================================

export interface SidebarTherapist {
  id: number;
  name: string;
  image_url: string | null;
  shop_name: string;
}

export interface SidebarShop {
  id: number;
  name: string;
  display_name: string | null;
  slug: string | null;
  access: string | null;
}

export async function getSidebarData(): Promise<{
  therapists: SidebarTherapist[];
  salons: SidebarShop[];
}> {
  const [{ data: rawTherapists }, { data: rawSalons }] = await Promise.all([
    supabase
      .from("therapists")
      .select("id, name, image_urls, salons(name, display_name)")
      .eq("status", "active")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(30),
    supabase
      .from("salons")
      .select("id, name, display_name, slug, access")
      .eq("is_active", true)
      .not("published_at", "is", null)
      .order("review_count", { ascending: false })
      .limit(5),
  ]);

  const therapists = (rawTherapists ?? [])
    .filter((t: any) => {
      if (!t.name || isPlaceholderName(t.name)) return false;
      const cleaned = cleanTherapistName(t.name);
      if (cleaned.length > 15) return false;
      const shop = t.salons as { name: string; display_name: string | null } | null;
      if (shop && (cleaned === shop.name || cleaned === shop.display_name)) return false;
      return true;
    })
    .slice(0, 5)
    .map((t: any) => {
      const imgs = t.image_urls as string[] | null;
      const shop = t.salons as { name: string; display_name: string | null } | null;
      return {
        id: Number(t.id),
        name: cleanTherapistName(t.name),
        image_url: imgs?.[0] || null,
        shop_name: shop?.display_name || shop?.name || "",
      };
    });

  const salons = (rawSalons ?? []).map((s: any) => ({
    id: Number(s.id),
    name: s.name as string,
    display_name: s.display_name as string | null,
    slug: s.slug as string | null,
    access: s.access as string | null,
  }));

  return { therapists, salons };
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
