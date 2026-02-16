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
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("favorites")
    .select("therapist_id, therapists(id, name, age, image_urls, salons(name, display_name))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const favorites = (data || []).map((f: any) => {
    const t = f.therapists;
    const imgs = t?.image_urls as string[] | null;
    const shop = t?.salons as { name: string; display_name: string | null } | null;
    return {
      id: t?.id || 0,
      name: t?.name || "",
      age: t?.age || null,
      image_url: imgs?.[0] || null,
      shop_name: shop?.display_name || shop?.name || "",
    };
  });

  return NextResponse.json(favorites);
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { therapist_id } = await req.json();
  if (!therapist_id) {
    return NextResponse.json({ error: "therapist_id required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("therapist_id", therapist_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
