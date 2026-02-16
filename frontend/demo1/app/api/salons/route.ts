import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const areaId = searchParams.get("area_id");
  const ids = searchParams.get("ids");
  const areaSlug = searchParams.get("area_slug");
  const search = searchParams.get("search");
  const random = searchParams.get("random");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 50);

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

  // Fetch by area_id via salon_areas
  if (areaId) {
    const { data: shopAreaRows } = await supabaseAdmin
      .from("salon_areas")
      .select("salon_id")
      .eq("area_id", parseInt(areaId, 10))
      .order("display_order", { ascending: true })
      .limit(limit);
    if (!shopAreaRows || shopAreaRows.length === 0) return NextResponse.json([]);
    const shopIds = shopAreaRows.map((sa) => sa.salon_id);
    const { data } = await supabaseAdmin
      .from("salons")
      .select("id, name, display_name, slug, image_url, access, description")
      .in("id", shopIds)
      .eq("is_active", true);
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
    const { data: shopAreaRows } = await supabaseAdmin
      .from("salon_areas")
      .select("salon_id, display_order")
      .eq("area_id", area.id)
      .order("display_order", { ascending: true })
      .limit(limit);
    if (!shopAreaRows || shopAreaRows.length === 0) return NextResponse.json([]);
    const shopIds = shopAreaRows.map((sa) => sa.salon_id);
    const { data } = await supabaseAdmin
      .from("salons")
      .select("id, name, display_name, slug, image_url, access, description")
      .in("id", shopIds)
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
