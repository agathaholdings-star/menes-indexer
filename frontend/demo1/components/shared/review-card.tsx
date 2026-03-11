"use client";

import Link from "next/link";
import { Star, Lock, Crown, Clock, Eye, ThumbsUp, ChevronRight, ArrowRight, ShieldCheck, Camera } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { therapistTypes, bodyTypes, serviceTypes, type Review } from "@/lib/data";
import { ReviewVoteButtons } from "@/components/review/review-vote-buttons";
import { HelpfulButton } from "@/components/review/helpful-button";
import { ReviewerLevelBadge } from "@/components/shared/reviewer-level-badge";

interface ReviewCardProps {
  review: Review;
  isBlurred?: boolean;
  showTherapist?: boolean;
  variant?: "default" | "detailed";
  therapistImageUrl?: string;
  onBlurClick?: () => void;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("ja-JP");
  } catch {
    return dateStr;
  }
}

export function ReviewCard({ review, isBlurred = false, showTherapist = true, variant = "default", therapistImageUrl, onBlurClick }: ReviewCardProps) {
  const typeLabel = therapistTypes.find((t) => t.id === review.typeId)?.label || review.typeId;
  const bodyLabel = bodyTypes.find((b) => b.id === review.bodyType)?.label || review.bodyType;
  const serviceLabel = serviceTypes.find((s) => s.id === review.serviceType)?.label || review.serviceType;
  const formattedDate = formatDate(review.createdAt);
  const scorePercent = review.score;
  const isVerified = !!review.verificationImagePath;

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
          <h3 className="text-white font-bold text-base">{review.salonName || "サロン"}</h3>
          {/* Pattern B: アイコン+テキスト付きバッジ（バナー内） */}
          {isVerified && (
            <Badge className="bg-yellow-400/30 text-yellow-100 border-0 text-[10px] gap-1 hover:bg-yellow-400/40">
              <ShieldCheck className="h-3 w-3" />確認済みレビュー
            </Badge>
          )}
        </div>
        <p className="text-blue-100 text-sm mt-0.5">
          <span className="text-white font-bold">{review.therapistName}</span> さんの口コミ体験レポート
        </p>
      </div>

      <CardContent className="p-0">
        {/* 写真大 + スコア円 */}
        <div className="p-5 flex gap-5 border-b">
          <div className="relative flex-shrink-0">
            {therapistImageUrl ? (
              <Link href={`/therapist/${review.therapistId}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={therapistImageUrl}
                  alt={review.therapistName}
                  className="w-28 h-28 rounded-xl object-cover shadow-md"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                />
              </Link>
            ) : (
              <div className="w-28 h-28 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-xs">
                No Image
              </div>
            )}
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
                <Badge variant="secondary" className="text-[10px]">{typeLabel}</Badge>
                <Badge variant="secondary" className="text-[10px]">{bodyLabel}</Badge>
                <Badge variant="secondary" className="text-[10px]">{serviceLabel}</Badge>
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
                  <p className="flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" />{formattedDate}</p>
                )}
              </div>
              {/* スコア円: isBlurred なら非表示 */}
              {isBlurred ? (
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

        {/* 星バー */}
        <div className="px-5 py-2 bg-blue-50/50 border-b flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">オススメ度</span>
            {isBlurred ? (
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

        {isBlurred ? (
          <>
            <div className="px-5 pt-4 pb-2">
              {(() => {
                const previewText = review.commentFirstImpression || review.commentReason || review.commentStyle || review.commentService || "";
                return previewText ? (
                  <p className="text-sm leading-relaxed">{previewText.slice(0, 80)}...</p>
                ) : null;
              })()}
            </div>
            <div className="relative px-5">
              <div className="select-none pointer-events-none text-sm leading-relaxed space-y-3" style={{ filter: "blur(5px)" }}>
                <p>会話がとても楽しく、施術も丁寧。時間があっという間に過ぎました。技術もしっかりしていてコリがほぐれました。</p>
                <p>シャワー浴びて横になったら、足からマッサージスタート。本格的すぎて全然ドキドキしなかった。</p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  onClick={onBlurClick}
                  className="gap-2 shadow-2xl bg-primary hover:bg-primary/90 hover:scale-105 transition-transform"
                  size="lg"
                >
                  <Lock className="h-4 w-4" />モザイクを外すには<ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="px-5 pt-4 pb-4 space-y-3 text-sm">
            <div><p className="font-medium text-xs text-muted-foreground mb-1">顔の印象</p><p className="leading-relaxed">{review.commentFirstImpression}</p></div>
            <div><p className="font-medium text-xs text-muted-foreground mb-1">施術の流れ</p><p className="leading-relaxed">{review.commentService}</p></div>
            {review.commentAdvice && (
              <div><p className="font-medium text-xs text-muted-foreground mb-1">アドバイス</p><p className="leading-relaxed text-muted-foreground">{review.commentAdvice}</p></div>
            )}
            <div className="pt-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
              <ReviewVoteButtons reviewId={review.id} initialRealCount={review.realCount || 0} initialFakeCount={review.fakeCount || 0} />
              <HelpfulButton reviewId={review.id} initialHelpfulCount={review.helpfulCount || 0} />
            </div>
          </div>
        )}

        {/* セラピスト詳細リンク */}
        {showTherapist && (
          <div className="p-4 border-t">
            <Link href={`/therapist/${review.therapistId}`}>
              <Button className="w-full gap-2 bg-gradient-to-r from-primary to-blue-600" size="lg">
                このセラピストの詳細を見る<ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
