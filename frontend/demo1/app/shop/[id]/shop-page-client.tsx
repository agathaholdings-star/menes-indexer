"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, MapPin, Clock, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SiteHeader } from "@/components/layout/site-header";
import { Sidebar } from "@/components/layout/sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { TherapistCard } from "@/components/shared/therapist-card";
import { ReviewCard } from "@/components/shared/review-card";
import type { Shop, Therapist, Review } from "@/lib/data";

interface ShopPageClientProps {
  shop: Shop;
  therapists: Therapist[];
  shopReviews: Review[];
}

export function ShopPageClient({ shop, therapists, shopReviews }: ShopPageClientProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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
            <span className="mx-2">/</span>
            <Link href={`/area/${shop.area}`} className="hover:text-foreground">{shop.area}</Link>
            <span className="mx-2">/</span>
            <Link href={`/area/${shop.area}/${shop.district}`} className="hover:text-foreground">{shop.district}</Link>
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
                        />
                        {shop.images.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={prevImage}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/80 flex items-center justify-center shadow hover:bg-card"
                              aria-label="前の画像"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={nextImage}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/80 flex items-center justify-center shadow hover:bg-card"
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

                      <Button className="mt-4 gap-2" asChild>
                        <a href="#" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          公式サイト
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Price Table */}
              <Card>
                <CardHeader>
                  <CardTitle>料金表</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>コース名</TableHead>
                        <TableHead>時間</TableHead>
                        <TableHead className="text-right">料金</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shop.courses.map((course, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{course.name}</TableCell>
                          <TableCell>{course.duration}</TableCell>
                          <TableCell className="text-right">{course.price}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Therapists */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>在籍セラピスト</CardTitle>
                    <span className="text-sm text-muted-foreground">{therapists.length}人</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {therapists.map(therapist => (
                      <TherapistCard key={therapist.id} therapist={therapist} showShop={false} size="sm" />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Reviews */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>店舗の口コミ</CardTitle>
                    <span className="text-sm text-muted-foreground">{shopReviews.length}件</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {shopReviews.slice(0, 3).map(review => (
                      <ReviewCard key={review.id} review={review} isBlurred={false} />
                    ))}
                  </div>
                </CardContent>
              </Card>
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

      <SiteFooter />
    </div>
  );
}
