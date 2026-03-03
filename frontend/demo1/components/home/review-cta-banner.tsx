"use client";

import Link from "next/link";
import { PenLine, Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemberLevel } from "@/components/shared/member-level-debug";

/**
 * 未投稿free会員向けの口コミ投稿CTAバナー。
 * 表示条件: ログイン済み + free会員 + 未投稿
 *
 * 現在はMemberLevelContextの"free"状態で表示。
 * Supabase認証統合後は、実際のログイン状態・投稿数を参照するよう差し替え。
 */
export function ReviewCtaBanner() {
  const { isFree } = useMemberLevel();

  // free会員でない場合（standard/vip）は表示しない
  // TODO: Supabase認証統合後、以下の条件を追加:
  //   - !session → 非表示（未ログイン）
  //   - profile.total_review_count > 0 → 非表示（投稿済み）
  if (!isFree) return null;

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
                口コミ1件で、10人分の口コミが読める！
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                あなたの体験を共有して、他のユーザーの口コミを閲覧しよう。
                新規登録で3クレジット付与中。
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
