import { supabaseAdmin } from "@/lib/supabase-admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

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

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Stripeサブスクリプションがあれば即時キャンセル
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("payment_customer_id")
    .eq("id", user.id)
    .single();

  if (profile?.payment_customer_id) {
    try {
      // active, trialing, past_due 等すべての課金可能なサブスクをキャンセル
      for (const status of ["active", "trialing", "past_due"] as const) {
        const subscriptions = await stripe.subscriptions.list({
          customer: profile.payment_customer_id,
          status,
        });
        for (const sub of subscriptions.data) {
          await stripe.subscriptions.cancel(sub.id);
        }
      }
    } catch (err) {
      console.error("Failed to cancel Stripe subscriptions:", err);
      // Stripe失敗してもアカウント削除は続行
    }
  }

  // profiles は ON DELETE CASCADE なので auth.users を削除すれば全連鎖削除される
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
