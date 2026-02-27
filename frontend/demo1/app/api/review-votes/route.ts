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

// GET: ユーザーの投票一覧を取得（review_idsでバッチ対応）
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const reviewIds = searchParams.get("review_ids");

  let query = supabaseAdmin
    .from("review_votes")
    .select("review_id, vote_type")
    .eq("user_id", user.id);

  if (reviewIds) {
    const ids = reviewIds.split(",").filter(Boolean);
    query = query.in("review_id", ids);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const voteMap: Record<string, string> = {};
  for (const row of data || []) {
    voteMap[row.review_id] = row.vote_type;
  }

  return NextResponse.json(voteMap);
}

// POST: 投票（UPSERT）
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { review_id, vote_type } = await req.json();

  if (!review_id || !vote_type) {
    return NextResponse.json(
      { error: "review_id and vote_type required" },
      { status: 400 }
    );
  }

  if (!["real", "fake"].includes(vote_type)) {
    return NextResponse.json(
      { error: "vote_type must be 'real' or 'fake'" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from("review_votes").upsert(
    {
      user_id: user.id,
      review_id,
      vote_type,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,review_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE: 投票取消
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
    .from("review_votes")
    .delete()
    .eq("user_id", user.id)
    .eq("review_id", review_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
