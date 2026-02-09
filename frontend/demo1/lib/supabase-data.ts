import { supabase } from "./supabase";
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

// =============================================================================
// Shops
// =============================================================================

export async function getShopsByAreaSlug(areaSlug: string): Promise<Shop[]> {
  // area_slug → area_id → shop_areas → shop_id → shops
  const area = await getAreaBySlug(areaSlug);
  if (!area) return [];

  // shop_areasからshop_idを取得
  const { data: shopAreaRows } = await supabase
    .from("shop_areas")
    .select("shop_id, display_order")
    .eq("area_id", area.id)
    .order("display_order", { ascending: true });

  if (!shopAreaRows || shopAreaRows.length === 0) return [];

  const shopIds = shopAreaRows.map((sa) => sa.shop_id);

  // shopsを取得
  const { data: shops } = await supabase
    .from("shops")
    .select("*")
    .in("id", shopIds)
    .eq("is_active", true);

  if (!shops) return [];

  // display_order順にソート
  const orderMap = new Map(shopAreaRows.map((sa) => [sa.shop_id, sa.display_order]));
  return shops.sort((a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0));
}

export async function getShopById(id: number): Promise<Shop | null> {
  const { data } = await supabase
    .from("shops")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const { data } = await supabase
    .from("shops")
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
    .from("shop_areas")
    .select("area_id")
    .eq("shop_id", shopId)
    .eq("is_primary", true)
    .limit(1)
    .single();

  if (!shopArea) {
    // fallback: any area
    const { data: anyArea } = await supabase
      .from("shop_areas")
      .select("area_id")
      .eq("shop_id", shopId)
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
    .eq("shop_id", shopId)
    .eq("status", "active")
    .order("id", { ascending: true });
  return data || [];
}

// =============================================================================
// 統計用
// =============================================================================

export async function getAreaShopCount(areaId: number): Promise<number> {
  const { count } = await supabase
    .from("shop_areas")
    .select("*", { count: "exact", head: true })
    .eq("area_id", areaId);
  return count || 0;
}
