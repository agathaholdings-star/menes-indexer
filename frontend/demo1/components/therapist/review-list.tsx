"use client";

import { useState } from "react";
import Image from "next/image";
import { Lock, PenLine, Star, ChevronRight, Crown, X, Eye, Users, TrendingUp, Flame, Heart, Sparkles } from "lucide-react";
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

interface ReviewListProps {
  reviews: Review[];
  isLocked?: boolean;
  onWriteReview?: () => void;
  therapistName?: string;
  therapistAge?: number;
  therapistImage?: string;
}

export function ReviewList({ 
  reviews, 
  isLocked = true, 
  onWriteReview,
  therapistName = "田中まりあ",
  therapistAge = 24,
  therapistImage = "/placeholder.svg?height=100&width=100"
}: ReviewListProps) {
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const getTypeLabel = (id: string) => therapistTypes.find(t => t.id === id)?.label || id;
  const getBodyLabel = (id: string) => bodyTypes.find(b => b.id === id)?.label || id;
  const getServiceLabel = (id: string) => serviceTypes.find(s => s.id === id)?.label || id;

  const lockedCount = Math.max(reviews.length - 1, 0);
  const avgScore = reviews.length > 0 ? Math.round(reviews.reduce((acc, r) => acc + r.score, 0) / reviews.length) : 0;

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
                  今日{Math.floor(Math.random() * 50) + 30}人が閲覧
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {Math.floor(Math.random() * 20) + 10}人がお気に入り
                </span>
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
                onUnlock={() => setShowUnlockModal(true)}
                therapistName={therapistName}
                therapistAge={therapistAge}
                therapistImage={therapistImage}
                isPremium={index === 1}
                reviewIndex={index}
              />
            ))}
          </div>

          {/* Bottom CTA */}
          {isLocked && (
            <div className="p-4 bg-gradient-to-t from-primary/10 to-transparent border-t">
              <div className="text-center mb-3">
                <p className="text-sm text-muted-foreground">
                  <span className="text-primary font-bold">{lockedCount}件</span>の口コミが会員登録で読めます
                </p>
              </div>
              <Button 
                onClick={() => setShowUnlockModal(true)}
                className="w-full gap-2"
                size="lg"
              >
                <Sparkles className="h-4 w-4" />
                全ての口コミを読む
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unlock Modal */}
      <Dialog open={showUnlockModal} onOpenChange={setShowUnlockModal}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-primary to-primary/80 p-6 pb-4 text-white">
            <DialogTitle className="text-xl text-center text-white">口コミを見るためには</DialogTitle>
            <p className="text-center text-white/80 text-sm mt-1">
              全国14,500店舗の口コミ45万件以上が読める!
            </p>
          </DialogHeader>
          
          <div className="p-6">
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-center text-sm font-medium mb-3">- 無料会員 -</p>
                <div className="flex items-center justify-center gap-1 text-xs">
                  <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-center">
                    <span className="block font-bold">1</span>
                    <span>口コミ<br/>体験談を書く</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-center">
                    <span className="block font-bold">2</span>
                    <span>アカウント発行&<br/>口コミ閲覧日数付与</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <div className="bg-primary/80 text-primary-foreground rounded-lg px-3 py-2 text-center">
                    <span className="block font-bold">3</span>
                    <span>無料の口コミが<br/>閲覧可能に!</span>
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
                多くのユーザーから地雷回避や理想のセラピストと出会えたと好評!
              </p>
            </div>

            <div className="space-y-3">
              <Link href="/pricing" className="block">
                <Button className="w-full gap-2 h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80">
                  <Crown className="h-4 w-4" />
                  有料会員になって全ての口コミを読む
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
              <Button 
                onClick={() => {
                  setShowUnlockModal(false);
                  onWriteReview?.();
                }}
                variant="outline"
                className="w-full gap-2 h-12 border-primary text-primary hover:bg-primary/5 bg-transparent"
              >
                <PenLine className="h-4 w-4" />
                口コミを書いてモザイクを外す
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
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
  therapistName,
  therapistAge,
  therapistImage,
  isPremium = false,
  reviewIndex = 0,
}: {
  review: Review;
  getTypeLabel: (id: string) => string;
  getBodyLabel: (id: string) => string;
  getServiceLabel: (id: string) => string;
  isLocked?: boolean;
  onUnlock?: () => void;
  therapistName: string;
  therapistAge: number;
  therapistImage: string;
  isPremium?: boolean;
  reviewIndex?: number;
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
          <div className="text-xs text-muted-foreground mt-1">
            投稿者: <Link href="#" className="text-primary hover:underline">{review.userName}</Link>
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
                  <Lock className="h-4 w-4" />
                  モザイクを外すには
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Footer CTA */}
            <Link 
              href={`/therapist/1`} 
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
          </div>
        )}
      </div>
    </div>
  );
}
