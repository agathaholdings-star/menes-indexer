"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Crown, ArrowRight, Sparkles, Check } from "lucide-react";
import { useTier } from "@/lib/hooks/use-tier";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type MembershipLevel = "free" | "standard" | "vip";

const vipFilters = [
  { id: "1", label: "健全", emoji: "🧘" },
  { id: "dokidoki", label: "ドキドキ", emoji: "💓" },
  { id: "2", label: "SKR", emoji: "🍄" },
  { id: "3", label: "HR", emoji: "💎" },
];

export function VipFilter() {
  const { membershipType } = useTier();
  const membershipLevel = (membershipType || "free") as MembershipLevel;
  const [showStandardModal, setShowStandardModal] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);

  const isVip = membershipLevel === "vip";
  const isStandard = membershipLevel === "standard";
  const isFree = membershipLevel === "free";

  const handleFilterClick = (filterId: string) => {
    if (isVip) {
      window.location.href = `/search?service=${filterId}`;
    } else if (isStandard) {
      setShowVipModal(true);
    } else {
      setShowStandardModal(true);
    }
  };

  return (
    <>
      <section className="mt-6">
        <div className="overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left: Title & Description */}
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/20 p-2">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  VIP限定：サービスレベル検索
                  <Lock className="h-3 w-3 text-primary" />
                </h3>
                <p className="text-xs text-slate-400">本当に知りたい情報にアクセス</p>
              </div>
            </div>

            {/* Right: Filter Buttons (blurred) */}
            <div className="flex items-center gap-2">
              <div className={`flex gap-2 ${!isVip ? "blur-[3px] pointer-events-none" : ""}`}>
                {vipFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => handleFilterClick(filter.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-sm text-white transition-all hover:border-primary/50 hover:bg-slate-700/50"
                  >
                    <span>{filter.emoji}</span>
                    <span className="font-medium">{filter.label}</span>
                  </button>
                ))}
              </div>
              
              {!isVip && (
                <Button
                  size="sm"
                  onClick={() => isFree ? setShowStandardModal(true) : setShowVipModal(true)}
                  className="ml-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  解除する
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Standard Plan Modal → 投稿ベース解放の説明に差し替え */}
      <Dialog open={showStandardModal} onOpenChange={setShowStandardModal}>
        <DialogContent className="max-w-md border-primary/30 bg-gradient-to-br from-slate-900 to-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-6 w-6 text-primary" />
              キャンペーン中: 口コミ投稿で解放
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              サイト公開キャンペーン中は口コミの投稿だけで機能が使えます
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ul className="space-y-2 text-sm text-slate-200">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />2件投稿: SKRフィルター解放</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />3件投稿: HRフィルター解放</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />1件投稿で5件の口コミが読める</li>
            </ul>
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-center">
              <p className="text-sm text-slate-300">すべて</p>
              <p className="text-3xl font-bold text-primary">キャンペーン中</p>
            </div>
            <Button asChild className="w-full"><Link href="/pricing">詳細を見る</Link></Button>
            <Button variant="ghost" onClick={() => setShowStandardModal(false)} className="w-full text-slate-400 bg-transparent">あとで</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* VIP Upgrade Modal → 投稿ベース解放の説明に差し替え */}
      <Dialog open={showVipModal} onOpenChange={setShowVipModal}>
        <DialogContent className="max-w-md border-primary/30 bg-gradient-to-br from-slate-900 to-black text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Crown className="h-6 w-6 text-primary" />
              キャンペーン中: 全機能を解放
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              サイト公開キャンペーン中は口コミの投稿だけで全機能が使えます
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ul className="space-y-2 text-sm text-slate-200">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />2件投稿: SKRフィルター解放</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />3件投稿: HRフィルター + 全機能解放</li>
            </ul>
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-center">
              <p className="text-sm text-slate-300">すべて</p>
              <p className="text-3xl font-bold text-primary">キャンペーン中</p>
            </div>
            <Button asChild className="w-full"><Link href="/pricing">詳細を見る</Link></Button>
            <Button variant="ghost" onClick={() => setShowVipModal(false)} className="w-full text-slate-400 bg-transparent">あとで</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
