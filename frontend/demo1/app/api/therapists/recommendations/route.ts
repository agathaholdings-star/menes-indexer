import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

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
  const excludeId = searchParams.get("exclude_id");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

  let q = supabaseAdmin
    .from("therapists")
    .select("id, name, age, image_urls, salon_id, salons(name, display_name)")
    .eq("status", "active");

  q = applyPlaceholderFilters(q);

  if (salonId) {
    q = q.eq("salon_id", parseInt(salonId, 10));
  }
  if (excludeId) {
    q = q.neq("id", parseInt(excludeId, 10));
  }

  const { data } = await q
    .order("created_at", { ascending: false })
    .limit(500);

  return NextResponse.json((data ?? []).slice(0, limit));
}
