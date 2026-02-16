import { supabaseAdmin } from "@/lib/supabase-admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const MAX_DEVICES = 2;

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

// POST: ログイン時のセッション登録
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { device_fingerprint, device_label } = await req.json();
  if (!device_fingerprint) {
    return NextResponse.json(
      { error: "device_fingerprint required" },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  // 同じデバイスのセッションがあれば更新して許可
  const { data: existing } = await supabaseAdmin
    .from("user_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("device_fingerprint", device_fingerprint)
    .eq("is_active", true)
    .single();

  if (existing) {
    await supabaseAdmin
      .from("user_sessions")
      .update({ last_active_at: new Date().toISOString(), ip_address: ip })
      .eq("id", existing.id);
    return NextResponse.json({ ok: true });
  }

  // アクティブセッション数を確認
  const { count } = await supabaseAdmin
    .from("user_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if ((count || 0) >= MAX_DEVICES) {
    // 制限超過 — 既存セッション一覧を返す
    const { data: sessions } = await supabaseAdmin
      .from("user_sessions")
      .select("id, device_label, ip_address, last_active_at, created_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("last_active_at", { ascending: false });

    return NextResponse.json(
      { error: "device_limit", sessions: sessions || [] },
      { status: 409 }
    );
  }

  // 新セッション登録
  await supabaseAdmin.from("user_sessions").insert({
    user_id: user.id,
    device_fingerprint,
    device_label: device_label || null,
    ip_address: ip,
  });

  return NextResponse.json({ ok: true });
}

// GET: 自分のアクティブセッション一覧
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("user_sessions")
    .select("id, device_label, ip_address, last_active_at, created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("last_active_at", { ascending: false });

  return NextResponse.json(data || []);
}
