"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

interface HelpfulButtonProps {
  reviewId: string;
  initialHelpfulCount: number;
}

export function HelpfulButton({
  reviewId,
  initialHelpfulCount,
}: HelpfulButtonProps) {
  const { user } = useAuth();
  const [isHelpful, setIsHelpful] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(initialHelpfulCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/review-helpful?review_ids=${reviewId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data[reviewId]) {
          setIsHelpful(true);
        }
      })
      .catch(() => {});
  }, [user, reviewId]);

  const handleToggle = async () => {
    if (!user || loading) return;
    setLoading(true);

    if (isHelpful) {
      // 取消: 楽観的更新
      setIsHelpful(false);
      setHelpfulCount((c) => Math.max(c - 1, 0));

      const res = await fetch("/api/review-helpful", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_id: reviewId }),
      });
      if (!res.ok) {
        // ロールバック
        setIsHelpful(true);
        setHelpfulCount((c) => c + 1);
      }
    } else {
      // 追加: 楽観的更新
      setIsHelpful(true);
      setHelpfulCount((c) => c + 1);

      const res = await fetch("/api/review-helpful", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_id: reviewId }),
      });
      if (!res.ok) {
        // ロールバック
        setIsHelpful(false);
        setHelpfulCount((c) => Math.max(c - 1, 0));
      }
    }

    setLoading(false);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`gap-1.5 h-7 px-2 ${
        isHelpful
          ? "text-pink-500 bg-pink-50 hover:bg-pink-100"
          : "text-muted-foreground hover:text-pink-500"
      }`}
      onClick={handleToggle}
      disabled={loading || !user}
      title={user ? "参考になった" : "ログインが必要です"}
    >
      <Heart
        className={`h-3.5 w-3.5 ${isHelpful ? "fill-current" : ""}`}
      />
      <span className="font-medium">参考になった</span>
      <span>{helpfulCount}</span>
    </Button>
  );
}
