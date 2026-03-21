import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET() {
  const [salonCount, areaCount, prefCount] = await Promise.all([
    supabaseAdmin
      .from("salons")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .not("published_at", "is", null),
    supabaseAdmin
      .from("areas")
      .select("*", { count: "exact", head: true })
      .gt("salon_count", 0),
    supabaseAdmin
      .from("prefectures")
      .select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json(
    {
      salonCount: salonCount.count ?? 0,
      areaCount: areaCount.count ?? 0,
      prefCount: prefCount.count ?? 0,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    }
  );
}
