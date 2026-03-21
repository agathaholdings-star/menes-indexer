"use client";

import Link from "next/link";
import { PenSquare } from "lucide-react";
import { useTier } from "@/lib/hooks/use-tier";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReviewCard } from "@/components/shared/review-card";
import type { Review } from "@/lib/data";

export interface LatestReview {
  id: string;
  score: number;
  comment_first_impression: string;
  comment_service?: string;
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
      commentStyle: "",
      commentService: r.comment_service || "",
      commentServiceDetail: "",
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
            />
          );
        })}
      </div>
    </section>
  );
}
