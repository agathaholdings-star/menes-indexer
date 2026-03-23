import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SUI_CANCEL_URL, SUI_SITES } from "@/lib/sui-config";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get profile with payment info
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("payment_provider, payment_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.payment_provider !== "sui") {
    return NextResponse.json(
      { error: "No SUI subscription found" },
      { status: 400 }
    );
  }

  // Send cancel request to both VISA/MC and JCB sites
  const sites = [SUI_SITES.subscriptionVisa, SUI_SITES.subscriptionJcb];
  let cancelled = false;

  for (const site of sites) {
    try {
      const formData = new URLSearchParams({
        SiteId: site.siteId,
        SitePass: site.sitePass,
        CustomerId: user.id,
      });

      const res = await fetch(SUI_CANCEL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      if (res.ok) {
        cancelled = true;
        console.log(
          `[SUI Cancel] Sent cancel for ${user.id} to site ${site.siteId}`
        );
      }
    } catch (err) {
      console.error(`[SUI Cancel] Failed for site ${site.siteId}:`, err);
    }
  }

  // Downgrade profile regardless (SUI cancel KICK will also fire)
  await supabaseAdmin
    .from("profiles")
    .update({
      membership_type: "free",
      payment_provider: null,
      payment_customer_id: null,
    })
    .eq("id", user.id);

  console.log(`[SUI Cancel] ${user.id} → free`);

  return NextResponse.json({ cancelled });
}
