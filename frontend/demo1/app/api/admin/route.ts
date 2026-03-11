import { supabaseAdmin } from "@/lib/supabase-admin";
import { getResend } from "@/lib/resend";
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
  const [salonCount, therapistCount, reviewCount, userCount, pendingCount] =
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
      "id, score, looks_type_id, body_type_id, service_level_id, moderation_status, comment_first_impression, comment_service, comment_advice, created_at, user_id, therapist_id, salon_id, verification_image_path, is_verified"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  let enrichedReviews = reviews ?? [];
  if (enrichedReviews.length > 0) {
    const therapistIds = [...new Set(enrichedReviews.map((r) => r.therapist_id))];
    const salonIds = [...new Set(enrichedReviews.map((r) => r.salon_id))];
    const userIds = [...new Set(enrichedReviews.map((r) => r.user_id))];

    const [therapists, shops, profiles] = await Promise.all([
      supabaseAdmin.from("therapists").select("id, name").in("id", therapistIds),
      supabaseAdmin.from("salons").select("id, display_name, name").in("id", salonIds),
      supabaseAdmin.from("profiles").select("id, nickname").in("id", userIds),
    ]);

    const therapistMap = new Map((therapists.data ?? []).map((t) => [t.id, t.name]));
    const salonMap = new Map((shops.data ?? []).map((s) => [s.id, s.display_name || s.name]));
    const userMap = new Map((profiles.data ?? []).map((p) => [p.id, p.nickname || "名無し"]));

    enrichedReviews = enrichedReviews.map((r) => ({
      ...r,
      therapist_name: therapistMap.get(r.therapist_id) || `ID:${r.therapist_id}`,
      shop_name: salonMap.get(r.salon_id) || `ID:${r.salon_id}`,
      user_nickname: userMap.get(r.user_id) || "不明",
    }));
  }

  // Fetch users
  const { data: users } = await supabaseAdmin
    .from("profiles")
    .select("id, nickname, membership_type, total_review_count, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  // Fetch contact submissions
  const [contactSubmissions, newContactCount] = await Promise.all([
    supabaseAdmin
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ]);

  return NextResponse.json({
    stats: {
      salons: salonCount.count ?? 0,
      therapists: therapistCount.count ?? 0,
      reviews: reviewCount.count ?? 0,
      users: userCount.count ?? 0,
      pending: pendingCount.count ?? 0,
      new_contacts: newContactCount.count ?? 0,
    },
    reviews: enrichedReviews,
    users: users ?? [],
    contacts: contactSubmissions.data ?? [],
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

      // Direct DB update (replaces RPC which fails with service_role_key due to auth.uid() check)
      const { data: updatedReview, error: reviewError } = await supabaseAdmin
        .from("reviews")
        .update({ moderation_status: "approved" })
        .eq("id", review_id)
        .eq("moderation_status", "pending")
        .select("user_id, therapist_id, verification_image_path")
        .single();

      if (reviewError || !updatedReview) {
        return NextResponse.json(
          { error: reviewError?.message || "Review not found or already processed" },
          { status: 500 }
        );
      }

      // Grant credits: 10 with screenshot, 5 without
      const credits = updatedReview.verification_image_path ? 10 : 5;
      const { data: currentProfile } = await supabaseAdmin
        .from("profiles")
        .select("total_review_count, monthly_review_count, monthly_review_reset_at, review_credits")
        .eq("id", updatedReview.user_id)
        .single();

      if (currentProfile) {
        await supabaseAdmin
          .from("profiles")
          .update({
            total_review_count: (currentProfile.total_review_count || 0) + 1,
            monthly_review_count: (currentProfile.monthly_review_count || 0) + 1,
            monthly_review_reset_at: currentProfile.monthly_review_reset_at || new Date().toISOString(),
            review_credits: (currentProfile.review_credits || 0) + credits,
            credits_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", updatedReview.user_id);
      }

      // Send approval notification email (non-blocking)
      try {
        const [userRes, therapistRes, profileRes] = await Promise.all([
          supabaseAdmin.auth.admin.getUserById(updatedReview.user_id),
          supabaseAdmin.from("therapists").select("name").eq("id", updatedReview.therapist_id).single(),
          supabaseAdmin.from("profiles").select("nickname").eq("id", updatedReview.user_id).single(),
        ]);
        const email = userRes.data.user?.email;
        const therapistName = therapistRes.data?.name || "セラピスト";
        const nickname = profileRes.data?.nickname || "ユーザー";
        if (email) {
          await getResend()?.emails.send({
            from: "メンエスSKR <info@menes-skr.com>",
            to: email,
            subject: "口コミが承認されました",
            html: `<p>${nickname}様</p><p>${therapistName}への口コミが承認されました。クレジットが付与されました。</p><p>サイトにログインして口コミを閲覧しましょう。</p><p>メンエスSKR</p>`,
          });
        }
      } catch (emailError) {
        console.error("Failed to send approval email:", emailError);
      }

      return NextResponse.json({ ok: true });
    }

    case "reject_review": {
      const { review_id, reason } = body;

      // Direct DB update (replaces RPC which fails with service_role_key due to auth.uid() check)
      const { data: rejectedReview, error: rejectError } = await supabaseAdmin
        .from("reviews")
        .update({ moderation_status: "rejected", rejection_reason: reason || null })
        .eq("id", review_id)
        .eq("moderation_status", "pending")
        .select("user_id, therapist_id")
        .single();

      if (rejectError || !rejectedReview) {
        return NextResponse.json(
          { error: rejectError?.message || "Review not found or already processed" },
          { status: 500 }
        );
      }

      // Send rejection notification email (non-blocking)
      try {
        const [userRes, therapistRes, profileRes] = await Promise.all([
          supabaseAdmin.auth.admin.getUserById(rejectedReview.user_id),
          supabaseAdmin.from("therapists").select("name").eq("id", rejectedReview.therapist_id).single(),
          supabaseAdmin.from("profiles").select("nickname").eq("id", rejectedReview.user_id).single(),
        ]);
        const email = userRes.data.user?.email;
        const therapistName = therapistRes.data?.name || "セラピスト";
        const nickname = profileRes.data?.nickname || "ユーザー";
        if (email) {
          await getResend()?.emails.send({
            from: "メンエスSKR <info@menes-skr.com>",
            to: email,
            subject: "口コミについてのご連絡",
            html: `<p>${nickname}様</p><p>${therapistName}への口コミについて、以下の理由により承認できませんでした。</p><p>理由: ${reason || "規約違反"}</p><p>内容を修正の上、再投稿をお願いいたします。</p><p>メンエスSKR</p>`,
          });
        }
      } catch (emailError) {
        console.error("Failed to send rejection email:", emailError);
      }

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

    case "update_contact_status": {
      const { contact_id, status } = body;
      const updateData: Record<string, any> = { status };
      if (status === "resolved" || status === "closed") {
        updateData.resolved_at = new Date().toISOString();
      }
      const { error } = await supabaseAdmin
        .from("contact_submissions")
        .update(updateData)
        .eq("id", contact_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "delete_contact": {
      const { contact_id } = body;
      const { error } = await supabaseAdmin
        .from("contact_submissions")
        .delete()
        .eq("id", contact_id);
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
