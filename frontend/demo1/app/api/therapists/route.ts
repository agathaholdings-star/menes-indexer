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
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
  const areaSlug = searchParams.get("area_slug");
  const district = searchParams.get("district");
  const ids = searchParams.get("ids"); // カンマ区切りのセラピストID
  const name = searchParams.get("name"); // セラピスト名検索

  // レビューフィルタパラメータ
  const looksTypes = searchParams.get("looks_types"); // カンマ区切り: "1,3,7"
  const bodyTypes = searchParams.get("body_types");   // カンマ区切り: "1,3"
  const serviceLevels = searchParams.get("service_levels"); // カンマ区切り: "2,3"
  const minScore = searchParams.get("min_score"); // 最低スコア: "70"
  const withStats = searchParams.get("with_stats"); // "1" でレビュー統計を含める

  // Fetch therapists for a specific salon
  if (salonId) {
    let q = supabaseAdmin
      .from("therapists")
      .select("id, name, age, image_urls, salon_id")
      .eq("salon_id", parseInt(salonId, 10))
      .eq("status", "active");
    q = applyPlaceholderFilters(q);
    if (name) {
      q = q.ilike("name", `%${name}%`);
    }
    q = q.order("name").range(offset, offset + limit - 1);
    const { data } = await q;
    return NextResponse.json(data ?? []);
  }

  // レビューベースのフィルタリング（サーバーサイド）
  let reviewFilteredIds: number[] | null = null;
  let reviewStatsMap: Map<number, { avg_score: number; count: number; looks: string[]; bodies: string[]; services: string[] }> | null = null;

  const needsReviewFilter = looksTypes || bodyTypes || serviceLevels || minScore;

  if (needsReviewFilter || withStats === "1") {
    // レビュー集計をサーバーサイドで実行
    let revQuery = supabaseAdmin
      .from("reviews")
      .select("therapist_id, looks_type_id, body_type_id, service_level_id, score")
      .eq("moderation_status", "approved");

    const { data: revData } = await revQuery;

    if (revData) {
      const aggMap = new Map<number, { total_score: number; count: number; looks: Set<string>; bodies: Set<string>; services: Set<string> }>();

      for (const r of revData) {
        const tid = Number(r.therapist_id);
        if (!aggMap.has(tid)) {
          aggMap.set(tid, { total_score: 0, count: 0, looks: new Set(), bodies: new Set(), services: new Set() });
        }
        const agg = aggMap.get(tid)!;
        agg.count++;
        agg.total_score += (r.score || 0);
        if (r.looks_type_id) agg.looks.add(String(r.looks_type_id));
        if (r.body_type_id) agg.bodies.add(String(r.body_type_id));
        if (r.service_level_id) agg.services.add(String(r.service_level_id));
      }

      // フィルタ適用
      const looksSet = looksTypes ? new Set(looksTypes.split(",")) : null;
      const bodySet = bodyTypes ? new Set(bodyTypes.split(",")) : null;
      const serviceSet = serviceLevels ? new Set(serviceLevels.split(",")) : null;
      const minScoreVal = minScore ? parseInt(minScore, 10) : null;

      reviewFilteredIds = [];
      reviewStatsMap = new Map();

      for (const [tid, agg] of aggMap) {
        const avgScore = Math.round(agg.total_score / agg.count);

        if (looksSet && ![...agg.looks].some(l => looksSet.has(l))) continue;
        if (bodySet && ![...agg.bodies].some(b => bodySet.has(b))) continue;
        if (serviceSet && ![...agg.services].some(s => serviceSet.has(s))) continue;
        if (minScoreVal && avgScore < minScoreVal) continue;

        reviewFilteredIds.push(tid);
        reviewStatsMap.set(tid, {
          avg_score: avgScore,
          count: agg.count,
          looks: [...agg.looks],
          bodies: [...agg.bodies],
          services: [...agg.services],
        });
      }

      if (needsReviewFilter && reviewFilteredIds.length === 0) {
        return NextResponse.json([], {
          headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
        });
      }
    }
  }

  // Area filter: resolve salon IDs
  let salonIds: number[] | null = null;
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
        salonIds = [...new Set((saData || []).map((sa) => Number(sa.salon_id)))];
      } else {
        salonIds = [];
      }
    }
    if (salonIds && salonIds.length === 0) {
      return NextResponse.json([]);
    }
  }

  // Main query
  let q = supabaseAdmin
    .from("therapists")
    .select("id, name, age, image_urls, salon_id, review_count, avg_score, salons(name, display_name, access)")
    .eq("status", "active");

  q = applyPlaceholderFilters(q);

  if (name) {
    q = q.ilike("name", `%${name}%`);
  }

  if (salonIds) {
    q = q.in("salon_id", salonIds);
  }

  // レビューフィルタによるID絞り込み
  if (reviewFilteredIds) {
    q = q.in("id", reviewFilteredIds);
  }

  if (ids) {
    const idList = ids.split(",").map(Number).filter(Boolean);
    if (idList.length > 0) {
      q = q.in("id", idList);
    }
  }

  q = q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data } = await q;

  // レビュー統計をレスポンスに付加
  const result = (data ?? []).map((t: any) => {
    const stats = reviewStatsMap?.get(Number(t.id));
    return {
      ...t,
      review_stats: stats || null,
    };
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
