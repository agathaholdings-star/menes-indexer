import { supabaseAdmin } from "@/lib/supabase-admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

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

async function verifyAdmin(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();
  return profile?.is_admin === true;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await verifyAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch stats
  const [shopCount, therapistCount, reviewCount, userCount, pendingCount] =
    await Promise.all([
      supabaseAdmin.from("salons").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("therapists").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("reviews").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("moderation_status", "pending"),
    ]);

  // Fetch reviews
  const { data: reviews } = await supabaseAdmin
    .from("reviews")
    .select(
      "id, score, looks_type, body_type, service_level, moderation_status, comment_first_impression, comment_service, comment_advice, created_at, user_id, therapist_id, salon_id, verification_image_path, is_verified"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  let enrichedReviews = reviews ?? [];
  if (enrichedReviews.length > 0) {
    const therapistIds = [...new Set(enrichedReviews.map((r) => r.therapist_id))];
    const shopIds = [...new Set(enrichedReviews.map((r) => r.salon_id))];
    const userIds = [...new Set(enrichedReviews.map((r) => r.user_id))];

    const [therapists, shops, profiles] = await Promise.all([
      supabaseAdmin.from("therapists").select("id, name").in("id", therapistIds),
      supabaseAdmin.from("salons").select("id, display_name, name").in("id", shopIds),
      supabaseAdmin.from("profiles").select("id, nickname").in("id", userIds),
    ]);

    const therapistMap = new Map((therapists.data ?? []).map((t) => [t.id, t.name]));
    const shopMap = new Map((shops.data ?? []).map((s) => [s.id, s.display_name || s.name]));
    const userMap = new Map((profiles.data ?? []).map((p) => [p.id, p.nickname || "名無し"]));

    enrichedReviews = enrichedReviews.map((r) => ({
      ...r,
      therapist_name: therapistMap.get(r.therapist_id) || `ID:${r.therapist_id}`,
      shop_name: shopMap.get(r.salon_id) || `ID:${r.salon_id}`,
      user_nickname: userMap.get(r.user_id) || "不明",
    }));
  }

  // Fetch threads
  const { data: threadData } = await supabaseAdmin
    .from("bbs_threads" as any)
    .select("id, title, category, reply_count, view_count, created_at, user_id, profiles(nickname)")
    .order("created_at", { ascending: false })
    .limit(50);

  const threads = (threadData || []).map((t: any) => ({
    ...t,
    user_nickname: t.profiles?.nickname || "名無し",
  }));

  // Fetch users
  const { data: users } = await supabaseAdmin
    .from("profiles")
    .select("id, nickname, membership_type, total_review_count, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({
    stats: {
      shops: shopCount.count ?? 0,
      therapists: therapistCount.count ?? 0,
      reviews: reviewCount.count ?? 0,
      users: userCount.count ?? 0,
      pending: pendingCount.count ?? 0,
    },
    reviews: enrichedReviews,
    threads,
    users: users ?? [],
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await verifyAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "approve_review": {
      const { review_id } = body;
      const { error } = await supabaseAdmin.rpc("approve_review", { review_id });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "reject_review": {
      const { review_id } = body;
      const { error } = await supabaseAdmin.rpc("reject_review", { review_id });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "verify_review": {
      const { review_id } = body;
      const { error } = await supabaseAdmin
        .from("reviews")
        .update({ is_verified: true })
        .eq("id", review_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "delete_review": {
      const { review_id } = body;
      const { error } = await supabaseAdmin
        .from("reviews")
        .delete()
        .eq("id", review_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "delete_thread": {
      const { thread_id } = body;
      await supabaseAdmin.from("bbs_posts" as any).delete().eq("thread_id", thread_id);
      const { error } = await supabaseAdmin.from("bbs_threads" as any).delete().eq("id", thread_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "get_image_url": {
      const { path } = body;
      const { data } = await supabaseAdmin.storage
        .from("review-verifications")
        .createSignedUrl(path, 300);
      if (data?.signedUrl) {
        return NextResponse.json({ url: data.signedUrl });
      }
      return NextResponse.json({ error: "Failed to get URL" }, { status: 500 });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
