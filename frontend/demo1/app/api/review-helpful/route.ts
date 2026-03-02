import { supabaseAdmin } from "@/lib/supabase-admin";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// GET: ユーザーの helpful 一覧取得（review_ids バッチ対応）
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const reviewIds = searchParams.get("review_ids");

  let query = supabaseAdmin
    .from("review_helpful")
    .select("review_id")
    .eq("user_id", user.id);

  if (reviewIds) {
    const ids = reviewIds.split(",").filter(Boolean);
    query = query.in("review_id", ids);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const helpfulMap: Record<string, boolean> = {};
  for (const row of data || []) {
    helpfulMap[row.review_id] = true;
  }

  return NextResponse.json(helpfulMap);
}

// POST: helpful 追加
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { review_id } = await req.json();

  if (!review_id) {
    return NextResponse.json(
      { error: "review_id required" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from("review_helpful").insert({
    user_id: user.id,
    review_id,
  });

  if (error) {
    // 重複の場合は成功扱い
    if (error.code === "23505") {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE: helpful 取消
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { review_id } = await req.json();
  if (!review_id) {
    return NextResponse.json(
      { error: "review_id required" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("review_helpful")
    .delete()
    .eq("user_id", user.id)
    .eq("review_id", review_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
