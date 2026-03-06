import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") || "/mypage";
  // Open redirect対策: 内部パスのみ許可
  const next = (rawNext.startsWith("/") && !rawNext.startsWith("//")) ? rawNext : "/mypage";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // エラー種別をクエリに伝播
    const errorCode = /expired/i.test(error.message) ? "expired" : "auth_callback_failed";
    return NextResponse.redirect(`${origin}/login?error=${errorCode}`);
  }

  // codeなしはログインページへ
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
