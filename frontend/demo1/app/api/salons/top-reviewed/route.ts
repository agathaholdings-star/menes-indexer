import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || "8"), 20);

  const supabase = await createSupabaseServer();

  // 口コミ数が多いサロンを取得
  const { data, error } = await supabase
    .from("salons")
    .select(`
      id,
      name,
      display_name,
      access,
      therapist_count,
      review_count,
      salon_areas!inner(areas!inner(name))
    `)
    .gt("review_count", 0)
    .not("published_at", "is", null)
    .order("review_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("top-reviewed salons error:", error);
    return NextResponse.json([]);
  }

  const salons = (data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    display_name: s.display_name,
    access: s.access,
    review_count: s.review_count || 0,
    therapist_count: s.therapist_count || 0,
    area_name: s.salon_areas?.[0]?.areas?.name || null,
  }));

  return NextResponse.json(salons, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" }
  });
}
