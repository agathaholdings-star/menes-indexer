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

  let body: { therapist_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { therapist_id } = body;
  if (!therapist_id) {
    return NextResponse.json(
      { error: "therapist_id is required" },
      { status: 400 }
    );
  }

  const site = SUI_SITES.onetime;

  // Return form fields for client-side submission
  // Custom params (userId, therapistId) are echoed back in KICK callback
  return NextResponse.json({
    formUrl: SUI_FORM_URL,
    fields: {
      SiteId: site.siteId,
      SitePass: site.sitePass,
      Amount: String(SUI_PLANS.single_unlock.amount),
      CustomerId: user.id,
      mail: user.email || "",
      itemId: `unlock:therapist:${therapist_id}`,
      language: "ja",
      userId: user.id,
      therapistId: String(therapist_id),
    },
  });
}
