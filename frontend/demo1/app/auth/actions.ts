"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { sanitizeRedirect } from "@/lib/utils/sanitize-redirect";

export async function signInWithEmail(formData: FormData) {
  const supabase = await createSupabaseServer();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = sanitizeRedirect(formData.get("redirect") as string | null);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(redirectTo);
}

export async function signUpWithEmail(formData: FormData) {
  const supabase = await createSupabaseServer();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const nickname = formData.get("nickname") as string;
  const redirectTo = sanitizeRedirect(formData.get("redirect") as string | null);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nickname },
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect(redirectTo);
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
