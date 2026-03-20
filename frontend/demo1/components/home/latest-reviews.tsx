"use client";

import Link from "next/link";
import { PenSquare, Clock, Lock } from "lucide-react";
import { useTier } from "@/lib/hooks/use-tier";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TherapistImage } from "@/components/shared/therapist-image";

export interface LatestReview {
  id: string;
  score: number;
  comment_first_impression: string;
  created_at: string;
  therapist_id: number;
  therapists: { name: string; image_urls: string[] | null; salon_id: number; salons: { name: string } | null } | null;
}

interface LatestReviewsProps {
  reviews: LatestReview[];
}

export function LatestReviews({ reviews }: LatestReviewsProps) {
  const { permissions } = useTier();
  const isLocked = !permissions.canViewReviewBody;

  if (reviews.length === 0) {
    return (
      <section className="mt-8">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-blue-600 px-5 py-3">
            <h3 className="text-white font-bold text-base">新着口コミ</h3>
          </div>
          <CardContent className="p-8 text-center">
            <PenSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">口コミを募集中です</h3>
            <p className="text-sm text-muted-foreground mb-6">
              あなたの体験を共有して、他のユーザーの「発見」を手助けしませんか？
            </p>
            <Link href="/review">
              <Button>口コミを投稿する</Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mt-8 space-y-4">
      {reviews.map((r) => {
        const salonName = r.therapists?.salons?.name || "サロン";
        const therapistName = r.therapists?.name || "不明";
        const imageUrl = r.therapists?.image_urls?.[0] || null;
        const scorePercent = r.score;
        const formattedDate = new Date(r.created_at).toLocaleDateString("ja-JP");

        return (
          <Card key={r.id} className="overflow-hidden shadow-md">
            {/* バナー: サロン名 + セラピスト名 */}
            <div className="bg-gradient-to-r from-primary to-blue-600 px-5 py-2.5">
              <h3 className="text-white font-bold text-sm">{salonName}</h3>
              <p className="text-blue-100 text-xs mt-0.5">
                <span className="text-white font-bold">{therapistName}</span> さんの口コミ体験レポート
              </p>
            </div>

            <Link href={`/therapist/${r.therapist_id}`} className="block hover:bg-muted/30 transition-colors">
              <CardContent className="p-0">
                <div className="p-4 flex gap-3">
                  {/* セラピスト画像 */}
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    <TherapistImage
                      src={imageUrl}
                      alt={therapistName}
                      width={56}
                      height={56}
                      className="rounded-lg object-cover"
                      sizes="56px"
                      loading="lazy"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* ティーザー */}
                    <p className="text-sm leading-relaxed line-clamp-2 mb-2">
                      {r.comment_first_impression}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  {/* スコア円 */}
                  {isLocked ? (
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                        <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[7px] text-muted-foreground">非公開</span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                        <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                        <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray={`${scorePercent}, 100`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-base font-bold text-primary leading-none">{r.score}</span>
                        <span className="text-[7px] text-muted-foreground">/ 100</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Link>
          </Card>
        );
      })}
    </section>
  );
}
