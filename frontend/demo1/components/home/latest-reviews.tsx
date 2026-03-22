"use client";

import { useState } from "react";
import Link from "next/link";
import { PenSquare, PenLine, ChevronRight, TrendingUp, Lock } from "lucide-react";
import { useTier } from "@/lib/hooks/use-tier";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReviewCard } from "@/components/shared/review-card";
import type { Review } from "@/lib/data";

export interface LatestReview {
  id: string;
  score: number;
  comment_first_impression: string;
  comment_style?: string;
  comment_service?: string;
  comment_service_detail?: string;
  comment_advice?: string;
  looks_type_id?: number | null;
  body_type_id?: number | null;
  service_level_id?: number | null;
  view_count?: number;
  helpful_count?: number;
  verification_image_path?: string | null;
  created_at: string;
  therapist_id: number;
  therapists: { name: string; image_urls: string[] | null; salon_id: number; salons: { name: string } | null } | null;
}

interface LatestReviewsProps {
  reviews: LatestReview[];
}

function toReview(r: LatestReview): { review: Review; therapistImageUrl: string | undefined } {
  const imageUrl = r.therapists?.image_urls?.[0] || undefined;
  return {
    review: {
      id: r.id,
      therapistId: String(r.therapist_id),
      therapistName: r.therapists?.name || "不明",
      salonName: r.therapists?.salons?.name || "サロン",
      score: r.score,
      typeId: r.looks_type_id ? String(r.looks_type_id) : "",
      bodyType: r.body_type_id ? String(r.body_type_id) : "",
      serviceType: r.service_level_id ? String(r.service_level_id) : "",
      parameters: { conversation: 0, distance: 0, technique: 0, personality: 0 },
      tags: [],
      commentReason: "",
      commentFirstImpression: r.comment_first_impression || "",
      commentStyle: r.comment_style || "",
      commentService: r.comment_service || "",
      commentServiceDetail: r.comment_service_detail || "",
      commentCost: "",
      commentRevisit: "",
      commentAdvice: r.comment_advice || "",
      createdAt: r.created_at,
      userId: "",
      userName: "匿名",
      viewCount: r.view_count || 0,
      helpfulCount: r.helpful_count || 0,
      verificationImagePath: r.verification_image_path || null,
    },
    therapistImageUrl: imageUrl,
  };
}

export function LatestReviews({ reviews }: LatestReviewsProps) {
  const { permissions } = useTier();
  const isBlurred = !permissions.canViewReviewBody;
  const [showUnlockModal, setShowUnlockModal] = useState(false);

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
    <section className="mt-8">
      <h2 className="text-lg font-bold mb-4">新着口コミ</h2>
      <div className="space-y-4">
        {reviews.map((r) => {
          const { review, therapistImageUrl } = toReview(r);
          return (
            <ReviewCard
              key={r.id}
              review={review}
              isBlurred={isBlurred}
              therapistImageUrl={therapistImageUrl}
              onBlurClick={() => setShowUnlockModal(true)}
            />
          );
        })}
      </div>

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
                <p className="text-center text-sm font-medium mb-3">- キャンペーン中 -</p>
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
            </div>

            <div className="bg-muted/50 rounded-lg p-4 mb-4 text-sm text-muted-foreground space-y-2">
              <p>あなたが体験したセラピストの口コミを投稿すると、クレジットで口コミが読めるようになります。</p>
              <p className="flex items-center gap-1 text-primary font-medium">
                <TrendingUp className="h-4 w-4" />1件書けば5件の口コミが読める（スクショ付き10件）
              </p>
            </div>

            <div className="space-y-3">
              <Link href="/review">
                <Button
                  onClick={() => setShowUnlockModal(false)}
                  className="w-full gap-2 h-14 text-base font-bold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
                >
                  <PenLine className="h-5 w-5" />
                  <span className="flex flex-col items-start leading-tight">
                    <span>口コミを書いて読む</span>
                    <span className="text-[10px] font-normal opacity-80">1件投稿で5件の口コミが読める</span>
                  </span>
                  <ChevronRight className="h-5 w-5 ml-auto flex-shrink-0" />
                </Button>
              </Link>

              <Link href="/login" className="block">
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground h-9 text-xs"
                >
                  既に会員の方はこちら
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
