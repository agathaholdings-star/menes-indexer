import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const areaId = searchParams.get("area_id");
  const prefectureId = searchParams.get("prefecture_id");
  const ids = searchParams.get("ids");
  const areaSlug = searchParams.get("area_slug");
  const search = searchParams.get("search");
  const random = searchParams.get("random");
  const all = searchParams.get("all") === "true"; // ウィザード用: 未公開サロンも含む
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const cacheHeaders = {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  };

  // Search by name
  if (search) {
    let query = supabaseAdmin
      .from("salons")
      .select("id, name, display_name, access, image_url, slug")
      .eq("is_active", true);
    if (!all) query = query.not("published_at", "is", null);
    const { data } = await query
      .or(`display_name.ilike.%${search}%,name.ilike.%${search}%`)
      .limit(limit);
    return NextResponse.json(data ?? [], cacheHeaders);
  }

  // Fetch by specific IDs
  if (ids) {
    const idArr = ids.split(",").map(Number).filter(Boolean);
    if (idArr.length === 0) return NextResponse.json([]);
    let query = supabaseAdmin
      .from("salons")
      .select("id, name, display_name, slug, image_url, access, description")
      .in("id", idArr)
      .eq("is_active", true);
    if (!all) query = query.not("published_at", "is", null);
    const { data } = await query;
    return NextResponse.json(data ?? [], cacheHeaders);
  }

  // Fetch by prefecture_id (all salons in prefecture via areas -> salon_areas)
  if (prefectureId) {
    // Use inner join: salons -> salon_areas -> areas to get published salons in one query
    let query = supabaseAdmin
      .from("salons")
      .select("id, name, display_name, slug, image_url, access, description, salon_areas!inner(area_id, areas!inner(prefecture_id))")
      .eq("salon_areas.areas.prefecture_id", parseInt(prefectureId, 10))
      .eq("is_active", true);
    if (!all) query = query.not("published_at", "is", null);
    const { data } = await query.limit(limit);
    if (!data || data.length === 0) return NextResponse.json([], cacheHeaders);
    // Deduplicate (a salon can appear in multiple areas)
    const seen = new Set<number>();
    const unique = data.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
    // Attach therapist counts
    const { data: counts } = await supabaseAdmin
      .from("therapists")
      .select("salon_id")
      .in("salon_id", unique.map(s => s.id))
      .eq("status", "active");
    const countMap = new Map<number, number>();
    (counts ?? []).forEach((t: any) => {
      countMap.set(t.salon_id, (countMap.get(t.salon_id) || 0) + 1);
    });
    const enriched = unique.map(({ salon_areas, ...s }) => ({ ...s, therapist_count: countMap.get(s.id) || 0 }));
    return NextResponse.json(enriched, cacheHeaders);
  }

  // Fetch by area_id via inner join
  if (areaId) {
    let query = supabaseAdmin
      .from("salons")
      .select("id, name, display_name, slug, image_url, access, description, salon_areas!inner(area_id)")
      .eq("salon_areas.area_id", parseInt(areaId, 10))
      .eq("is_active", true);
    if (!all) query = query.not("published_at", "is", null);
    const { data } = await query.limit(limit);
    if (!data || data.length === 0) return NextResponse.json([], cacheHeaders);
    const { data: counts } = await supabaseAdmin
      .from("therapists")
      .select("salon_id")
      .in("salon_id", data.map(s => s.id))
      .eq("status", "active");
    const countMap = new Map<number, number>();
    (counts ?? []).forEach((t: any) => {
      countMap.set(t.salon_id, (countMap.get(t.salon_id) || 0) + 1);
    });
    const enriched = data.map(({ salon_areas, ...s }) => ({ ...s, therapist_count: countMap.get(s.id) || 0 }));
    return NextResponse.json(enriched, cacheHeaders);
  }

  // Fetch by area slug via inner join
  if (areaSlug) {
    const { data: area } = await supabaseAdmin
      .from("areas")
      .select("id")
      .eq("slug", areaSlug)
      .single();
    if (!area) return NextResponse.json([], cacheHeaders);
    let query = supabaseAdmin
      .from("salons")
      .select("id, name, display_name, slug, image_url, access, description, salon_areas!inner(area_id)")
      .eq("salon_areas.area_id", area.id)
      .eq("is_active", true);
    if (!all) query = query.not("published_at", "is", null);
    const { data } = await query.limit(limit);
    return NextResponse.json((data ?? []).map(({ salon_areas, ...s }) => s), cacheHeaders);
  }

  // Random or default listing
  let defaultQuery = supabaseAdmin
    .from("salons")
    .select("id, name, display_name, slug, access")
    .eq("is_active", true);
  if (!all) defaultQuery = defaultQuery.not("published_at", "is", null);
  const { data } = await defaultQuery.limit(limit);

  return NextResponse.json(data ?? [], cacheHeaders);
}
