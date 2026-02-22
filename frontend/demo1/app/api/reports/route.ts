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

const VALID_TARGET_TYPES = ["bbs_post", "bbs_thread", "message", "user"] as const;
const VALID_REASONS = ["spam", "harassment", "illegal", "personal_info", "other"] as const;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { target_type, target_id, reason, detail } = body;

  if (!target_type || !target_id || !reason) {
    return NextResponse.json({ error: "target_type, target_id, reason are required" }, { status: 400 });
  }
  if (!VALID_TARGET_TYPES.includes(target_type)) {
    return NextResponse.json({ error: "Invalid target_type" }, { status: 400 });
  }
  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }

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

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type,
    target_id: String(target_id),
    reason,
    detail: detail || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
