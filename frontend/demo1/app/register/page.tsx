"use client";

import React, { Suspense } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, Check, MailCheck } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { sanitizeRedirect } from "@/lib/utils/sanitize-redirect";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">読み込み中...</div></div>}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirect(searchParams.get("redirect"));
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [formData, setFormData] = useState({
    nickname: "",
    email: "",
    password: "",
  });

  const passwordStrength = () => {
    const { password } = formData;
    if (password.length === 0) return null;
    if (password.length < 6) return { label: "弱い", color: "bg-destructive" };
    if (password.length < 10) return { label: "普通", color: "bg-primary/60" };
    return { label: "強い", color: "bg-primary" };
  };

  const strength = passwordStrength();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) return;
    setIsLoading(true);
    setError(null);

    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: { nickname: formData.nickname },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    // メール確認が必要な場合（本番環境）
    if (!data.session) {
      // 既存ユーザーの検出（identitiesが空 = 既に登録済み）
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("このメールアドレスは既に登録されています。ログインページからお試しください。");
        setIsLoading(false);
        return;
      }
      setShowEmailConfirmation(true);
      setIsLoading(false);
      return;
    }

    // メール確認不要の場合（ローカル開発）
    sessionStorage.setItem("justRegistered", "true");
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          {showEmailConfirmation ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MailCheck className="h-12 w-12 mx-auto text-primary mb-4" />
                <h2 className="text-xl font-bold mb-2">確認メールを送信しました</h2>
                <p className="text-muted-foreground mb-4">
                  <span className="font-medium text-foreground">{formData.email}</span> に確認メールを送信しました。
                  メール内のリンクをクリックして登録を完了してください。
                </p>
                <p className="text-sm text-muted-foreground">
                  メールが届かない場合は、迷惑メールフォルダをご確認ください。
                </p>
              </CardContent>
            </Card>
          ) : (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">新規登録</CardTitle>
              <CardDescription>
                無料会員登録で口コミを閲覧・投稿できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Benefits */}
              <div className="bg-muted/50 rounded-lg p-4 mb-6">
                <p className="font-medium mb-2">会員特典</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    口コミ投稿で全ての口コミが閲覧可能
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    お気に入りセラピストの登録
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    新着口コミの通知機能
                  </li>
                </ul>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nickname">ニックネーム</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="nickname"
                      name="nickname"
                      type="text"
                      placeholder="口コミに表示される名前"
                      value={formData.nickname}
                      onChange={(e) =>
                        setFormData({ ...formData, nickname: e.target.value })
                      }
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="example@email.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">パスワード</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="6文字以上で設定"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="pl-10 pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {strength && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${strength.color} transition-all`}
                          style={{
                            width:
                              strength.label === "弱い"
                                ? "33%"
                                : strength.label === "普通"
                                ? "66%"
                                : "100%",
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {strength.label}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) =>
                      setAgreedToTerms(checked === true)
                    }
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed">
                    <Link
                      href="/legal/terms"
                      className="text-primary hover:underline"
                    >
                      利用規約
                    </Link>
                    と
                    <Link
                      href="/legal/privacy"
                      className="text-primary hover:underline"
                    >
                      プライバシーポリシー
                    </Link>
                    に同意します
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !agreedToTerms}
                >
                  {isLoading ? "登録中..." : "無料で登録する"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                既にアカウントをお持ちの方は{" "}
                <Link
                  href={`/login${redirectTo !== "/mypage" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
                  className="text-primary hover:underline"
                >
                  ログイン
                </Link>
              </p>
            </CardContent>
          </Card>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
