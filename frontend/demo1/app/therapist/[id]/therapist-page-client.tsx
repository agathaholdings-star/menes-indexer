"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Share2, Heart, ChevronLeft, ChevronRight, PenSquare, Sparkles } from "lucide-react";
import { TherapistImage } from "@/components/shared/therapist-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { SiteHeader } from "@/components/layout/site-header";
import { Sidebar } from "@/components/layout/sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProfileTable } from "@/components/therapist/profile-table";

import { ReviewList } from "@/components/therapist/review-list";
import { ReviewWizardModal, type PrefillContext } from "@/components/review/review-wizard-modal";
import { useTier } from "@/lib/hooks/use-tier";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { Therapist, Review } from "@/lib/data";

interface SalonInfo {
  businessHours: string | null;
  basePrice: number | null;
  baseDuration: number | null;
  access: string | null;
}

interface SameShopTherapist {
  id: number;
  name: string;
  age: number | null;
  imageUrl: string | null;
}

interface TherapistPageClientProps {
  therapist: Therapist;
  reviews: Review[];
  areaName?: string;
  prefName?: string;
  salonInfo?: SalonInfo;
  sameShopTherapists?: SameShopTherapist[];
}

export function TherapistPageClient({ therapist, reviews, areaName, prefName, salonInfo, sameShopTherapists }: TherapistPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewForThisTherapist, setReviewForThisTherapist] = useState(false);
  const [unlockedReviewIds, setUnlockedReviewIds] = useState<Set<string>>(new Set());
  const { permissions, reviewCredits, setReviewCredits, authUser, loading: tierLoading, effectiveTier } = useTier();

  // B5: ?write=true でウィザード自動起動
  useEffect(() => {
    if (searchParams.get("write") === "true") {
      setReviewForThisTherapist(true);
      setIsReviewModalOpen(true);
    }
  }, [searchParams]);

  // 口コミ投稿ボタンのハンドラ（ログイン不要でモーダル直接オープン）
  const handleWriteReview = useCallback((forThisTherapist: boolean) => {
    setReviewForThisTherapist(forThisTherapist);
    setIsReviewModalOpen(true);
  }, []);

  // Check per-review unlock status on mount
  useEffect(() => {
    if (tierLoading || reviews.length === 0) return;
    // Standard/VIP users always see unlocked
    if (permissions.canViewReviewBody && effectiveTier !== "free_active") {
      setUnlockedReviewIds(new Set(reviews.map(r => r.id)));
      return;
    }
    // For credit-based users, batch check which reviews are unlocked
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

  const hasAnyLocked = reviews.some(r => !unlockedReviewIds.has(r.id));

  const nextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === therapist.images.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? therapist.images.length - 1 : prev - 1
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {/* Breadcrumb */}
          <nav className="mb-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              トップ
            </Link>
            <span className="mx-2">/</span>
            {prefName && (
              <>
                <Link href={`/area/${therapist.area}`} className="hover:text-foreground">
                  {prefName}
                </Link>
                <span className="mx-2">/</span>
              </>
            )}
            {areaName && (
              <>
                <Link href={`/area/${therapist.area}/${therapist.district}`} className="hover:text-foreground">
                  {areaName}
                </Link>
                <span className="mx-2">/</span>
              </>
            )}
            <Link href={`/salon/${therapist.salonId}`} className="hover:text-foreground">
              {therapist.salonName}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">{therapist.name}</span>
          </nav>

          {/* 2-column layout */}
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Main Column */}
            <div className="flex-1 space-y-6">
              {/* Profile Card */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-6 md:flex-row">
                    {/* Image Gallery */}
                    <div className="relative w-full md:w-64 flex-shrink-0">
                      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
                        <TherapistImage
                          src={therapist.images[currentImageIndex]}
                          alt={therapist.name}
                          fill
                          className="object-cover"
                          priority={currentImageIndex === 0}
                        />
                        {therapist.images.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={prevImage}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center shadow hover:bg-card transition-colors"
                              aria-label="前の画像"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={nextImage}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center shadow hover:bg-card transition-colors"
                              aria-label="次の画像"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                      {/* Thumbnails */}
                      {therapist.images.length > 1 && (
                        <div className="flex gap-2 mt-2">
                          {therapist.images.map((img, index) => (
                            <button
                              key={img}
                              type="button"
                              onClick={() => setCurrentImageIndex(index)}
                              className={`relative w-12 h-12 rounded overflow-hidden border-2 transition-colors ${
                                index === currentImageIndex
                                  ? "border-primary"
                                  : "border-transparent"
                              }`}
                              aria-label={`画像${index + 1}を表示`}
                            >
                              <TherapistImage
                                src={img}
                                alt=""
                                fill
                                className="object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Profile Info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold">{therapist.name}</h1>
                            {therapist.age > 0 && (
                              <span className="text-muted-foreground">({therapist.age})</span>
                            )}
                          </div>
                          <Link href={`/salon/${therapist.salonId}`} className="text-primary hover:underline">
                            {therapist.salonName}
                          </Link>
                          {therapist.reviewCount > 0 && (
                            <div className="mt-2">
                              <span className="text-sm text-muted-foreground">({therapist.reviewCount}件の口コミ)</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="icon">
                            <Heart className="h-4 w-4" />
                            <span className="sr-only">お気に入りに追加</span>
                          </Button>
                          <Button variant="outline" size="icon">
                            <Share2 className="h-4 w-4" />
                            <span className="sr-only">共有</span>
                          </Button>
                        </div>
                      </div>
                      <ProfileTable therapist={therapist} />
                    </div>
                  </div>

                  {/* 所属サロン情報 */}
                  {salonInfo && (salonInfo.access || salonInfo.businessHours || (salonInfo.basePrice && salonInfo.baseDuration)) && (
                    <div className="mt-6 border-t pt-4">
                      <h2 className="text-sm font-semibold mb-3 text-muted-foreground">所属サロン情報</h2>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <tbody>
                            {salonInfo.access && (
                              <tr className="bg-muted/30">
                                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-32">アクセス</th>
                                <td className="px-4 py-2.5">{salonInfo.access}</td>
                              </tr>
                            )}
                            {salonInfo.businessHours && (
                              <tr className={salonInfo.access ? "bg-background" : "bg-muted/30"}>
                                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-32">営業時間</th>
                                <td className="px-4 py-2.5">{salonInfo.businessHours}</td>
                              </tr>
                            )}
                            {salonInfo.basePrice && salonInfo.baseDuration && (
                              <tr className={[salonInfo.access, salonInfo.businessHours].filter(Boolean).length % 2 === 0 ? "bg-muted/30" : "bg-background"}>
                                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-32">料金</th>
                                <td className="px-4 py-2.5">{salonInfo.baseDuration}分 {salonInfo.basePrice.toLocaleString()}円〜</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Reviews Section */}
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
                  therapistId={therapist.id}
                  therapistName={therapist.name}
                  therapistAge={therapist.age}
                  therapistImage={therapist.images[0]}
                  salonName={therapist.salonName}
                />
              )}

              {/* 同サロンセラピスト（SSRデータ） */}
              {sameShopTherapists && sameShopTherapists.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-lg font-bold mb-4">{therapist.salonName}の他のセラピスト</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {sameShopTherapists.map((t) => {
                      const displayName = t.name.replace(/\s*\(\d{2}\)$/, "");
                      return (
                        <Link key={t.id} href={`/therapist/${t.id}`} className="group">
                          <div className="relative h-36 rounded-lg overflow-hidden">
                            <TherapistImage src={t.imageUrl} alt={displayName} fill className="object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                              <p className="font-bold text-sm text-white">{displayName}</p>
                              {t.age && <p className="text-xs text-white/80">{t.age}歳</p>}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="hidden lg:block lg:w-80 lg:shrink-0">
              <div className="lg:sticky lg:top-24">
                <Sidebar prefectureName={therapist.area} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky CTA for locked users */}
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

      <SiteFooter />

      {/* Review Wizard Modal */}
      <ReviewWizardModal
        open={isReviewModalOpen}
        onOpenChange={(open) => { setIsReviewModalOpen(open); if (!open) setReviewForThisTherapist(false); }}
        prefill={reviewForThisTherapist ? {
          therapistId: therapist.id,
          therapistName: therapist.name,
          salonId: therapist.salonId,
          salonName: therapist.salonName,
          areaName: therapist.area,
        } : undefined}
      />
    </div>
  );
}
