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
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  // Search by name
  if (search) {
    const { data } = await supabaseAdmin
      .from("salons")
      .select("id, name, display_name, access, image_url, slug")
      .eq("is_active", true)
      .or(`display_name.ilike.%${search}%,name.ilike.%${search}%`)
      .limit(limit);
    return NextResponse.json(data ?? []);
  }

  // Fetch by specific IDs
  if (ids) {
    const idArr = ids.split(",").map(Number).filter(Boolean);
    if (idArr.length === 0) return NextResponse.json([]);
    const { data } = await supabaseAdmin
      .from("salons")
      .select("id, name, display_name, slug, image_url, access, description")
      .in("id", idArr)
      .eq("is_active", true);
    return NextResponse.json(data ?? []);
  }

  // Fetch by prefecture_id (all salons in prefecture via areas -> salon_areas)
  if (prefectureId) {
    const { data: areaRows } = await supabaseAdmin
      .from("areas")
      .select("id")
      .eq("prefecture_id", parseInt(prefectureId, 10));
    if (!areaRows || areaRows.length === 0) return NextResponse.json([]);
    const areaIds = areaRows.map(a => a.id);
    const { data: salonAreaRows } = await supabaseAdmin
      .from("salon_areas")
      .select("salon_id")
      .in("area_id", areaIds)
      .limit(limit);
    if (!salonAreaRows || salonAreaRows.length === 0) return NextResponse.json([]);
    const salonIds = [...new Set(salonAreaRows.map(sa => sa.salon_id))];
    const { data } = await supabaseAdmin
      .from("salons")
      .select("id, name, display_name, slug, image_url, access, description")
      .in("id", salonIds)
      .eq("is_active", true);
    if (data && data.length > 0) {
      const { data: counts } = await supabaseAdmin
        .from("therapists")
        .select("salon_id")
        .in("salon_id", data.map(s => s.id))
        .eq("status", "active");
      const countMap = new Map<number, number>();
      (counts ?? []).forEach((t: any) => {
        countMap.set(t.salon_id, (countMap.get(t.salon_id) || 0) + 1);
      });
      const enriched = data.map(s => ({ ...s, therapist_count: countMap.get(s.id) || 0 }));
      return NextResponse.json(enriched);
    }
    return NextResponse.json(data ?? []);
  }

  // Fetch by area_id via salon_areas
  if (areaId) {
    const { data: salonAreaRows } = await supabaseAdmin
      .from("salon_areas")
      .select("salon_id")
      .eq("area_id", parseInt(areaId, 10))
      .order("display_order", { ascending: true })
      .limit(limit);
    if (!salonAreaRows || salonAreaRows.length === 0) return NextResponse.json([]);
    const salonIds = salonAreaRows.map((sa) => sa.salon_id);
    const { data } = await supabaseAdmin
      .from("salons")
      .select("id, name, display_name, slug, image_url, access, description")
      .in("id", salonIds)
      .eq("is_active", true);
    // Attach therapist_count per salon
    if (data && data.length > 0) {
      const { data: counts } = await supabaseAdmin
        .from("therapists")
        .select("salon_id")
        .in("salon_id", data.map(s => s.id))
        .eq("status", "active");
      const countMap = new Map<number, number>();
      (counts ?? []).forEach((t: any) => {
        countMap.set(t.salon_id, (countMap.get(t.salon_id) || 0) + 1);
      });
      const enriched = data.map(s => ({ ...s, therapist_count: countMap.get(s.id) || 0 }));
      return NextResponse.json(enriched);
    }
    return NextResponse.json(data ?? []);
  }

  // Fetch by area slug via salon_areas
  if (areaSlug) {
    const { data: area } = await supabaseAdmin
      .from("areas")
      .select("id")
      .eq("slug", areaSlug)
      .single();
    if (!area) return NextResponse.json([]);
    const { data: salonAreaRows } = await supabaseAdmin
      .from("salon_areas")
      .select("salon_id, display_order")
      .eq("area_id", area.id)
      .order("display_order", { ascending: true })
      .limit(limit);
    if (!salonAreaRows || salonAreaRows.length === 0) return NextResponse.json([]);
    const salonIds = salonAreaRows.map((sa) => sa.salon_id);
    const { data } = await supabaseAdmin
      .from("salons")
      .select("id, name, display_name, slug, image_url, access, description")
      .in("id", salonIds)
      .eq("is_active", true);
    return NextResponse.json(data ?? []);
  }

  // Random or default listing
  const { data } = await supabaseAdmin
    .from("salons")
    .select("id, name, display_name, slug, access")
    .eq("is_active", true)
    .limit(limit);

  return NextResponse.json(data ?? []);
}
