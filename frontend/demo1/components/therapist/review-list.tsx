"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Lock, PenLine, Star, ChevronRight, Crown, Eye, TrendingUp, Flame, Heart, Sparkles, Unlock, Coins, Clock, ThumbsUp, Award, CreditCard, ShieldCheck, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { therapistTypes, bodyTypes, serviceTypes, type Review } from "@/lib/data";
import { ReviewVoteButtons } from "@/components/review/review-vote-buttons";
import { HelpfulButton } from "@/components/review/helpful-button";
import { ReviewerLevelBadge } from "@/components/shared/reviewer-level-badge";
import { FollowButton } from "@/components/shared/follow-button";

interface ReviewListProps {
  reviews: Review[];
  unlockedReviewIds?: Set<string>;
  onWriteReview?: () => void;
  onUnlockReview?: (reviewId: string) => Promise<boolean | undefined>;
  reviewCredits?: number;
  therapistId?: string;
  therapistName?: string;
  therapistAge?: number;
  therapistImage?: string;
  shopName?: string;
}

export function ReviewList({
  reviews,
  unlockedReviewIds = new Set(),
  onWriteReview,
  onUnlockReview,
  reviewCredits = 0,
  therapistId,
  therapistName = "セラピスト",
  therapistAge = 0,
  therapistImage = "/placeholder.svg?height=100&width=100",
  shopName = "",
}: ReviewListProps) {
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState<string | null>(null);

  // GA4 dataLayer push helper
  const pushEvent = useCallback((event: string, params?: Record<string, string | number | boolean>) => {
    if (typeof window !== "undefined" && (window as any).dataLayer) {
      (window as any).dataLayer.push({ event, ...params });
    }
  }, []);

  // Track modal view
  useEffect(() => {
    if (showUnlockModal) {
      pushEvent("unlock_modal_view", { therapist_id: therapistId || "", therapist_name: therapistName });
    }
  }, [showUnlockModal, pushEvent, therapistId, therapistName]);

  const getTypeLabel = (id: string) => therapistTypes.find(t => t.id === id)?.label || id;
  const getBodyLabel = (id: string) => bodyTypes.find(b => b.id === id)?.label || id;
  const getServiceLabel = (id: string) => serviceTypes.find(s => s.id === id)?.label || id;

  const avgScore = reviews.length > 0 ? Math.round(reviews.reduce((acc, r) => acc + r.score, 0) / reviews.length) : 0;

  const handleUnlock = async (reviewId: string) => {
    if (!onUnlockReview || unlockLoading) return;
    setUnlockLoading(reviewId);
    const success = await onUnlockReview(reviewId);
    setUnlockLoading(null);
    if (!success) {
      setShowUnlockModal(true);
    }
  };

  const hasAnyLocked = reviews.some(r => !unlockedReviewIds.has(r.id));

  return (
    <>
      <div className="space-y-4">
        {reviews.map((review, index) => (
          <ReviewCardA3a
            key={review.id}
            review={review}
            getTypeLabel={getTypeLabel}
            getBodyLabel={getBodyLabel}
            getServiceLabel={getServiceLabel}
            isLocked={!unlockedReviewIds.has(review.id)}
            onUnlock={reviewCredits > 0 ? () => handleUnlock(review.id) : () => setShowUnlockModal(true)}
            therapistId={therapistId}
            therapistName={therapistName}
            therapistAge={therapistAge}
            therapistImage={therapistImage}
            shopName={shopName}
            isVerified={!!review.verificationImagePath}
            reviewCredits={reviewCredits}
          />
        ))}
      </div>

      {/* Bottom CTA (outside cards) */}
      {hasAnyLocked && reviews.length > 0 && (
        <div className="mt-4 p-4 bg-gradient-to-t from-primary/5 to-transparent rounded-lg border">
          <p className="text-center text-sm text-muted-foreground mb-3">
            あなたの体験が、誰かの「ハズレ回避」になります
          </p>
          {reviewCredits > 0 ? (
            <p className="text-center text-sm font-medium text-primary">
              <Coins className="h-4 w-4 inline mr-1" />残り{reviewCredits}クレジット — 気になる口コミをタップしてアンロック
            </p>
          ) : (
            <Button onClick={onWriteReview} className="w-full gap-2" size="lg">
              <Sparkles className="h-4 w-4" />口コミを投稿して読む
            </Button>
          )}
        </div>
      )}

      {/* Unlock Modal */}
      <Dialog open={showUnlockModal} onOpenChange={setShowUnlockModal}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-primary to-primary/80 p-6 pb-4 text-white">
            <DialogTitle className="text-xl text-center text-white">口コミを読むには</DialogTitle>
            <p className="text-center text-white/80 text-sm mt-1">
              全国6,400以上の店舗の口コミが読める!
            </p>
          </DialogHeader>

          <div className="p-6">
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-center text-sm font-medium mb-3">- 無料で読む -</p>
                <div className="flex items-center justify-center gap-1 text-xs">
                  <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-center">
                    <span className="block font-bold">1</span>
                    <span>口コミ<br/>体験談を書く</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-center">
                    <span className="block font-bold">2</span>
                    <span>承認されると<br/>5クレジット獲得</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <div className="bg-primary/80 text-primary-foreground rounded-lg px-3 py-2 text-center">
                    <span className="block font-bold">3</span>
                    <span>5件の<br/>口コミが読める!</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-center text-sm font-medium mb-3">- 有料会員 -</p>
                <div className="flex items-center justify-center gap-1 text-xs">
                  <div className="bg-primary/70 text-primary-foreground rounded-lg px-4 py-2 text-center">
                    <span className="block font-bold">1</span>
                    <span>有料会員登録</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <div className="bg-primary/80 text-primary-foreground rounded-lg px-4 py-2 text-center">
                    <span className="block font-bold">2</span>
                    <span>即、口コミの閲覧が<br/>可能に!</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 mb-4 text-sm text-muted-foreground space-y-2">
              <p>あなたが体験した別のセラピストの口コミを投稿すると、クレジットで口コミが読めるようになります。</p>
              <p className="flex items-center gap-1 text-primary font-medium">
                <TrendingUp className="h-4 w-4" />1件書けば5件の口コミが読める（スクショ付き10件）
              </p>
            </div>

            <div className="space-y-3">
              {/* Primary CTA: 口コミ投稿（無料） */}
              <Button
                onClick={() => {
                  pushEvent("unlock_cta_click", { cta_type: "write_review", therapist_id: therapistId || "" });
                  pushEvent("unlock_method_selected", { method: "write_review" });
                  setShowUnlockModal(false);
                  onWriteReview?.();
                }}
                className="w-full gap-2 h-14 text-base font-bold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
              >
                <PenLine className="h-5 w-5" />
                <span className="flex flex-col items-start leading-tight">
                  <span>口コミを書いて無料で読む</span>
                  <span className="text-[10px] font-normal opacity-80">1件投稿で5件の口コミが読める</span>
                </span>
                <ChevronRight className="h-5 w-5 ml-auto flex-shrink-0" />
              </Button>

              {/* Secondary CTA: 単品購入 */}
              {therapistId && (
                <Button
                  variant="outline"
                  className="w-full gap-2 h-11 border-pink-300 text-pink-600 hover:bg-pink-50 bg-transparent font-medium"
                  onClick={async () => {
                    pushEvent("unlock_cta_click", { cta_type: "single_purchase", therapist_id: therapistId || "" });
                    pushEvent("unlock_method_selected", { method: "single_purchase" });
                    const res = await fetch("/api/checkout/single-unlock", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ therapist_id: therapistId }),
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  }}
                >
                  <CreditCard className="h-4 w-4" />¥1,000でこのセラピストを永久アンロック
                </Button>
              )}

              {/* Tertiary CTA: 有料会員 */}
              <Link href="/pricing" className="block">
                <Button
                  variant="ghost"
                  className="w-full gap-2 h-9 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    pushEvent("unlock_cta_click", { cta_type: "premium_membership", therapist_id: therapistId || "" });
                    pushEvent("unlock_method_selected", { method: "premium_membership" });
                  }}
                >
                  <Crown className="h-3.5 w-3.5" />有料会員で読み放題（開発中）
                </Button>
              </Link>

              <Link href="/login" className="block">
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground h-9 text-xs"
                  onClick={() => pushEvent("unlock_cta_click", { cta_type: "login", therapist_id: therapistId || "" })}
                >
                  既に会員の方はこちら
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ============================================================
   A-3a ReviewCard: サロン名バナー + セラピスト名 + 写真大 + スコア円
   ============================================================ */
function ReviewCardA3a({
  review,
  getTypeLabel,
  getBodyLabel,
  getServiceLabel,
  isLocked = false,
  onUnlock,
  therapistId,
  therapistName,
  therapistAge,
  therapistImage,
  shopName,
  isVerified = false,
  reviewCredits = 0,
}: {
  review: Review;
  getTypeLabel: (id: string) => string;
  getBodyLabel: (id: string) => string;
  getServiceLabel: (id: string) => string;
  isLocked?: boolean;
  onUnlock?: () => void;
  therapistId?: string;
  therapistName: string;
  therapistAge: number;
  therapistImage: string;
  shopName: string;
  isVerified?: boolean;
  reviewCredits?: number;
}) {
  const scorePercent = review.score;
  const formattedDate = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString("ja-JP")
    : "";

  return (
    <Card className="overflow-hidden shadow-md relative">
      {/* Pattern C: リッチバッジ（右上） */}
      {isVerified && (
        <div className="absolute top-2 right-2 z-10">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-[10px] font-bold shadow-lg">
            <Camera className="h-3 w-3" />
            REAL
          </div>
        </div>
      )}

      {/* バナー: サロン名 + セラピスト名 */}
      <div className="bg-gradient-to-r from-primary to-blue-600 px-5 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-base">{shopName || "サロン"}</h3>
          {/* Pattern B: アイコン+テキスト付きバッジ（バナー内） */}
          {isVerified && (
            <Badge className="bg-yellow-400/30 text-yellow-100 border-0 text-[10px] gap-1 hover:bg-yellow-400/40">
              <ShieldCheck className="h-3 w-3" />確認済みレビュー
            </Badge>
          )}
        </div>
        <p className="text-blue-100 text-sm mt-0.5">
          <span className="text-white font-bold">{therapistName}{therapistAge > 0 ? ` (${therapistAge})` : ""}</span> さんの口コミ体験レポート
        </p>
      </div>

      <CardContent className="p-0">
        {/* 写真大 + スコア円 */}
        <div className="p-5 flex gap-5 border-b">
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={therapistImage || "/placeholder.svg"}
              alt={therapistName}
              className="w-28 h-28 rounded-xl object-cover shadow-md"
              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
            />
            {/* Pattern A: シンプルテキストバッジ（画像下） */}
            {isVerified && (
              <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white border-0 text-[10px] whitespace-nowrap gap-0.5">
                <ShieldCheck className="h-2.5 w-2.5" />スクショ確認済み
              </Badge>
            )}
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex gap-1 mt-1">
                <Badge variant="secondary" className="text-[10px]">{getTypeLabel(review.typeId)}</Badge>
                <Badge variant="secondary" className="text-[10px]">{getBodyLabel(review.bodyType)}</Badge>
                <Badge variant="secondary" className="text-[10px]">{getServiceLabel(review.serviceType)}</Badge>
              </div>
            </div>
            <div className="flex items-end justify-between mt-2">
              <div className="text-xs text-muted-foreground">
                <p>投稿者: <span className="text-primary font-medium">{review.userName || "匿名"}</span>
                  {(review.reviewerLevel || 0) > 0 && (
                    <span className="ml-1"><ReviewerLevelBadge level={review.reviewerLevel || 0} size="sm" /></span>
                  )}
                </p>
                {formattedDate && (
                  <p className="flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />{formattedDate}
                  </p>
                )}
              </div>
              {/* スコア円: isLocked なら非表示 */}
              {isLocked ? (
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[8px] text-muted-foreground">非公開</span>
                  </div>
                </div>
              ) : (
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray={`${scorePercent}, 100`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-primary leading-none">{review.score}</span>
                    <span className="text-[8px] text-muted-foreground">/ 100</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 星バー + stats */}
        <div className="px-5 py-2 bg-blue-50/50 border-b flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">オススメ度</span>
            {isLocked ? (
              <>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-gray-200" />
                ))}
                <span className="text-[10px] text-muted-foreground ml-1">アンロックで表示</span>
              </>
            ) : (
              [...Array(5)].map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < Math.floor(review.score / 20) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
              ))
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {(review.viewCount || 0) > 0 && (
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{(review.viewCount || 0).toLocaleString()}</span>
            )}
            {(review.helpfulCount || 0) > 0 && (
              <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{review.helpfulCount}</span>
            )}
          </div>
        </div>

        {isLocked ? (
          <>
            {/* ティーザー */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-sm leading-relaxed">{review.commentFirstImpression.slice(0, 80)}...</p>
            </div>

            {/* ぼかし */}
            <div className="relative px-5">
              <div className="select-none pointer-events-none text-sm leading-relaxed space-y-3" style={{ filter: "blur(5px)" }}>
                <div><p className="font-medium text-xs text-muted-foreground mb-1">スタイル</p><p>会話がとても楽しく、施術も丁寧。時間があっという間に過ぎました。技術もしっかりしていてコリがほぐれました。接客態度も素晴らしく、また指名したいと思いました。</p></div>
                <div><p className="font-medium text-xs text-muted-foreground mb-1">施術の流れ</p><p>シャワー浴びて横になったら、足からマッサージスタート。本格的すぎて全然ドキドキしなかった。ってか足ツボが痛すぎて叫びそうになったレベル。</p></div>
                <div><p className="font-medium text-xs text-muted-foreground mb-1">どこまでいけた</p><p>金額は覚えてないけど、このお店の通常料金。ただ、足ツボマッサージに高い金払った感じで全然コスパ良くなかった。</p></div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  onClick={onUnlock}
                  className="gap-2 shadow-2xl bg-primary hover:bg-primary/90 hover:scale-105 transition-transform"
                  size="lg"
                >
                  {reviewCredits > 0 ? (
                    <><Unlock className="h-4 w-4" />クレジットで読む</>
                  ) : (
                    <><Lock className="h-4 w-4" />モザイクを外すには<ChevronRight className="h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </div>

          </>
        ) : (
          /* フルコンテンツ */
          <div className="px-5 pt-4 pb-4 space-y-3 text-sm">
            {review.commentReason && (
              <div><p className="font-medium text-xs text-muted-foreground mb-1">きっかけ</p><p className="leading-relaxed">{review.commentReason}</p></div>
            )}
            <div><p className="font-medium text-xs text-muted-foreground mb-1">顔の印象</p><p className="leading-relaxed">{review.commentFirstImpression}</p></div>
            {review.commentStyle && (
              <div><p className="font-medium text-xs text-muted-foreground mb-1">スタイル</p><p className="leading-relaxed">{review.commentStyle}</p></div>
            )}
            <div><p className="font-medium text-xs text-muted-foreground mb-1">施術の流れ</p><p className="leading-relaxed">{review.commentService}</p></div>
            {review.commentServiceDetail && (
              <div><p className="font-medium text-xs text-muted-foreground mb-1">どこまでいけた</p><p className="leading-relaxed">{review.commentServiceDetail}</p></div>
            )}
            {review.commentCost && (
              <div><p className="font-medium text-xs text-muted-foreground mb-1">お値段</p><p className="leading-relaxed">{review.commentCost}</p></div>
            )}
            {review.commentRevisit && (
              <div><p className="font-medium text-xs text-muted-foreground mb-1">また行きたい？</p><p className="leading-relaxed">{review.commentRevisit}</p></div>
            )}
            {review.commentAdvice && (
              <div><p className="font-medium text-xs text-muted-foreground mb-1">アドバイス</p><p className="leading-relaxed text-muted-foreground">{review.commentAdvice}</p></div>
            )}
            <div className="pt-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
              <ReviewVoteButtons reviewId={review.id} initialRealCount={review.realCount || 0} initialFakeCount={review.fakeCount || 0} />
              <HelpfulButton reviewId={review.id} initialHelpfulCount={review.helpfulCount || 0} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
