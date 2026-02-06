"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Sparkles, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
}

interface CompletionScreenProps {
  memberType?: "free" | "standard" | "vip";
  monthlyReviewCount?: number;
}

export function CompletionScreen({ memberType = "free", monthlyReviewCount = 0 }: CompletionScreenProps) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [showContent, setShowContent] = useState(false);

  const newCount = monthlyReviewCount + 1;
  const remaining = Math.max(0, 3 - newCount);

  useEffect(() => {
    const colors = ["#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#DBEAFE"];
    const pieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setConfetti(pieces);

    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Confetti */}
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="absolute top-0 w-3 h-3 rounded-sm animate-confetti"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}

      {/* Content */}
      <div
        className={cn(
          "flex flex-col items-center text-center transition-all duration-500",
          showContent ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )}
      >
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-primary" />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-amber-400 animate-pulse" />
        </div>

        {memberType === "free" && (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              ロック解除!
            </h1>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              口コミ投稿ありがとうございます！
              <br />
              <span className="text-primary font-semibold">3日間</span>
              すべての口コミが見放題になりました
            </p>
          </>
        )}

        {memberType === "standard" && (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              投稿ありがとうございます！
            </h1>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              今月の投稿: <span className="text-primary font-bold">{newCount}/3</span>本
            </p>
            {/* Progress bar */}
            <div className="w-full max-w-xs bg-muted rounded-full h-2.5 mb-3">
              <div
                className="bg-primary h-2.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, (newCount / 3) * 100)}%` }}
              />
            </div>
            {remaining > 0 ? (
              <p className="text-muted-foreground mb-8">
                あと<span className="text-primary font-bold">{remaining}本</span>でVIP機能解放！
              </p>
            ) : (
              <div className="mb-8">
                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 border-0 text-white gap-1 px-3 py-1">
                  <Crown className="h-3 w-3" />
                  VIP相当の全機能が解放されました！
                </Badge>
              </div>
            )}
          </>
        )}

        {memberType === "vip" && (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              投稿ありがとうございます！
            </h1>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              いつもご利用ありがとうございます！
            </p>
          </>
        )}

        <Link href="/" className="w-full max-w-xs">
          <Button className="w-full h-12 text-base font-semibold rounded-xl">
            ホームに戻る
          </Button>
        </Link>
      </div>
    </div>
  );
}
