"use client";

import { useState } from "react";
import Image from "next/image";
import { Lock, PenLine, Star, ChevronRight, Crown, Eye, TrendingUp, Flame, Heart, Sparkles, Unlock, Coins } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  therapistImage = "/placeholder.svg?height=100&width=100"
}: ReviewListProps) {
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const getTypeLabel = (id: string) => therapistTypes.find(t => t.id === id)?.label || id;
  const getBodyLabel = (id: string) => bodyTypes.find(b => b.id === id)?.label || id;
  const getServiceLabel = (id: string) => serviceTypes.find(s => s.id === id)?.label || id;

  const lockedCount = Math.max(reviews.length - 1, 0);
  const avgScore = reviews.length > 0 ? Math.round(reviews.reduce((acc, r) => acc + r.score, 0) / reviews.length) : 0;

  const handleUnlock = async () => {
    if (!onUnlockTherapist || unlockLoading) return;
    setUnlockLoading(true);
    const success = await onUnlockTherapist();
    setUnlockLoading(false);
    if (!success) {
      // クレジット不足 → モーダル表示
      setShowUnlockModal(true);
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">口コミ体験レポート</CardTitle>
              <Badge variant="secondary" className="text-xs">
                <Flame className="h-3 w-3 mr-1 text-orange-500" />
                HOT
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                平均{avgScore}点
              </span>
              <span>{reviews.length}件</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Teaser stats bar */}
          {isLocked && lockedCount > 0 && (
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {reviews.reduce((sum, r) => sum + (r.viewCount || 0), 0).toLocaleString()}回閲覧
                </span>
                {reviewCredits > 0 && (
                  <span className="flex items-center gap-1 text-primary font-medium">
                    <Coins className="h-3 w-3" />
                    残り{reviewCredits}クレジット
                  </span>
                )}
              </div>
              <Badge variant="outline" className="text-xs text-primary border-primary/30">
                <Lock className="h-3 w-3 mr-1" />
                {lockedCount}件の口コミがロック中
              </Badge>
            </div>
          )}

          <div className="divide-y">
            {reviews.map((review, index) => (
              <ReviewCard
                key={review.id}
                review={review}
                getTypeLabel={getTypeLabel}
                getBodyLabel={getBodyLabel}
                getServiceLabel={getServiceLabel}
                isLocked={isLocked && index > 0}
                onUnlock={reviewCredits > 0 ? handleUnlock : () => setShowUnlockModal(true)}
                therapistId={therapistId}
                therapistName={therapistName}
                therapistAge={therapistAge}
                therapistImage={therapistImage}
                isPremium={index === 1}
                reviewIndex={index}
                reviewCredits={reviewCredits}
              />
            ))}
          </div>

          {/* Bottom CTA */}
          {isLocked && (
            <div className="p-4 bg-gradient-to-t from-primary/10 to-transparent border-t">
              <div className="text-center mb-3">
                {reviewCredits > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="text-primary font-bold">1クレジット</span>でこのセラピストの口コミ
                    <span className="text-primary font-bold">{lockedCount}件</span>が全て読めます
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    口コミを書くと<span className="text-primary font-bold">10人分</span>のセラピスト口コミが読めます
                  </p>
                )}
              </div>
              {reviewCredits > 0 ? (
                <Button
                  onClick={handleUnlock}
                  disabled={unlockLoading}
                  className="w-full gap-2"
                  size="lg"
                >
                  <Unlock className="h-4 w-4" />
                  この子の口コミを読む
                  <Badge variant="secondary" className="ml-2 text-xs bg-white/20 text-white border-0">
                    残り{reviewCredits}
                  </Badge>
                </Button>
              ) : (
                <Button
                  onClick={() => setShowUnlockModal(true)}
                  className="w-full gap-2"
                  size="lg"
                >
                  <Sparkles className="h-4 w-4" />
                  口コミを書いて10人分読む
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                    <span>承認されると<br/>10クレジット獲得</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <div className="bg-primary/80 text-primary-foreground rounded-lg px-3 py-2 text-center">
                    <span className="block font-bold">3</span>
                    <span>10人分の<br/>口コミが読める!</span>
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
              <p>
                口コミを読むためには、あなたが体験したメンズエステの口コミ投稿をお願いしています。
              </p>
              <p className="flex items-center gap-1 text-primary font-medium">
                <TrendingUp className="h-4 w-4" />
                1件書けば10人分のセラピスト口コミが読める!
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => {
                  setShowUnlockModal(false);
                  onWriteReview?.();
                }}
                className="w-full gap-2 h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
              >
                <PenLine className="h-4 w-4" />
                口コミを書いて10クレジットGET
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
              <Link href="/pricing" className="block">
                <Button
                  variant="outline"
                  className="w-full gap-2 h-12 border-primary text-primary hover:bg-primary/5 bg-transparent"
                >
                  <Crown className="h-4 w-4" />
                  有料会員になって読み放題
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
              <Link href="/login" className="block">
                <Button variant="ghost" className="w-full text-muted-foreground h-10">
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

function ReviewCard({
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
  isPremium = false,
  reviewIndex = 0,
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
  isPremium?: boolean;
  reviewIndex?: number;
  reviewCredits?: number;
}) {
  return (
    <div className={`relative ${isLocked ? 'bg-gradient-to-b from-white to-muted/30' : ''}`}>
      {/* Premium badge for locked content */}
      {isLocked && isPremium && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0 gap-1">
            <Crown className="h-3 w-3" />
            プレミアム口コミ
          </Badge>
        </div>
      )}

      {/* Header with therapist photo, name, and score */}
      <div className="flex items-start gap-4 p-4 pb-3">
        <div className="relative flex-shrink-0">
          <Image
            src={therapistImage || "/placeholder.svg"}
            alt={therapistName}
            width={60}
            height={60}
            className="rounded-lg object-cover"
          />
          {review.score >= 90 && (
            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1">
              <Heart className="h-3 w-3 fill-current" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-primary">
              {therapistName} ({therapistAge})さん
            </span>
            <span className="text-xs text-muted-foreground">の口コミ体験レポート</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              オススメ度:
              <span className="flex">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={i < Math.floor(review.score / 20) ? "text-yellow-400" : "text-gray-300"}>
                    👍
                  </span>
                ))}
              </span>
            </span>
            <span>点数: <span className="text-primary font-bold">{review.score}</span>点</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              投稿者: <Link href="#" className="text-primary hover:underline">{review.userName || "匿名"}</Link>
              {(review.reviewerLevel || 0) > 0 && (
                <ReviewerLevelBadge level={review.reviewerLevel || 0} size="sm" />
              )}
              {review.userId && <FollowButton userId={review.userId} size="sm" />}
            </span>
            {(review.viewCount || 0) > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {(review.viewCount || 0).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          <Badge variant="outline" className="text-xs bg-white">{getTypeLabel(review.typeId)}</Badge>
          <Badge variant="outline" className="text-xs bg-white">{getBodyLabel(review.bodyType)}</Badge>
          <Badge variant="outline" className="text-xs bg-white">{getServiceLabel(review.serviceType)}</Badge>
        </div>

        {isLocked ? (
          <div className="relative">
            {/* Teaser text - visible */}
            <p className="text-sm leading-relaxed mb-2">
              {review.commentFirstImpression.slice(0, 50)}...
            </p>

            {/* Blurred/masked content with gradient fade */}
            <div className="relative">
              <div
                className="select-none pointer-events-none text-sm leading-relaxed space-y-2"
                style={{
                  filter: "blur(4px)",
                  WebkitFilter: "blur(4px)",
                }}
              >
                <p>
                  会話がとても楽しく、施術も丁寧。時間があっという間に過ぎました。技術もしっかりしていてコリがほぐれました。接客態度も素晴らしく、また指名したいと思いました。
                </p>
                <p>
                  人気なので予約は早めがおすすめ。土日は特に取りにくいです。駅からは少し歩きますが、お店の雰囲気は最高です。リピート確定ですね。
                </p>
              </div>

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white pointer-events-none" />

              {/* Unlock button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  onClick={onUnlock}
                  className="gap-2 shadow-xl hover:scale-105 transition-transform bg-gradient-to-r from-primary to-primary/90"
                  size="lg"
                >
                  {reviewCredits > 0 ? (
                    <>
                      <Unlock className="h-4 w-4" />
                      クレジットで読む
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      モザイクを外すには
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Footer CTA */}
            <Link
              href={therapistId ? `/therapist/${therapistId}` : "#"}
              className="flex items-center justify-center gap-2 mt-4 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              このセラピストの詳細を見る
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          /* Full content for unlocked reviews */
          <div className="space-y-3 text-sm">
            {review.commentReason && (
              <div>
                <p className="font-medium text-xs text-muted-foreground mb-1">きっかけ</p>
                <p className="leading-relaxed">{review.commentReason}</p>
              </div>
            )}
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">顔の印象</p>
              <p className="leading-relaxed">{review.commentFirstImpression}</p>
            </div>
            {review.commentStyle && (
              <div>
                <p className="font-medium text-xs text-muted-foreground mb-1">スタイル</p>
                <p className="leading-relaxed">{review.commentStyle}</p>
              </div>
            )}
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">施術の流れ</p>
              <p className="leading-relaxed">{review.commentService}</p>
            </div>
            {review.commentServiceDetail && (
              <div>
                <p className="font-medium text-xs text-muted-foreground mb-1">どこまでいけた</p>
                <p className="leading-relaxed">{review.commentServiceDetail}</p>
              </div>
            )}
            {review.commentCost && (
              <div>
                <p className="font-medium text-xs text-muted-foreground mb-1">お値段</p>
                <p className="leading-relaxed">{review.commentCost}</p>
              </div>
            )}
            {review.commentRevisit && (
              <div>
                <p className="font-medium text-xs text-muted-foreground mb-1">また行きたい？</p>
                <p className="leading-relaxed">{review.commentRevisit}</p>
              </div>
            )}
            {review.commentAdvice && (
              <div>
                <p className="font-medium text-xs text-muted-foreground mb-1">アドバイス</p>
                <p className="leading-relaxed text-muted-foreground">{review.commentAdvice}</p>
              </div>
            )}
            <div className="pt-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
              <ReviewVoteButtons
                reviewId={review.id}
                initialRealCount={review.realCount || 0}
                initialFakeCount={review.fakeCount || 0}
              />
              <HelpfulButton
                reviewId={review.id}
                initialHelpfulCount={review.helpfulCount || 0}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
