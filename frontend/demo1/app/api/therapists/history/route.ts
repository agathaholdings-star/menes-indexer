import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

// 同一person_idを持つセラピストの在籍履歴を取得
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const therapistId = searchParams.get("therapist_id");

  if (!therapistId) {
    return NextResponse.json({ error: "therapist_id required" }, { status: 400 });
  }

  // まず対象セラピストの person_id を取得
  const { data: target } = await supabaseAdmin
    .from("therapists")
    .select("id, person_id")
    .eq("id", Number(therapistId))
    .single();

  if (!target || !target.person_id) {
    return NextResponse.json([]);
  }

  // 同じ person_id を持つ全レコードを取得
  const { data: siblings } = await supabaseAdmin
    .from("therapists")
    .select("id, name, age, salon_id, image_urls, status, created_at, salons(name, display_name)")
    .eq("person_id", target.person_id)
    .neq("id", Number(therapistId))
    .order("created_at", { ascending: false });

  if (!siblings) {
    return NextResponse.json([]);
  }

  const results = siblings.map((t: any) => {
    const imgs = t.image_urls as string[] | null;
    const shop = t.salons as unknown as { name: string; display_name: string | null } | null;
    return {
      id: Number(t.id),
      name: t.name?.replace(/\s*\(\d{2}\)$/, "") || "",
      age: t.age,
      image_url: imgs?.[0] || null,
      salon_id: Number(t.salon_id),
      shop_name: shop?.display_name || shop?.name || "",
      status: t.status,
      created_at: t.created_at,
    };
  });

  return NextResponse.json(results);
}
