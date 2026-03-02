import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

// Service role client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_MAP: Record<string, string> = {
  [process.env.STRIPE_STANDARD_PRICE_ID || ""]: "standard",
  [process.env.STRIPE_VIP_PRICE_ID || ""]: "vip",
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerEmail = session.customer_details?.email;
    const customerId = session.customer as string | null;

    if (!customerEmail) {
      console.error("No customer email in session:", session.id);
      return NextResponse.json({ error: "No email" }, { status: 400 });
    }

    // Determine plan from line items (must fetch separately - not in webhook payload)
    let membershipType = "standard"; // default
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      for (const item of lineItems.data) {
        const priceId = item.price?.id || "";
        if (PLAN_MAP[priceId]) {
          membershipType = PLAN_MAP[priceId];
          break;
        }
      }
    } catch (err) {
      console.error("Failed to fetch line items:", err);
    }

    // Find user by client_reference_id first (set by Payment Link), then by email
    let user: { id: string; email?: string } | undefined;
    if (session.client_reference_id) {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(
        session.client_reference_id
      );
      if (authData?.user) {
        user = authData.user;
      }
    }
    if (!user) {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
      user = authData?.users?.find((u) => u.email === customerEmail);
    }

    if (!user) {
      console.error("No user found for email:", customerEmail);
      return NextResponse.json({ received: true, warning: "user_not_found" });
    }

    // Update profile
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        membership_type: membershipType,
        payment_provider: "stripe",
        payment_customer_id: customerId || undefined,
      })
      .eq("id", user.id);

    if (error) {
      console.error("Profile update failed:", error);
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }

    console.log(
      `[Stripe Webhook] ${customerEmail} → ${membershipType} (session: ${session.id})`
    );
  }

  // サブスクリプション解約完了: 無料会員に戻す
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    if (customerId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("payment_customer_id", customerId)
        .single();

      if (profile) {
        await supabaseAdmin
          .from("profiles")
          .update({
            membership_type: "free",
            payment_provider: null,
            payment_customer_id: null,
          })
          .eq("id", profile.id);

        console.log(
          `[Stripe Webhook] Subscription cancelled → free for customer ${customerId}`
        );
      }
    }
  }

  // サブスクリプション更新時: 月次レビューカウントをリセット
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;

    if (customerId && invoice.billing_reason === "subscription_cycle") {
      // Stripe customer_id → profiles
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("payment_customer_id", customerId)
        .single();

      if (profile) {
        await supabaseAdmin
          .from("profiles")
          .update({
            monthly_review_count: 0,
            monthly_review_reset_at: new Date().toISOString(),
          })
          .eq("id", profile.id);

        console.log(
          `[Stripe Webhook] Monthly reset for customer ${customerId} (invoice: ${invoice.id})`
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
