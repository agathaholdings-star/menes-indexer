import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

// Placeholder name exclusion filters (server-side mirror of therapist-utils.ts)
function applyPlaceholderFilters(query: any) {
  return query
    .not("name", "ilike", "%プロフィール%")
    .not("name", "ilike", "%profile%")
    .not("name", "ilike", "%THERAPIST%")
    .not("name", "ilike", "%セラピスト%")
    .not("name", "ilike", "%キャスト紹介%")
    .not("name", "ilike", "%在籍表%")
    .not("name", "ilike", "%staff%")
    .not("name", "ilike", "%スタッフ/%")
    .not("name", "ilike", "%ランキング%")
    .not("name", "ilike", "%金のエステ%")
    .not("name", "ilike", "%神のエステ%")
    .not("name", "ilike", "%小悪魔%")
    .not("name", "eq", "---");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const salonId = searchParams.get("salon_id");
  const sort = searchParams.get("sort") || "newest";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 50);
  const areaSlug = searchParams.get("area_slug");
  const district = searchParams.get("district");
  const ids = searchParams.get("ids"); // カンマ区切りのセラピストID

  // Fetch therapists for a specific salon
  if (salonId) {
    let q = supabaseAdmin
      .from("therapists")
      .select("id, name, age, image_urls, salon_id")
      .eq("salon_id", parseInt(salonId, 10))
      .eq("status", "active");
    q = applyPlaceholderFilters(q);
    q = q.order("name").limit(limit);
    const { data } = await q;
    return NextResponse.json(data ?? []);
  }

  // Area filter: resolve salon IDs
  let shopIds: number[] | null = null;
  if (areaSlug && areaSlug !== "all") {
    const { data: pref } = await supabaseAdmin
      .from("prefectures")
      .select("id")
      .eq("slug", areaSlug)
      .single();
    if (pref) {
      let areaQuery = supabaseAdmin.from("areas").select("id").eq("prefecture_id", pref.id);
      if (district && district !== "all") {
        areaQuery = areaQuery.eq("name", district);
      }
      const { data: areaData } = await areaQuery;
      if (areaData && areaData.length > 0) {
        const areaIds = areaData.map((a) => a.id);
        const { data: saData } = await supabaseAdmin
          .from("salon_areas")
          .select("salon_id")
          .in("area_id", areaIds);
        shopIds = [...new Set((saData || []).map((sa) => Number(sa.salon_id)))];
      } else {
        shopIds = [];
      }
    }
    if (shopIds && shopIds.length === 0) {
      return NextResponse.json([]);
    }
  }

  // Main query
  let q = supabaseAdmin
    .from("therapists")
    .select("id, name, age, image_urls, salon_id, salons(name, display_name, access)")
    .eq("status", "active");

  q = applyPlaceholderFilters(q);

  if (shopIds) {
    q = q.in("salon_id", shopIds);
  }

  if (ids) {
    const idList = ids.split(",").map(Number).filter(Boolean);
    if (idList.length > 0) {
      q = q.in("id", idList);
    }
  }

  q = q.order("created_at", { ascending: false }).limit(limit);

  const { data } = await q;
  return NextResponse.json(data ?? []);
}
