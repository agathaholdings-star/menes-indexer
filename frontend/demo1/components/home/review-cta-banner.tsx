"use client";

import Link from "next/link";
import { PenLine, Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useTier } from "@/lib/hooks/use-tier";

export function ReviewCtaBanner() {
  const { user } = useAuth();
  const { membershipType, totalReviewCount, loading } = useTier();

  // 未ログイン、ロード中、有料会員、投稿済みは非表示
  if (!user || loading || membershipType !== "free" || totalReviewCount > 0) return null;

  return (
    <section className="mt-6">
      <div className="relative overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-5">
        {/* Background decoration */}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
        <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Message */}
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
              <Gift className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                口コミ1件で、5人分の口コミが読める！
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                あなたの体験を共有して、他のユーザーの口コミを閲覧しよう。
                スクショ付きなら10人分読める！
              </p>
            </div>
          </div>

          {/* Right: CTA Button */}
          <Link href="/review" className="shrink-0">
            <Button size="lg" className="w-full sm:w-auto gap-2 rounded-xl shadow-md">
              <PenLine className="h-4 w-4" />
              口コミを書く
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
