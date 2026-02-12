"use client";

import React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, Check } from "lucide-react";
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

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: { nickname: formData.nickname },
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    router.push("/mypage");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
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
                  href="/login"
                  className="text-primary hover:underline"
                >
                  ログイン
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
