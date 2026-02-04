"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Crown, ArrowRight, Sparkles, Check } from "lucide-react";
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
  { id: "kenzen", label: "健全", emoji: "🧘" },
  { id: "dokidoki", label: "ドキドキ", emoji: "💓" },
  { id: "skr", label: "SKR", emoji: "🍄" },
  { id: "hr", label: "HR", emoji: "💎" },
];

export function VipFilter() {
  const [membershipLevel] = useState<MembershipLevel>("free");
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

      {/* Standard Plan Modal */}
      <Dialog open={showStandardModal} onOpenChange={setShowStandardModal}>
        <DialogContent className="max-w-md border-primary/30 bg-gradient-to-br from-slate-900 to-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-6 w-6 text-primary" />
              全ての口コミが見放題に
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              スタンダードプランで、口コミ・詳細情報にアクセス
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ul className="space-y-2 text-sm text-slate-200">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />全ての口コミを無制限閲覧</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />詳細パラメーター表示</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />お気に入り無制限</li>
            </ul>
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-center">
              <p className="text-sm text-slate-300">月額</p>
              <p className="text-3xl font-bold text-primary">¥4,980</p>
            </div>
            <Button asChild className="w-full"><Link href="/pricing">詳細を見る</Link></Button>
            <Button variant="ghost" onClick={() => setShowStandardModal(false)} className="w-full text-slate-400 bg-transparent">あとで</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* VIP Upgrade Modal */}
      <Dialog open={showVipModal} onOpenChange={setShowVipModal}>
        <DialogContent className="max-w-md border-primary/30 bg-gradient-to-br from-slate-900 to-black text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Crown className="h-6 w-6 text-primary" />
              VIPにアップグレード
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              SKR/HRフィルターを解除
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ul className="space-y-2 text-sm text-slate-200">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />SKR/HRフィルター解除</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />VIP専用掲示板</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />優先サポート</li>
            </ul>
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-center">
              <p className="text-sm text-slate-300">月額</p>
              <p className="text-3xl font-bold text-primary">¥14,980</p>
            </div>
            <Button asChild className="w-full"><Link href="/pricing">VIPに登録</Link></Button>
            <Button variant="ghost" onClick={() => setShowVipModal(false)} className="w-full text-slate-400 bg-transparent">あとで</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
