import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 50);

  const { data, count } = await supabaseAdmin
    .from("reviews")
    .select("id, therapist_id, looks_type, body_type, service_level, score", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .limit(limit);

  return NextResponse.json({ data: data ?? [], count: count ?? 0 });
}
