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

// GET: フォロー状態取得
// ?user_ids=id1,id2,id3 → { [user_id]: true }
// ?mode=followers → 自分のフォロワー数 { followerCount: number }
// ?mode=following → 自分がフォロー中のユーザー一覧
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");
  const userIds = searchParams.get("user_ids");

  // モード: フォロワー数
  if (mode === "followers") {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("follower_count")
      .eq("id", user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ followerCount: data?.follower_count ?? 0 });
  }

  // モード: フォロー中ユーザー一覧（マイページ用）
  if (mode === "following") {
    const { data, error } = await supabaseAdmin
      .from("user_follows")
      .select("followed_id, created_at")
      .eq("follower_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ following: [] });
    }

    // フォロー先ユーザーのプロフィール情報を取得
    const followedIds = data.map((row) => row.followed_id);
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, nickname, follower_count, total_review_count")
      .in("id", followedIds);

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    // フォロー順序を維持
    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    );
    const following = followedIds
      .map((id) => profileMap.get(id))
      .filter(Boolean);

    return NextResponse.json({ following });
  }

  // デフォルト: 指定ユーザーのフォロー状態チェック
  let query = supabaseAdmin
    .from("user_follows")
    .select("followed_id")
    .eq("follower_id", user.id);

  if (userIds) {
    const ids = userIds.split(",").filter(Boolean);
    query = query.in("followed_id", ids);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const followMap: Record<string, boolean> = {};
  for (const row of data || []) {
    followMap[row.followed_id] = true;
  }

  return NextResponse.json(followMap);
}

// POST: フォロー追加
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { followed_id } = await req.json();

  if (!followed_id) {
    return NextResponse.json(
      { error: "followed_id required" },
      { status: 400 }
    );
  }

  // 自分自身のフォロー防止
  if (followed_id === user.id) {
    return NextResponse.json(
      { error: "Cannot follow yourself" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from("user_follows").insert({
    follower_id: user.id,
    followed_id,
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

// DELETE: フォロー解除
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { followed_id } = await req.json();
  if (!followed_id) {
    return NextResponse.json(
      { error: "followed_id required" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("user_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followed_id", followed_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
