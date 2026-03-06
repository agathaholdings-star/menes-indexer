"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, PenLine, Star, ChevronRight, Crown, Eye, TrendingUp, Flame, Heart, Sparkles, Unlock, Coins, Clock, ThumbsUp, Award, ArrowRight, CreditCard } from "lucide-react";
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
  isLocked?: boolean;
  onWriteReview?: () => void;
  onUnlockTherapist?: () => Promise<boolean | undefined>;
  reviewCredits?: number;
  therapistId?: string;
  therapistName?: string;
  therapistAge?: number;
  therapistImage?: string;
  shopName?: string;
}

export function ReviewList({
  reviews,
  isLocked = true,
  onWriteReview,
  onUnlockTherapist,
  reviewCredits = 0,
  therapistId,
  therapistName = "セラピスト",
  therapistAge = 0,
  therapistImage = "/placeholder.svg?height=100&width=100",
  shopName = "",
}: ReviewListProps) {
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const getTypeLabel = (id: string) => therapistTypes.find(t => t.id === id)?.label || id;
  const getBodyLabel = (id: string) => bodyTypes.find(b => b.id === id)?.label || id;
  const getServiceLabel = (id: string) => serviceTypes.find(s => s.id === id)?.label || id;

  const avgScore = reviews.length > 0 ? Math.round(reviews.reduce((acc, r) => acc + r.score, 0) / reviews.length) : 0;

  const handleUnlock = async () => {
    if (!onUnlockTherapist || unlockLoading) return;
    setUnlockLoading(true);
    const success = await onUnlockTherapist();
    setUnlockLoading(false);
    if (!success) {
      setShowUnlockModal(true);
    }
  };

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
            isLocked={isLocked}
            onUnlock={reviewCredits > 0 ? handleUnlock : () => setShowUnlockModal(true)}
            therapistId={therapistId}
            therapistName={therapistName}
            therapistAge={therapistAge}
            therapistImage={therapistImage}
            shopName={shopName}
            isPremium={index === 0}
            reviewCredits={reviewCredits}
          />
        ))}
      </div>

      {/* Bottom CTA (outside cards) */}
      {isLocked && reviews.length > 0 && (
        <div className="mt-4 p-4 bg-gradient-to-t from-primary/5 to-transparent rounded-lg border">
          <p className="text-center text-sm text-muted-foreground mb-3">
            あなたの体験が、誰かの「ハズレ回避」になります
          </p>
          {reviewCredits > 0 ? (
            <Button onClick={handleUnlock} disabled={unlockLoading} className="w-full gap-2" size="lg">
              <Unlock className="h-4 w-4" />口コミを読む
              <Badge variant="secondary" className="ml-2 text-xs bg-white/20 text-white border-0">残り{reviewCredits}</Badge>
            </Button>
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
                    <span>5人分の<br/>口コミが読める!</span>
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
                <TrendingUp className="h-4 w-4" />1件書けば5人分の口コミが読める（スクショ付き10人分）
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => { setShowUnlockModal(false); onWriteReview?.(); }}
                className="w-full gap-2 h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
              >
                <PenLine className="h-4 w-4" />あなたの体験を投稿して5クレジットGET<ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
              {therapistId && (
                <Button
                  variant="outline"
                  className="w-full gap-2 h-12 border-amber-500 text-amber-700 hover:bg-amber-50 bg-transparent"
                  onClick={async () => {
                    const res = await fetch("/api/checkout/single-unlock", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ therapist_id: therapistId }),
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  }}
                >
                  <CreditCard className="h-4 w-4" />¥1,000で永久アンロック<ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              )}
              <Link href="/pricing" className="block">
                <Button variant="outline" className="w-full gap-2 h-10 text-muted-foreground hover:text-foreground bg-transparent">
                  <Crown className="h-4 w-4" />有料会員になって読み放題（開発中）
                </Button>
              </Link>
              <Link href="/login" className="block">
                <Button variant="ghost" className="w-full text-muted-foreground h-10">既に会員の方はこちら</Button>
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
  isPremium = false,
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
  isPremium?: boolean;
  reviewCredits?: number;
}) {
  const scorePercent = review.score;
  const formattedDate = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString("ja-JP")
    : "";

  return (
    <Card className="overflow-hidden shadow-md">
      {/* バナー: サロン名 + セラピスト名 */}
      <div className="bg-gradient-to-r from-primary to-blue-600 px-5 py-3">
        <h3 className="text-white font-bold text-base">{shopName || "サロン"}</h3>
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
            {isPremium && (
              <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0 text-[10px] whitespace-nowrap">
                <Crown className="h-2.5 w-2.5 mr-0.5" />プレミアム口コミ
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
              {/* スコア円 */}
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
            </div>
          </div>
        </div>

        {/* 星バー + stats */}
        <div className="px-5 py-2 bg-blue-50/50 border-b flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">オススメ度</span>
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < Math.floor(review.score / 20) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
            ))}
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

            {/* セラピスト詳細リンク */}
            {therapistId && (
              <div className="p-4 border-t mt-4">
                <Link href={`/therapist/${therapistId}`}>
                  <Button className="w-full gap-2 bg-gradient-to-r from-primary to-blue-600" size="lg">
                    このセラピストの詳細を見る<ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
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
