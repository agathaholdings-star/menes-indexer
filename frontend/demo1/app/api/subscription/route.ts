import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_placeholder", {
  apiVersion: "2026-01-28.clover",
});

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// POST: 有料プランを解約（期間終了時にキャンセル）
export async function POST() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // プロフィールから Stripe customer ID を取得
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("payment_customer_id, membership_type")
    .eq("id", user.id)
    .single();

  if (!profile?.payment_customer_id) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  if (profile.membership_type === "free") {
    return NextResponse.json({ error: "Already free" }, { status: 400 });
  }

  // Stripe からアクティブなサブスクリプションを全て取得
  const subscriptions = await stripe.subscriptions.list({
    customer: profile.payment_customer_id,
    status: "active",
  });

  if (subscriptions.data.length === 0) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 400 });
  }

  // 全てのアクティブなサブスクリプションを期間終了時にキャンセル
  let latestPeriodEnd = 0;
  for (const sub of subscriptions.data) {
    await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: true,
    });
    if (sub.current_period_end > latestPeriodEnd) {
      latestPeriodEnd = sub.current_period_end;
    }
  }

  return NextResponse.json({ ok: true, cancel_at: latestPeriodEnd });
}
