"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
}

export function CompletionScreen() {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Generate confetti pieces
    const colors = ["#E11D48", "#FB7185", "#F43F5E", "#FDA4AF", "#FFE4E6"];
    const pieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setConfetti(pieces);

    // Show content after a brief delay
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

        <h1 className="text-2xl font-bold text-foreground mb-3">
          ロック解除!
        </h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          口コミ投稿ありがとうございます！
          <br />
          <span className="text-primary font-semibold">24時間</span>
          すべての口コミが見放題になりました
        </p>

        <Link href="/" className="w-full max-w-xs">
          <Button className="w-full h-12 text-base font-semibold rounded-xl">
            ホームに戻る
          </Button>
        </Link>
      </div>
    </div>
  );
}
