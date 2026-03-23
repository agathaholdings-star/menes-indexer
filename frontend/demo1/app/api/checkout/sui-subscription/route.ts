import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUI_FORM_URL, SUI_SITES, SUI_PLANS } from "@/lib/sui-config";

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

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { plan } = body;
  if (plan !== "standard" && plan !== "vip") {
    return NextResponse.json(
      { error: "plan must be 'standard' or 'vip'" },
      { status: 400 }
    );
  }

  const pricing = SUI_PLANS[plan];
  // Use VISA/MC site by default; JCB users will be handled by SUI's card detection
  const site = SUI_SITES.subscriptionVisa;

  return NextResponse.json({
    formUrl: SUI_FORM_URL,
    fields: {
      SiteId: site.siteId,
      SitePass: site.sitePass,
      Amount: String(pricing.amount),
      Amount2: String(pricing.amount2),
      CustomerId: user.id,
      mail: user.email || "",
      itemId: `subscription:${plan}`,
      language: "ja",
      userId: user.id,
      plan: plan,
    },
  });
}
