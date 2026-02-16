import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const prefectureId = searchParams.get("prefecture_id");

  let query = supabaseAdmin
    .from("areas")
    .select("id, prefecture_id, name, slug, salon_count, search_volume")
    .gt("salon_count", 0)
    .order("search_volume", { ascending: false });

  if (prefectureId) {
    query = query.eq("prefecture_id", parseInt(prefectureId, 10));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
