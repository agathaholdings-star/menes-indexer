import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

const MAX_PER_CATEGORY = 3;

// Placeholder name exclusion (mirrors therapists/route.ts)
function isPlaceholderName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("プロフィール") ||
    lower.includes("profile") ||
    lower.includes("therapist") ||
    lower.includes("セラピスト") ||
    lower.includes("キャスト紹介") ||
    lower.includes("在籍表") ||
    lower.includes("staff") ||
    lower.includes("スタッフ/") ||
    lower.includes("ランキング") ||
    lower.includes("金のエステ") ||
    lower.includes("神のエステ") ||
    lower.includes("小悪魔") ||
    name === "---"
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  // Minimum length: 2 chars for Japanese (most chars are multi-byte), 3 for ASCII
  const isJapanese = /[^\x00-\x7F]/.test(q);
  const minLength = isJapanese ? 2 : 3;

  if (q.length < minLength) {
    return NextResponse.json({ therapists: [], salons: [], areas: [] });
  }

  // Sanitize: escape special Postgres characters for ilike
  const escaped = q.replace(/[%_\\]/g, (ch) => `\\${ch}`);
  const pattern = `%${escaped}%`;

  // Run all three queries in parallel
  const [therapistRes, salonRes, areaRes] = await Promise.all([
    supabaseAdmin
      .from("therapists")
      .select("id, name, salon_id, salons(name, display_name)")
      .eq("status", "active")
      .ilike("name", pattern)
      .limit(MAX_PER_CATEGORY + 5), // fetch extra to filter placeholders

    supabaseAdmin
      .from("salons")
      .select("id, name, display_name, slug")
      .or(`name.ilike.${pattern},display_name.ilike.${pattern}`)
      .not("published_at", "is", null)
      .limit(MAX_PER_CATEGORY),

    supabaseAdmin
      .from("areas")
      .select("id, name, slug, prefecture_id, prefectures(name, slug)")
      .ilike("name", pattern)
      .gt("salon_count", 0)
      .limit(MAX_PER_CATEGORY),
  ]);

  // Filter placeholder therapist names and limit
  const therapists = (therapistRes.data || [])
    .filter((t: any) => !isPlaceholderName(t.name))
    .slice(0, MAX_PER_CATEGORY)
    .map((t: any) => ({
      id: t.id,
      name: t.name,
      salonName: t.salons?.display_name || t.salons?.name || null,
    }));

  const salons = (salonRes.data || []).map((s: any) => ({
    id: s.id,
    name: s.display_name || s.name,
    slug: s.slug,
  }));

  const areas = (areaRes.data || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    prefectureName: a.prefectures?.name || null,
    prefectureSlug: a.prefectures?.slug || null,
  }));

  return NextResponse.json({ therapists, salons, areas });
}
