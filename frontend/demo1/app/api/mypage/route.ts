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

  // Fetch profile, favorites count, user reviews, SKR reviews in parallel
  const [profileRes, favCountRes, userReviewsRes, skrReviewsRes] = await Promise.all([
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
  });
}
