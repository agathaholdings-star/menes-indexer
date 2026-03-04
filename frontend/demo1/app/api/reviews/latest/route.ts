import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "5", 10), 20);

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select(
      "id, score, comment_first_impression, created_at, therapist_id, therapists(name, image_urls, salon_id, salons(name))"
    )
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json([], { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
