"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Share2, Heart, ChevronLeft, ChevronRight, PenSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/layout/site-header";
import { Sidebar } from "@/components/layout/sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProfileTable } from "@/components/therapist/profile-table";
import { ParameterRadarChart } from "@/components/therapist/radar-chart";
import { CompositionChart } from "@/components/therapist/composition-chart";
import { ReviewList } from "@/components/therapist/review-list";
import { Recommendations } from "@/components/therapist/recommendations";
import { ReviewWizardModal } from "@/components/review/review-wizard-modal";
import type { Therapist, Review } from "@/lib/data";

interface TherapistPageClientProps {
  therapist: Therapist;
  reviews: Review[];
}

export function TherapistPageClient({ therapist, reviews }: TherapistPageClientProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isLocked] = useState(true);

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
            <Link href={`/area/${therapist.area}`} className="hover:text-foreground">
              {therapist.area}
            </Link>
            <span className="mx-2">/</span>
            <Link href={`/area/${therapist.area}/${therapist.district}`} className="hover:text-foreground">
              {therapist.district}
            </Link>
            <span className="mx-2">/</span>
            <Link href={`/shop/${therapist.shopId}`} className="hover:text-foreground">
              {therapist.shopName}
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
                        <Image
                          src={therapist.images[currentImageIndex] || "/placeholder.svg"}
                          alt={therapist.name}
                          fill
                          className="object-cover"
                        />
                        {therapist.images.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={prevImage}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/80 flex items-center justify-center shadow hover:bg-card transition-colors"
                              aria-label="前の画像"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={nextImage}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/80 flex items-center justify-center shadow hover:bg-card transition-colors"
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
                              <Image
                                src={img || "/placeholder.svg"}
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
                            <span className="text-muted-foreground">({therapist.age})</span>
                          </div>
                          <Link href={`/shop/${therapist.shopId}`} className="text-primary hover:underline">
                            {therapist.shopName}
                          </Link>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded">
                              <Star className="h-4 w-4 fill-primary text-primary" />
                              <span className="font-bold text-primary">{therapist.averageScore}点</span>
                            </div>
                            <span className="text-sm text-muted-foreground">({therapist.reviewCount}件の口コミ)</span>
                          </div>
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
                </CardContent>
              </Card>

              {/* Analysis Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    分析データ
                    <Badge variant="secondary" className="text-xs">独自機能</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <ParameterRadarChart parameters={therapist.parameters} />
                    <CompositionChart types={therapist.types} />
                  </div>
                </CardContent>
              </Card>

              {/* Reviews Section */}
              <ReviewList
                reviews={reviews}
                isLocked={isLocked}
                onWriteReview={() => setIsReviewModalOpen(true)}
              />

              {/* Recommendations */}
              <Recommendations therapist={therapist} />
            </div>

            {/* Sidebar */}
            <div className="lg:w-80 lg:shrink-0">
              <div className="lg:sticky lg:top-24">
                <Sidebar />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky CTA for locked users */}
      {isLocked && (
        <div className="sticky bottom-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 lg:hidden">
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => setIsReviewModalOpen(true)}
          >
            <PenSquare className="h-5 w-5" />
            口コミを投稿して無料で全て見る
          </Button>
        </div>
      )}

      <SiteFooter />

      {/* Review Wizard Modal */}
      <ReviewWizardModal
        open={isReviewModalOpen}
        onOpenChange={setIsReviewModalOpen}
        preselectedTherapistId={therapist.id}
      />
    </div>
  );
}
