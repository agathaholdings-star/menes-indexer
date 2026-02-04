"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, ChevronRight, Clock, Crown, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockReviews, mockTherapists } from "@/lib/data";

export function LatestReviews() {
  const reviewsWithImages = mockReviews.map((review) => {
    const therapist = mockTherapists.find((t) => t.id === review.therapistId);
    return {
      ...review,
      image: therapist?.images[0] || "",
      area: therapist?.area || "東京",
      shopArea: therapist?.district || "渋谷",
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Duplicate for more content
  const extendedReviews = [...reviewsWithImages, ...reviewsWithImages, ...reviewsWithImages];

  return (
    <section className="mt-8">
      <Card className="overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              新着口コミ
            </CardTitle>
            <Link
              href="/reviews"
              className="flex items-center gap-1 text-sm text-primary-foreground/90 hover:text-primary-foreground"
            >
              もっと見る
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {extendedReviews.slice(0, 8).map((review, index) => (
            <div key={`${review.id}-${index}`} className="p-4 hover:bg-muted/30 transition-colors">
              {/* Header Row */}
              <div className="flex gap-3">
                {/* Therapist Image */}
                <div className="relative h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={review.image || "/placeholder.svg"}
                    alt={review.therapistName}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {/* Date & Badge Row */}
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs font-normal gap-1 px-1.5 py-0">
                      <Clock className="h-3 w-3" />
                      {review.createdAt}
                    </Badge>
                    {index % 2 === 0 && (
                      <Badge className="text-xs font-normal gap-1 px-1.5 py-0 bg-primary/90 hover:bg-primary text-primary-foreground">
                        <Crown className="h-3 w-3" />
                        プレミアム口コミ
                      </Badge>
                    )}
                  </div>

                  {/* Shop & Therapist Info */}
                  <p className="text-xs text-muted-foreground">
                    {review.area}・{review.shopArea} {review.shopName}
                  </p>
                  <p className="text-sm font-bold">
                    <Link href={`/therapist/${review.therapistId}`} className="hover:text-primary">
                      {review.therapistName}
                    </Link>
                    <span className="font-normal text-muted-foreground">さんの口コミ体験レポート</span>
                  </p>

                  {/* Rating Row */}
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">オススメ度:</span>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`h-3 w-3 ${i < Math.floor(review.score / 20) ? "fill-primary text-primary" : "fill-muted text-muted"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">点数:</span>
                      <span className="text-lg font-bold text-primary">{review.score}</span>
                      <span className="text-xs text-muted-foreground">点</span>
                    </div>
                  </div>

                  {/* Reviewer */}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    投稿者: <span className="text-primary underline">{review.userName}</span>
                  </p>
                </div>
              </div>

              {/* Review Body */}
              <div className="mt-3 relative">
                <p className="text-sm leading-relaxed">
                  {review.q1FirstImpression.slice(0, 80)}
                  {review.q2Service && review.q2Service.slice(0, 40)}...
                </p>
                
                {/* Blurred continuation */}
                <div className="mt-2 relative">
                  <p className="text-sm text-muted-foreground blur-[6px] select-none leading-relaxed">
                    施術もとても丁寧で、会話も楽しく時間があっという間に過ぎました。技術もしっかりしていてコリがほぐれました。人気なので予約は早めがおすすめ。土日は特に取りにくいです。
                  </p>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {index % 3 === 0 ? (
                      <Badge className="bg-muted text-muted-foreground hover:bg-muted gap-1">
                        <Lock className="h-3 w-3" />
                        SKR
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {/* CTA Button */}
                <Link href={`/therapist/${review.therapistId}`}>
                  <Button variant="outline" className="w-full mt-3 text-primary border-primary/30 hover:bg-primary/5 bg-transparent">
                    続きを読む
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
