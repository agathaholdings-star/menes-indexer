"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, MapPin, Clock, ExternalLink, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/layout/site-header";
import { Sidebar } from "@/components/layout/sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { TherapistCard } from "@/components/shared/therapist-card";
import { ReviewCard } from "@/components/shared/review-card";
import { useTier } from "@/lib/hooks/use-tier";
import type { Shop, Therapist, Review } from "@/lib/data";

const THERAPISTS_PER_PAGE = 16;

interface ShopPageClientProps {
  shop: Shop;
  therapists: Therapist[];
  shopReviews: Review[];
  officialUrl?: string | null;
  areaName?: string;
  areaSlug?: string;
  prefName?: string;
  prefSlug?: string;
}

export function ShopPageClient({ shop, therapists, shopReviews, officialUrl, areaName, areaSlug, prefName, prefSlug }: ShopPageClientProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [therapistDisplayCount, setTherapistDisplayCount] = useState(THERAPISTS_PER_PAGE);
  const { permissions } = useTier();
  const isReviewBlurred = !permissions.canViewReviewBody;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev === shop.images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? shop.images.length - 1 : prev - 1));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {/* Breadcrumb */}
          <nav className="mb-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">トップ</Link>
            {prefName && prefSlug && (
              <>
                <span className="mx-2">/</span>
                <Link href={`/area/${prefSlug}`} className="hover:text-foreground">{prefName}</Link>
              </>
            )}
            {areaName && areaSlug && prefSlug && (
              <>
                <span className="mx-2">/</span>
                <Link href={`/area/${prefSlug}/${areaSlug}`} className="hover:text-foreground">{areaName}</Link>
              </>
            )}
            <span className="mx-2">/</span>
            <span className="text-foreground">{shop.name}</span>
          </nav>

          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Main Column */}
            <div className="flex-1 space-y-6">
              {/* Shop Header */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-6 md:flex-row">
                    {/* Image Gallery */}
                    <div className="relative w-full md:w-80 shrink-0">
                      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                        <Image
                          src={shop.images[currentImageIndex] || "/placeholder.svg"}
                          alt={shop.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        {shop.images.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={prevImage}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center shadow hover:bg-card"
                              aria-label="前の画像"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={nextImage}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center shadow hover:bg-card"
                              aria-label="次の画像"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Shop Info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <h1 className="text-2xl font-bold">{shop.name}</h1>
                        <div className="flex items-center gap-1 bg-primary/10 px-3 py-1 rounded">
                          <Star className="h-5 w-5 fill-primary text-primary" />
                          <span className="font-bold text-lg text-primary">{shop.averageScore}</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{shop.access}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{shop.hours}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-4">
                        {shop.genres.map(genre => (
                          <Badge key={genre} variant="secondary">{genre}</Badge>
                        ))}
                      </div>

                      <p className="mt-4 text-sm text-muted-foreground">{shop.description}</p>

                      {officialUrl && (
                        <Button className="mt-4 gap-2" asChild>
                          <a href={officialUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            公式サイト
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Therapists */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>在籍セラピスト</CardTitle>
                    {therapists.length > 0 && (
                      <span className="text-sm text-muted-foreground">{therapists.length}人</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {therapists.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-muted-foreground">セラピスト情報は現在準備中です</p>
                      {officialUrl && (
                        <a
                          href={officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          公式サイトで確認する
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {therapists.slice(0, therapistDisplayCount).map(therapist => (
                          <TherapistCard key={therapist.id} therapist={therapist} showShop={false} size="sm" />
                        ))}
                      </div>
                      {therapists.length > therapistDisplayCount && (
                        <div className="mt-6 text-center">
                          <Button
                            variant="outline"
                            onClick={() => setTherapistDisplayCount(prev => prev + THERAPISTS_PER_PAGE)}
                            className="gap-2"
                          >
                            <ChevronDown className="h-4 w-4" />
                            もっと見る（残り{therapists.length - therapistDisplayCount}人）
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Reviews */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>店舗の口コミ</CardTitle>
                    {shopReviews.length > 0 && (
                      <span className="text-sm text-muted-foreground">{shopReviews.length}件</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {shopReviews.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-muted-foreground">まだ口コミはありません</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {shopReviews.slice(0, 3).map(review => (
                        <ReviewCard key={review.id} review={review} isBlurred={isReviewBlurred} therapistImageUrl={review.therapistImageUrl} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="lg:w-80 lg:shrink-0">
              <div className="lg:sticky lg:top-24">
                <Sidebar prefectureName={prefName || ""} />
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
