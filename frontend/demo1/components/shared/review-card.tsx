"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, Lock, ChevronRight, Crown, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { therapistTypes, bodyTypes, serviceTypes, mockTherapists, type Review } from "@/lib/data";

interface ReviewCardProps {
  review: Review;
  isBlurred?: boolean;
  showTherapist?: boolean;
  variant?: "default" | "detailed";
}

export function ReviewCard({ review, isBlurred = false, showTherapist = true, variant = "default" }: ReviewCardProps) {
  const typeLabel = therapistTypes.find((t) => t.id === review.typeId)?.label || review.typeId;
  const bodyLabel = bodyTypes.find((b) => b.id === review.bodyType)?.label || review.bodyType;
  const serviceLabel = serviceTypes.find((s) => s.id === review.serviceType)?.label || review.serviceType;
  const therapist = mockTherapists.find(t => t.id === review.therapistId);

  if (variant === "detailed") {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          {/* Header with therapist info */}
          <div className="flex gap-3 mb-3">
            {therapist && (
              <Link href={`/therapist/${review.therapistId}`}>
                <div className="relative h-16 w-14 flex-shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={therapist.images[0] || "/placeholder.svg"}
                    alt={review.therapistName}
                    fill
                    className="object-cover"
                  />
                </div>
              </Link>
            )}
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs font-normal gap-1 px-1.5 py-0">
                  <Clock className="h-3 w-3" />
                  {review.createdAt}
                </Badge>
                {review.isPremium && (
                  <Badge className="text-xs font-normal gap-1 px-1.5 py-0 bg-amber-500 hover:bg-amber-500">
                    <Crown className="h-3 w-3" />
                    プレミアム口コミ
                  </Badge>
                )}
              </div>
              
              {/* Therapist & Shop */}
              {showTherapist && (
                <Link
                  href={`/therapist/${review.therapistId}`}
                  className="font-bold hover:text-primary"
                >
                  {review.therapistName}
                </Link>
              )}
              <p className="text-xs text-muted-foreground">
                {review.shopName} / {review.createdAt}
              </p>
              
              {/* Score */}
              <div className="flex items-center gap-1 mt-1">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <span className="font-bold text-lg text-primary">{review.score}点</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-3 flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
            <Badge variant="outline" className="text-xs">{bodyLabel}</Badge>
            <Badge variant="outline" className="text-xs">{serviceLabel}</Badge>
          </div>

          {/* Review Content */}
          <div className={`space-y-3 ${isBlurred ? "relative" : ""}`}>
            {isBlurred && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span className="text-sm">口コミを投稿すると閲覧できます</span>
                </div>
              </div>
            )}
            <div className="bg-muted/30 p-3 rounded-lg">
              <p className="mb-1 text-xs font-medium text-muted-foreground">第一印象</p>
              <p className="text-sm">{review.q1FirstImpression}</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg">
              <p className="mb-1 text-xs font-medium text-muted-foreground">施術・接客</p>
              <p className="text-sm">{review.q2Service}</p>
            </div>
            {review.q3Notes && (
              <div className="bg-muted/30 p-3 rounded-lg">
                <p className="mb-1 text-xs font-medium text-muted-foreground">注意点</p>
                <p className="text-sm">{review.q3Notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant - simpler card style for listings
  return (
    <Card className="border-l-4 border-l-primary/20 hover:border-l-primary transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            {showTherapist && (
              <Link
                href={`/therapist/${review.therapistId}`}
                className="font-bold hover:text-primary"
              >
                {review.therapistName}
              </Link>
            )}
            <p className="text-sm text-muted-foreground">
              {review.shopName} / {review.createdAt}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
            <Star className="h-4 w-4 fill-primary text-primary" />
            <span className="font-bold text-primary">{review.score}点</span>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
          <Badge variant="outline" className="text-xs">{bodyLabel}</Badge>
          <Badge variant="outline" className="text-xs">{serviceLabel}</Badge>
        </div>

        <div className={`space-y-3 ${isBlurred ? "relative" : ""}`}>
          {isBlurred && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span className="text-sm">口コミを投稿すると閲覧できます</span>
              </div>
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">第一印象</p>
            <p className="text-sm">{review.q1FirstImpression}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">施術・接客</p>
            <p className="text-sm">{review.q2Service}</p>
          </div>
          {review.q3Notes && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">注意点</p>
              <p className="text-sm">{review.q3Notes}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
