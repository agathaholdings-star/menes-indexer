import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * SUI Payment KICK callback for subscription (継続) payments.
 * Initial payment: Result, TransactionId, custom params
 * Recurring payments: firstTransactionId, latestTransactionId, continueKey, Result
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const result = params.get("Result");
  const transactionId =
    params.get("TransactionId") || params.get("latestTransactionId");
  const firstTransactionId = params.get("firstTransactionId");
  const continueKey = params.get("continueKey");
  const userId = params.get("userId");
  const customerId = params.get("CustomerId");
  const plan = params.get("plan");
  const amount = params.get("Amount") || params.get("Amount2");
  const siteId = params.get("SiteId");

  // Log all params for audit
  const rawParams: Record<string, string> = {};
  params.forEach((value, key) => {
    rawParams[key] = value;
  });

  console.log("[SUI KICK Subscription]", JSON.stringify(rawParams));

  // Determine if this is initial or recurring
  const isRecurring = !!firstTransactionId;
  const transactionType = isRecurring
    ? "subscription_recurring"
    : "subscription_initial";

  // Store transaction record
  await supabaseAdmin.from("sui_transactions").insert({
    user_id: userId || customerId || null,
    transaction_id: transactionId,
    continue_key: continueKey,
    site_id: siteId,
    amount: amount ? parseInt(amount) : 0,
    result: result || "UNKNOWN",
    transaction_type: transactionType,
    raw_params: rawParams,
  });

  if (result !== "OK") {
    console.log(`[SUI KICK Subscription] Payment failed: ${result}`);

    // If recurring payment fails and auto-cancel happens, downgrade user
    if (isRecurring && customerId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("payment_customer_id", customerId)
        .eq("payment_provider", "sui")
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
          `[SUI KICK Subscription] Recurring failed → downgraded: ${customerId}`
        );
      }
    }

    return NextResponse.json({ received: true });
  }

  // Determine the effective user ID
  const effectiveUserId = userId || customerId;
  if (!effectiveUserId) {
    console.error("[SUI KICK Subscription] Missing userId and CustomerId");
    return NextResponse.json({ received: true });
  }

  if (isRecurring) {
    // Recurring payment succeeded - reset monthly review count
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("payment_customer_id", customerId)
      .eq("payment_provider", "sui")
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
        `[SUI KICK Subscription] Recurring OK → monthly reset: ${customerId}`
      );
    }
  } else {
    // Initial subscription payment - upgrade user
    const membershipType = plan === "vip" ? "vip" : "standard";

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        membership_type: membershipType,
        payment_provider: "sui",
        payment_customer_id: effectiveUserId,
      })
      .eq("id", effectiveUserId);

    if (error) {
      console.error("[SUI KICK Subscription] Profile update failed:", error);
    } else {
      console.log(
        `[SUI KICK Subscription] ${effectiveUserId} → ${membershipType}`
      );
    }
  }

  return NextResponse.json({ received: true });
}
