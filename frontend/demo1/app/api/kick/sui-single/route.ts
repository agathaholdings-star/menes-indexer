import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * SUI Payment KICK callback for one-time (都度) payments.
 * PV-Pay sends GET request with all params as query parameters.
 * Result=OK means payment succeeded, NG means failed.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const result = params.get("Result");
  const transactionId = params.get("TransactionId");
  const userId = params.get("userId");
  const therapistId = params.get("therapistId");
  const amount = params.get("Amount");
  const siteId = params.get("SiteId");

  // Log all params for audit
  const rawParams: Record<string, string> = {};
  params.forEach((value, key) => {
    rawParams[key] = value;
  });

  console.log("[SUI KICK Single]", JSON.stringify(rawParams));

  // Store transaction record
  await supabaseAdmin.from("sui_transactions").insert({
    user_id: userId || null,
    transaction_id: transactionId,
    site_id: siteId,
    amount: amount ? parseInt(amount) : 0,
    result: result || "UNKNOWN",
    transaction_type: "single_unlock",
    raw_params: rawParams,
  });

  if (result !== "OK") {
    console.log(`[SUI KICK Single] Payment failed: ${result}`);
    return NextResponse.json({ received: true });
  }

  if (!userId || !therapistId) {
    console.error("[SUI KICK Single] Missing userId or therapistId");
    return NextResponse.json({ received: true });
  }

  // Check for duplicate transaction
  const { data: existing } = await supabaseAdmin
    .from("sui_transactions")
    .select("id")
    .eq("transaction_id", transactionId)
    .eq("result", "OK")
    .eq("transaction_type", "single_unlock");

  if (existing && existing.length > 1) {
    console.log(`[SUI KICK Single] Duplicate transaction: ${transactionId}`);
    return NextResponse.json({ received: true });
  }

  // Unlock therapist (same logic as Stripe webhook)
  const { error } = await supabaseAdmin.from("therapist_unlocks").upsert(
    {
      user_id: userId,
      therapist_id: parseInt(therapistId),
      is_permanent: true,
      unlocked_at: new Date().toISOString(),
    },
    { onConflict: "user_id,therapist_id" }
  );

  if (error) {
    console.error("[SUI KICK Single] Unlock failed:", error);
  } else {
    console.log(
      `[SUI KICK Single] Unlocked: ${userId} → therapist ${therapistId}`
    );
  }

  return NextResponse.json({ received: true });
}
