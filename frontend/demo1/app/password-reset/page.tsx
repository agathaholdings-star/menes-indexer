"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { Mail, MailCheck } from "lucide-react";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function PasswordResetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">読み込み中...</div></div>}>
      <PasswordResetContent />
    </Suspense>
  );
}

function PasswordResetContent() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createSupabaseBrowser();
    const redirectTo = window.location.origin + "/auth/callback?next=/mypage";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setError("メール送信に失敗しました。時間をおいて再度お試しください。");
      setIsLoading(false);
      return;
    }

    setIsSuccess(true);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <Card>
            {isSuccess ? (
              <CardContent className="p-8 text-center">
                <MailCheck className="h-12 w-12 mx-auto text-primary mb-4" />
                <h2 className="text-2xl font-bold mb-2">
                  パスワードリセットメールを送信しました
                </h2>
                <p className="text-muted-foreground mb-6">
                  <span className="font-medium text-foreground">{email}</span>
                  にパスワード再設定用のメールを送信しました。
                  メール内のリンクから再設定を完了してください。
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  メールが届かない場合は、迷惑メールフォルダもご確認ください。
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login">ログイン画面に戻る</Link>
                </Button>
              </CardContent>
            ) : (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">パスワードをリセット</CardTitle>
                  <CardDescription>
                    登録済みのメールアドレスを入力してください
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {error && (
                    <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">メールアドレス</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="example@email.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "送信中..." : "リセットメールを送信"}
                    </Button>
                  </form>

                  <p className="mt-6 text-center text-sm text-muted-foreground">
                    ログイン画面に戻る{" "}
                    <Link href="/login" className="text-primary hover:underline">
                      こちら
                    </Link>
                  </p>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
