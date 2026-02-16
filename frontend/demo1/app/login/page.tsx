"use client";

import React, { Suspense } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, Monitor, Smartphone, Laptop, X } from "lucide-react";
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

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import {
  generateDeviceFingerprint,
  getDeviceLabel,
} from "@/lib/device-fingerprint";

interface DeviceSession {
  id: string;
  device_label: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">読み込み中...</div></div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/mypage";
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceLimitSessions, setDeviceLimitSessions] = useState<DeviceSession[] | null>(null);
  const [removingSession, setRemovingSession] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const registerDevice = async (): Promise<boolean> => {
    const fingerprint = await generateDeviceFingerprint();
    const label = getDeviceLabel();

    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_fingerprint: fingerprint,
        device_label: label,
      }),
    });

    if (res.ok) return true;

    if (res.status === 409) {
      const data = await res.json();
      setDeviceLimitSessions(data.sessions || []);
      return false;
    }

    return true; // エラー時はデバイス制限をスキップ
  };

  const handleRemoveSession = async (sessionId: string) => {
    setRemovingSession(sessionId);
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });

    // 削除後に再登録を試みる
    const success = await registerDevice();
    if (success) {
      router.push(redirectTo);
      router.refresh();
    }
    setRemovingSession(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setDeviceLimitSessions(null);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "メールアドレスまたはパスワードが正しくありません"
          : error.message
      );
      setIsLoading(false);
      return;
    }

    // デバイス制限チェック
    const deviceOk = await registerDevice();
    if (!deviceOk) {
      setIsLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">ログイン</CardTitle>
              <CardDescription>
                アカウントにログインして口コミを閲覧・投稿しよう
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              {deviceLimitSessions && (
                <div className="mb-4 p-4 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-3">
                    現在2台のデバイスでログイン中です。このデバイスでログインするには、いずれかのデバイスを切断してください。
                  </p>
                  <div className="space-y-2">
                    {deviceLimitSessions.map((s) => {
                      const label = s.device_label || "不明なデバイス";
                      const isMobile = label.includes("iPhone") || label.includes("Android") || label.includes("iPad");
                      const Icon = isMobile ? Smartphone : label.includes("macOS") || label.includes("Windows") ? Laptop : Monitor;
                      const lastActive = new Date(s.last_active_at);
                      const diffMs = Date.now() - lastActive.getTime();
                      const diffMin = Math.floor(diffMs / 60000);
                      const timeAgo = diffMin < 1 ? "たった今" : diffMin < 60 ? `${diffMin}分前` : diffMin < 1440 ? `${Math.floor(diffMin / 60)}時間前` : `${Math.floor(diffMin / 1440)}日前`;

                      return (
                        <div key={s.id} className="flex items-center justify-between p-2 rounded bg-white dark:bg-background border">
                          <div className="flex items-center gap-2 text-sm">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{label}</div>
                              <div className="text-xs text-muted-foreground">最終利用: {timeAgo}</div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSession(s.id)}
                            disabled={removingSession === s.id}
                          >
                            {removingSession === s.id ? "切断中..." : <X className="h-4 w-4" />}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">パスワード</Label>
                    <Link
                      href="/login?reset=true"
                      className="text-sm text-primary hover:underline"
                    >
                      パスワードを忘れた方
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="パスワードを入力"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="pl-10 pr-10"
                      required
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
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "ログイン中..." : "ログイン"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                アカウントをお持ちでない方は{" "}
                <Link
                  href="/register"
                  className="text-primary hover:underline"
                >
                  新規登録
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
