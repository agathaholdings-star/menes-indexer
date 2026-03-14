"use client";

import { useState, useEffect, useCallback } from "react";
import { PenSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewList } from "@/components/therapist/review-list";
import { useTier } from "@/lib/hooks/use-tier";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { useReviewModal } from "./review-modal-context";
import type { Review } from "@/lib/data";

interface ReviewsSectionProps {
  reviews: Review[];
  therapistId: string;
  therapistName: string;
  therapistAge: number;
  therapistImage: string;
  salonId: string;
  salonName: string;
  areaSlug: string;
}

export function ReviewsSection({
  reviews,
  therapistId,
  therapistName,
  therapistAge,
  therapistImage,
  salonId,
  salonName,
  areaSlug,
}: ReviewsSectionProps) {
  const { openModal } = useReviewModal();
  const [unlockedReviewIds, setUnlockedReviewIds] = useState<Set<string>>(new Set());
  const { permissions, reviewCredits, setReviewCredits, authUser, loading: tierLoading, effectiveTier } = useTier();

  // Check per-review unlock status on mount
  useEffect(() => {
    if (tierLoading || reviews.length === 0) return;
    if (permissions.canViewReviewBody && effectiveTier !== "free_active") {
      setUnlockedReviewIds(new Set(reviews.map(r => r.id)));
      return;
    }
    if (!authUser) return;
    const supabase = createSupabaseBrowser();
    const reviewIds = reviews.map(r => r.id);
    supabase
      .rpc("are_reviews_unlocked", { p_review_ids: reviewIds })
      .then(({ data }) => {
        if (data && Array.isArray(data)) {
          setUnlockedReviewIds(new Set(data as string[]));
        }
      });
  }, [authUser, reviews, permissions.canViewReviewBody, effectiveTier, tierLoading]);

  const handleUnlockReview = useCallback(async (reviewId: string): Promise<boolean | undefined> => {
    if (unlockedReviewIds.has(reviewId)) return true;
    if (reviewCredits <= 0) return undefined;
    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase.rpc("unlock_review", {
      p_review_id: reviewId,
    });
    if (error || !data) return undefined;
    setUnlockedReviewIds(prev => new Set([...prev, reviewId]));
    setReviewCredits((prev: number) => Math.max(0, prev - 1));
    return true;
  }, [unlockedReviewIds, reviewCredits, setReviewCredits]);

  const handleWriteReview = useCallback((forThisTherapist: boolean) => {
    if (forThisTherapist) {
      openModal({
        therapistId,
        therapistName,
        salonId,
        salonName,
        areaName: areaSlug,
      });
    } else {
      openModal();
    }
  }, [openModal, therapistId, therapistName, salonId, salonName, areaSlug]);

  const hasAnyLocked = reviews.some(r => !unlockedReviewIds.has(r.id));

  return (
    <>
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles className="h-10 w-10 mx-auto text-primary/60 mb-3" />
            <h3 className="text-lg font-bold mb-2">このセラピストの口コミを最初に投稿しませんか?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              口コミを投稿すると5クレジット獲得(スクショ付きで10クレジット)
            </p>
            <Button onClick={() => handleWriteReview(true)} className="gap-2">
              <PenSquare className="h-4 w-4" />
              口コミを書く
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ReviewList
          reviews={reviews}
          unlockedReviewIds={unlockedReviewIds}
          onWriteReview={() => handleWriteReview(false)}
          onUnlockReview={handleUnlockReview}
          reviewCredits={reviewCredits}
          therapistId={therapistId}
          therapistName={therapistName}
          therapistAge={therapistAge}
          therapistImage={therapistImage}
          salonName={salonName}
        />
      )}

      {/* Sticky CTA for locked users (mobile) */}
      {hasAnyLocked && (
        <div className="sticky bottom-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 lg:hidden">
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => handleWriteReview(false)}
          >
            <PenSquare className="h-5 w-5" />
            あなたの体験を投稿してクレジットGET
          </Button>
        </div>
      )}
    </>
  );
}
