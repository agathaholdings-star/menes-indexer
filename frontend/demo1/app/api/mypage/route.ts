import { supabaseAdmin } from "@/lib/supabase-admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch profile, favorites count, user reviews, SKR reviews, preference data in parallel
  const [profileRes, favCountRes, userReviewsRes, skrReviewsRes, prefDataRes, feedbackRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("nickname, membership_type, monthly_review_count, total_review_count, view_permission_until")
      .eq("id", user.id)
      .single(),
    supabaseAdmin
      .from("favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabaseAdmin
      .from("reviews")
      .select("id, score, service_level_id, moderation_status, created_at, therapist_id, salon_id, therapists(name), salons(name, display_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("reviews")
      .select("id, therapist_id, score, service_level_id, comment_service, created_at, therapists(name, image_urls), salons(name, display_name)")
      .in("service_level_id", [2, 3])
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: false })
      .limit(20),
    // 嗜好マップ用: ユーザーの承認済みレビューから集計
    supabaseAdmin
      .from("reviews")
      .select("looks_type_id, body_type_id, service_level_id, param_conversation, param_distance, param_technique, param_personality")
      .eq("user_id", user.id)
      .eq("moderation_status", "approved"),
    // 反響統計: ユーザーの承認済みレビューの閲覧数・参考になった・REAL/FAKE集計
    supabaseAdmin
      .from("reviews")
      .select("view_count, helpful_count, real_count, fake_count")
      .eq("user_id", user.id)
      .eq("moderation_status", "approved"),
  ]);

  const profile = profileRes.data;
  const favoriteCount = favCountRes.count || 0;

  const userReviews = (userReviewsRes.data || []).map((r: any) => ({
    id: r.id,
    therapist_name: r.therapists?.name || "",
    shop_name: r.salons?.display_name || r.salons?.name || "",
    score: r.score || 0,
    service_level_id: r.service_level_id,
    moderation_status: r.moderation_status,
    created_at: r.created_at,
  }));

  const skrReviews = (skrReviewsRes.data || []).map((r: any) => {
    const imgs = r.therapists?.image_urls as string[] | null;
    return {
      id: r.id,
      therapist_id: r.therapist_id,
      therapist_name: r.therapists?.name || "",
      therapist_image: imgs?.[0] || null,
      shop_name: r.salons?.display_name || r.salons?.name || "",
      service_level_id: r.service_level_id,
      score: r.score || 0,
      comment: r.comment_service || "",
      created_at: r.created_at,
    };
  });

  // 嗜好マップ集計
  const prefRows = prefDataRes.data || [];
  const totalPrefReviews = prefRows.length;

  const countBy = (key: string) => {
    const counts: Record<string, number> = {};
    for (const r of prefRows) {
      const v = String((r as any)[key] || "");
      if (v) counts[v] = (counts[v] || 0) + 1;
    }
    return Object.entries(counts).map(([id, count]) => ({
      id,
      count,
      percentage: totalPrefReviews > 0 ? Math.round((count / totalPrefReviews) * 100) : 0,
    }));
  };

  const avgParam = (key: string) => {
    const vals = prefRows.map((r: any) => r[key]).filter((v: any) => v != null) as number[];
    return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 3;
  };

  const preferenceData = {
    totalReviews: totalPrefReviews,
    looksTypes: countBy("looks_type_id"),
    bodyTypes: countBy("body_type_id"),
    serviceTypes: countBy("service_level_id"),
    avgParameters: {
      conversation: avgParam("param_conversation"),
      distance: avgParam("param_distance"),
      technique: avgParam("param_technique"),
      personality: avgParam("param_personality"),
    },
  };

  // 反響統計の集計
  const feedbackRows = feedbackRes.data || [];
  const feedbackStats = {
    totalViews: feedbackRows.reduce((sum: number, r: any) => sum + (r.view_count || 0), 0),
    totalHelpful: feedbackRows.reduce((sum: number, r: any) => sum + (r.helpful_count || 0), 0),
    totalReal: feedbackRows.reduce((sum: number, r: any) => sum + (r.real_count || 0), 0),
    totalFake: feedbackRows.reduce((sum: number, r: any) => sum + (r.fake_count || 0), 0),
    reviewCount: feedbackRows.length,
  };

  return NextResponse.json({
    profile: profile
      ? {
          nickname: profile.nickname || "名無し",
          membership_type: profile.membership_type || "free",
          monthly_review_count: profile.monthly_review_count || 0,
          total_review_count: profile.total_review_count || 0,
          view_permission_until: profile.view_permission_until,
        }
      : null,
    favoriteCount,
    userReviews,
    skrReviews,
    preferenceData,
    feedbackStats,
  });
}
