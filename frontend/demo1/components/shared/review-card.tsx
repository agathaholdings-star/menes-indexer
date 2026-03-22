"use client";

import Link from "next/link";
import { Star, Lock, Crown, Clock, Eye, ThumbsUp, ChevronRight, ArrowRight, ShieldCheck, Camera, MessageSquare, Quote } from "lucide-react";
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
  cardStyle?: "default" | "magazine" | "compact" | "social";
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

function ScoreCircle({ score, isBlurred, size = "md" }: { score: number; isBlurred: boolean; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-12 h-12" : "w-16 h-16";
  const textSize = size === "sm" ? "text-sm" : "text-lg";
  const subSize = size === "sm" ? "text-[6px]" : "text-[8px]";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  if (isBlurred) {
    return (
      <div className={`relative ${dim}`}>
        <svg className={`${dim} -rotate-90`} viewBox="0 0 36 36">
          <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Lock className={`${iconSize} text-muted-foreground`} />
          <span className={`${subSize} text-muted-foreground`}>非公開</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`relative ${dim}`}>
      <svg className={`${dim} -rotate-90`} viewBox="0 0 36 36">
        <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray={`${score}, 100`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${textSize} font-bold text-primary leading-none`}>{score}</span>
        <span className={`${subSize} text-muted-foreground`}>/ 100</span>
      </div>
    </div>
  );
}

function StarRating({ score, isBlurred }: { score: number; isBlurred: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      {isBlurred ? (
        [...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 text-gray-200" />)
      ) : (
        [...Array(5)].map((_, i) => (
          <Star key={i} className={`h-3.5 w-3.5 ${i < Math.floor(score / 20) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
        ))
      )}
    </div>
  );
}

function BlurredContent({ review, onBlurClick }: { review: Review; onBlurClick?: () => void }) {
  const previewText = review.commentFirstImpression || review.commentReason || review.commentStyle || review.commentService || "";
  return (
    <>
      {previewText && (
        <p className="text-sm leading-relaxed mb-2">{previewText.slice(0, 80)}...</p>
      )}
      <div className="relative">
        <div className="select-none pointer-events-none text-sm leading-relaxed space-y-3" style={{ filter: "blur(5px)" }}>
          {review.commentStyle && <p>{review.commentStyle}</p>}
          {review.commentService && <p>{review.commentService}</p>}
          {!review.commentStyle && !review.commentService && (
            <p>この口コミの続きはアンロックすると読めます。投稿者による詳細な体験レポートをお楽しみください。</p>
          )}
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
  );
}

function FullContent({ review }: { review: Review }) {
  return (
    <div className="space-y-3 text-sm">
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
  );
}

function TherapistLink({ review }: { review: Review }) {
  return (
    <div className="p-4 border-t">
      <Link href={`/therapist/${review.therapistId}`}>
        <Button className="w-full gap-2 bg-gradient-to-r from-primary to-blue-600" size="lg">
          このセラピストの詳細を見る<ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}

function TagBadges({ typeLabel, bodyLabel, serviceLabel }: { typeLabel: string; bodyLabel: string; serviceLabel: string }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {typeLabel && <Badge variant="secondary" className="text-[10px]">{typeLabel}</Badge>}
      {bodyLabel && <Badge variant="secondary" className="text-[10px]">{bodyLabel}</Badge>}
      {serviceLabel && <Badge variant="secondary" className="text-[10px]">{serviceLabel}</Badge>}
    </div>
  );
}

function VerifiedBadge() {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-[10px] font-bold shadow-lg">
      <Camera className="h-3 w-3" />REAL
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pattern 1: Default（現行）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function DefaultCard({ review, isBlurred, showTherapist, therapistImageUrl, onBlurClick, typeLabel, bodyLabel, serviceLabel, formattedDate, isVerified }: CardInternalProps) {
  return (
    <Card className="overflow-hidden shadow-md relative p-0 gap-0">
      {isVerified && <div className="absolute top-2 right-2 z-10"><VerifiedBadge /></div>}

      <div className="bg-gradient-to-r from-primary to-blue-600 px-5 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-base">{review.salonName || "サロン"}</h3>
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
        <div className="p-5 flex gap-5 border-b">
          <div className="relative flex-shrink-0">
            {therapistImageUrl ? (
              <Link href={`/therapist/${review.therapistId}`}>
                <img src={therapistImageUrl} alt={review.therapistName} className="w-28 h-28 rounded-xl object-cover shadow-md" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
              </Link>
            ) : (
              <div className="w-28 h-28 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-xs">No Image</div>
            )}
            {isVerified && (
              <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white border-0 text-[10px] whitespace-nowrap gap-0.5">
                <ShieldCheck className="h-2.5 w-2.5" />スクショ確認済み
              </Badge>
            )}
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <TagBadges typeLabel={typeLabel} bodyLabel={bodyLabel} serviceLabel={serviceLabel} />
            <div className="flex items-end justify-between mt-2">
              <div className="text-xs text-muted-foreground">
                <p>投稿者: <span className="text-primary font-medium">{review.userName || "匿名"}</span>
                  {(review.reviewerLevel || 0) > 0 && <span className="ml-1"><ReviewerLevelBadge level={review.reviewerLevel || 0} size="sm" /></span>}
                </p>
                {formattedDate && <p className="flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" />{formattedDate}</p>}
              </div>
              <ScoreCircle score={review.score} isBlurred={isBlurred} />
            </div>
          </div>
        </div>

        <div className="px-5 py-2 bg-blue-50/50 border-b flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">オススメ度</span>
            <StarRating score={review.score} isBlurred={isBlurred} />
            {isBlurred && <span className="text-[10px] text-muted-foreground ml-1">アンロックで表示</span>}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {(review.viewCount || 0) > 0 && <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{(review.viewCount || 0).toLocaleString()}</span>}
            {(review.helpfulCount || 0) > 0 && <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{review.helpfulCount}</span>}
          </div>
        </div>

        <div className="px-5 pt-4 pb-4">
          {isBlurred ? <BlurredContent review={review} onBlurClick={onBlurClick} /> : <FullContent review={review} />}
        </div>

        {showTherapist && <TherapistLink review={review} />}
      </CardContent>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pattern 2: Magazine（雑誌風）
// 大きな画像ヘッダー + 引用風テキスト + グラデーションフェード
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function MagazineCard({ review, isBlurred, showTherapist, therapistImageUrl, onBlurClick, typeLabel, bodyLabel, serviceLabel, formattedDate, isVerified }: CardInternalProps) {
  const previewText = review.commentFirstImpression || review.commentService || "";

  return (
    <Card className="overflow-hidden shadow-lg relative p-0 gap-0 group">
      {/* ヒーロー画像エリア */}
      <div className="relative h-48 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
        {therapistImageUrl ? (
          <img
            src={therapistImageUrl}
            alt={review.therapistName}
            className="w-full h-full object-cover opacity-60 group-hover:opacity-70 transition-opacity group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* 左上バッジ */}
        <div className="absolute top-3 left-4 flex items-center gap-2">
          {isVerified && <VerifiedBadge />}
          <TagBadges typeLabel={typeLabel} bodyLabel={bodyLabel} serviceLabel={serviceLabel} />
        </div>

        {/* 右上スコア */}
        <div className="absolute top-3 right-4">
          <ScoreCircle score={review.score} isBlurred={isBlurred} size="sm" />
        </div>

        {/* 下部テキスト */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-white/70 text-xs">{review.salonName}</p>
          <h3 className="text-white text-xl font-bold mt-0.5">
            <Link href={`/therapist/${review.therapistId}`} className="hover:underline">
              {review.therapistName}
            </Link>
            <span className="text-white/60 text-sm font-normal ml-2">さんの体験レポート</span>
          </h3>
          <div className="flex items-center gap-3 mt-2 text-white/60 text-xs">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formattedDate}</span>
            <span>投稿者: {review.userName || "匿名"}</span>
            <StarRating score={review.score} isBlurred={isBlurred} />
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        {/* 引用風プレビュー */}
        <div className="px-6 pt-5 pb-4">
          {isBlurred ? (
            <BlurredContent review={review} onBlurClick={onBlurClick} />
          ) : (
            <>
              <div className="border-l-4 border-primary/30 pl-4 mb-4">
                <Quote className="h-5 w-5 text-primary/30 mb-2" />
                <p className="text-base leading-relaxed italic text-foreground/80">
                  {previewText.slice(0, 120)}{previewText.length > 120 ? "..." : ""}
                </p>
              </div>
              <FullContent review={review} />
            </>
          )}
        </div>

        {/* エンゲージメント */}
        <div className="px-6 py-3 bg-muted/30 border-t flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {(review.viewCount || 0) > 0 && <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{(review.viewCount || 0).toLocaleString()}回閲覧</span>}
            {(review.helpfulCount || 0) > 0 && <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{review.helpfulCount}人が参考</span>}
          </div>
        </div>

        {showTherapist && <TherapistLink review={review} />}
      </CardContent>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pattern 3: Compact（ME競合風・横並び）
// 画像左 + 情報右 + テキストプレビュー + 「続きを読む」
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CompactCard({ review, isBlurred, showTherapist, therapistImageUrl, onBlurClick, typeLabel, bodyLabel, serviceLabel, formattedDate, isVerified }: CardInternalProps) {
  const previewText = review.commentFirstImpression || review.commentService || "";

  return (
    <Card className="overflow-hidden shadow-md p-0 gap-0">
      <CardContent className="p-0">
        {/* メインエリア: 画像左 + 情報右 */}
        <div className="flex">
          {/* 左: 画像 */}
          <div className="relative w-32 sm:w-40 flex-shrink-0">
            {therapistImageUrl ? (
              <Link href={`/therapist/${review.therapistId}`}>
                <img
                  src={therapistImageUrl}
                  alt={review.therapistName}
                  className="w-full h-full object-cover min-h-[160px]"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                />
              </Link>
            ) : (
              <div className="w-full h-full min-h-[160px] bg-muted flex items-center justify-center text-muted-foreground text-xs">No Photo</div>
            )}
            {isVerified && (
              <div className="absolute top-2 left-2">
                <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0 text-[9px] gap-0.5 shadow-md">
                  <ShieldCheck className="h-2.5 w-2.5" />確認済み
                </Badge>
              </div>
            )}
          </div>

          {/* 右: テキスト情報 */}
          <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
            {/* サロン + セラピスト名 */}
            <div>
              <p className="text-xs text-muted-foreground truncate">{review.salonName}</p>
              <h3 className="font-bold text-base mt-0.5">
                <Link href={`/therapist/${review.therapistId}`} className="hover:text-primary transition-colors">
                  {review.therapistName}
                </Link>
                <span className="text-muted-foreground text-xs font-normal ml-1">さんの口コミ</span>
              </h3>

              {/* 星 + スコア */}
              <div className="flex items-center gap-2 mt-1.5">
                <StarRating score={review.score} isBlurred={isBlurred} />
                {!isBlurred && <span className="text-sm font-bold text-primary">{review.score}点</span>}
                {isBlurred && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Lock className="h-3 w-3" />非公開</span>}
              </div>

              {/* タグ */}
              <div className="mt-1.5">
                <TagBadges typeLabel={typeLabel} bodyLabel={bodyLabel} serviceLabel={serviceLabel} />
              </div>
            </div>

            {/* 投稿者 + 日付 */}
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>
                投稿者: <span className="text-primary font-medium">{review.userName || "匿名"}</span>
                {(review.reviewerLevel || 0) > 0 && <span className="ml-1"><ReviewerLevelBadge level={review.reviewerLevel || 0} size="sm" /></span>}
              </span>
              {formattedDate && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formattedDate}</span>}
            </div>
          </div>
        </div>

        {/* テキストプレビュー */}
        <div className="px-5 pt-3 pb-4 border-t">
          {isBlurred ? (
            <BlurredContent review={review} onBlurClick={onBlurClick} />
          ) : (
            <>
              <p className="text-sm leading-relaxed line-clamp-3">{previewText}</p>
              <Link
                href={`/therapist/${review.therapistId}`}
                className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-muted/50 hover:bg-muted text-sm text-primary font-medium transition-colors"
              >
                続きを読む<ChevronRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pattern 4: Social（SNS投稿風）
// 丸アバター + チャットバブル + エンゲージメント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SocialCard({ review, isBlurred, showTherapist, therapistImageUrl, onBlurClick, typeLabel, bodyLabel, serviceLabel, formattedDate, isVerified }: CardInternalProps) {
  const previewText = review.commentFirstImpression || review.commentService || "";

  return (
    <Card className="overflow-hidden shadow-md p-0 gap-0">
      <CardContent className="p-0">
        {/* ヘッダー: アバター + 投稿者情報（SNS投稿風） */}
        <div className="px-4 pt-4 pb-3 flex items-start gap-3">
          {/* 投稿者アバター（セラピスト画像を丸く） */}
          <Link href={`/therapist/${review.therapistId}`} className="flex-shrink-0">
            {therapistImageUrl ? (
              <img
                src={therapistImageUrl}
                alt={review.therapistName}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20"
                onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px]">
                <MessageSquare className="h-5 w-5" />
              </div>
            )}
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <Link href={`/therapist/${review.therapistId}`} className="font-bold text-sm hover:text-primary transition-colors">
                  {review.therapistName}
                </Link>
                <span className="text-xs text-muted-foreground ml-1">@ {review.salonName}</span>
              </div>
              {isVerified && <VerifiedBadge />}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formattedDate}</span>
              <span>by {review.userName || "匿名"}</span>
              {(review.reviewerLevel || 0) > 0 && <ReviewerLevelBadge level={review.reviewerLevel || 0} size="sm" />}
            </div>
          </div>
        </div>

        {/* タグ + スコア行 */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TagBadges typeLabel={typeLabel} bodyLabel={bodyLabel} serviceLabel={serviceLabel} />
          </div>
          <div className="flex items-center gap-2">
            <StarRating score={review.score} isBlurred={isBlurred} />
            {!isBlurred && <span className="text-xs font-bold text-primary">{review.score}</span>}
          </div>
        </div>

        {/* チャットバブル風テキスト */}
        <div className="px-4 pb-3">
          <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 relative">
            {isBlurred ? (
              <BlurredContent review={review} onBlurClick={onBlurClick} />
            ) : (
              <p className="text-sm leading-relaxed">{previewText.slice(0, 150)}{previewText.length > 150 ? "..." : ""}</p>
            )}
          </div>
        </div>

        {/* エンゲージメントバー（SNS風） */}
        <div className="px-4 py-2.5 border-t flex items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors">
              <MessageSquare className="h-4 w-4" />
              <span>{review.helpfulCount || 0}</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 cursor-pointer transition-colors">
              <ThumbsUp className="h-4 w-4" />
              <span>{review.helpfulCount || 0}</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>{(review.viewCount || 0).toLocaleString()}</span>
            </span>
          </div>
          {showTherapist && (
            <Link href={`/therapist/${review.therapistId}`} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              詳細を見る<ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メインエクスポート
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface CardInternalProps {
  review: Review;
  isBlurred: boolean;
  showTherapist: boolean;
  therapistImageUrl?: string;
  onBlurClick?: () => void;
  typeLabel: string;
  bodyLabel: string;
  serviceLabel: string;
  formattedDate: string;
  isVerified: boolean;
}

export function ReviewCard({ review, isBlurred = false, showTherapist = true, variant = "default", cardStyle = "default", therapistImageUrl, onBlurClick }: ReviewCardProps) {
  const typeLabel = therapistTypes.find((t) => t.id === review.typeId)?.label || review.typeId;
  const bodyLabel = bodyTypes.find((b) => b.id === review.bodyType)?.label || review.bodyType;
  const serviceLabel = serviceTypes.find((s) => s.id === review.serviceType)?.label || review.serviceType;
  const formattedDate = formatDate(review.createdAt);
  const isVerified = !!review.verificationImagePath;

  const props: CardInternalProps = {
    review, isBlurred, showTherapist, therapistImageUrl, onBlurClick,
    typeLabel, bodyLabel, serviceLabel, formattedDate, isVerified,
  };

  switch (cardStyle) {
    case "magazine":
      return <MagazineCard {...props} />;
    case "compact":
      return <CompactCard {...props} />;
    case "social":
      return <SocialCard {...props} />;
    default:
      return <DefaultCard {...props} />;
  }
}
