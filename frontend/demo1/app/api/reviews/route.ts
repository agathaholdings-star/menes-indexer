import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "1000", 10), 10000);

  const { data, count } = await supabaseAdmin
    .from("reviews")
    .select("id, therapist_id, looks_type_id, body_type_id, service_level_id, score", {
      count: "exact",
    })
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  return NextResponse.json({ data: data ?? [], count: count ?? 0 });
}
