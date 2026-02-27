"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

interface ReviewVoteButtonsProps {
  reviewId: string;
  initialRealCount: number;
  initialFakeCount: number;
}

export function ReviewVoteButtons({
  reviewId,
  initialRealCount,
  initialFakeCount,
}: ReviewVoteButtonsProps) {
  const { user } = useAuth();
  const [myVote, setMyVote] = useState<"real" | "fake" | null>(null);
  const [realCount, setRealCount] = useState(initialRealCount);
  const [fakeCount, setFakeCount] = useState(initialFakeCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/review-votes?review_ids=${reviewId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data[reviewId]) {
          setMyVote(data[reviewId] as "real" | "fake");
        }
      })
      .catch(() => {});
  }, [user, reviewId]);

  const handleVote = async (voteType: "real" | "fake") => {
    if (!user || loading) return;
    setLoading(true);

    if (myVote === voteType) {
      // トグルオフ: 投票取消
      const prevVote = myVote;
      setMyVote(null);
      if (voteType === "real") setRealCount((c) => Math.max(c - 1, 0));
      else setFakeCount((c) => Math.max(c - 1, 0));

      const res = await fetch("/api/review-votes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_id: reviewId }),
      });
      if (!res.ok) {
        // ロールバック
        setMyVote(prevVote);
        if (voteType === "real") setRealCount((c) => c + 1);
        else setFakeCount((c) => c + 1);
      }
    } else {
      // 新規投票 or 変更
      const prevVote = myVote;
      const prevReal = realCount;
      const prevFake = fakeCount;

      // 楽観的更新
      if (prevVote === "real") setRealCount((c) => Math.max(c - 1, 0));
      if (prevVote === "fake") setFakeCount((c) => Math.max(c - 1, 0));
      if (voteType === "real") setRealCount((c) => c + 1);
      else setFakeCount((c) => c + 1);
      setMyVote(voteType);

      const res = await fetch("/api/review-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_id: reviewId, vote_type: voteType }),
      });
      if (!res.ok) {
        // ロールバック
        setMyVote(prevVote);
        setRealCount(prevReal);
        setFakeCount(prevFake);
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <Button
        variant="ghost"
        size="sm"
        className={`gap-1.5 h-7 px-2 ${
          myVote === "real"
            ? "text-green-600 bg-green-50 hover:bg-green-100"
            : "text-muted-foreground hover:text-green-600"
        }`}
        onClick={() => handleVote("real")}
        disabled={loading || !user}
        title={user ? "この口コミは信頼できる" : "ログインが必要です"}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        <span className="font-medium">REAL</span>
        <span>{realCount}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`gap-1.5 h-7 px-2 ${
          myVote === "fake"
            ? "text-red-600 bg-red-50 hover:bg-red-100"
            : "text-muted-foreground hover:text-red-600"
        }`}
        onClick={() => handleVote("fake")}
        disabled={loading || !user}
        title={user ? "この口コミは怪しい" : "ログインが必要です"}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
        <span className="font-medium">FAKE</span>
        <span>{fakeCount}</span>
      </Button>
    </div>
  );
}
