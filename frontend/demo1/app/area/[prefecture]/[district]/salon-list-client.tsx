"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { TherapistImage } from "@/components/shared/therapist-image";
import { Star, MapPin, Clock, Users, MessageSquare, Crown, Navigation, Lock } from "lucide-react";
import { useTier } from "@/lib/hooks/use-tier";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import type { Shop, Therapist, TherapistType, BodyType } from "@/lib/data";
import type { SalonLatestReview, NearbyAreaLink, SidebarTherapist, SidebarShop } from "@/lib/supabase-data";
import { Sidebar } from "@/components/layout/sidebar";

interface SalonListPageClientProps {
  prefecture: string;
  district: string;
  decodedPrefecture: string;
  decodedDistrict: string;
  shops: Shop[];
  allTherapists: Therapist[];
  therapistTypes: readonly TherapistType[];
  bodyTypes: readonly BodyType[];
  latestReviews?: Record<string, SalonLatestReview>;
  nearbyAreas?: NearbyAreaLink[];
  prefectureSlug?: string;
  seoDescription?: string;
  seoContentHtml?: React.ReactNode;
  initialSidebarTherapists?: SidebarTherapist[];
  initialSidebarShops?: SidebarShop[];
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const colors = [
      "bg-yellow-500 text-white",   // 1位: 金
      "bg-gray-400 text-white",     // 2位: 銀
      "bg-amber-700 text-white",    // 3位: 銅
    ];
    return (
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm font-bold ${colors[rank - 1]} shrink-0`}>
        <Crown className="h-3.5 w-3.5" />
        <span>{rank}位</span>
      </div>
    );
  }
  return (
    <div className="flex items-center px-2 py-0.5 rounded text-sm font-semibold text-muted-foreground bg-muted shrink-0">
      <span>{rank}位</span>
    </div>
  );
}

export function SalonListPageClient({
  prefecture,
  district,
  decodedPrefecture,
  decodedDistrict,
  shops,
  allTherapists,
  therapistTypes,
  bodyTypes,
  latestReviews = {},
  nearbyAreas = [],
  prefectureSlug,
  seoDescription,
  seoContentHtml,
  initialSidebarTherapists,
  initialSidebarShops,
}: SalonListPageClientProps) {
  const [sortBy, setSortBy] = useState("ranking");
  const { permissions } = useTier();
  const isScoreLocked = !permissions.canViewReviewBody;

  const getSalonTherapists = (salonId: string) => allTherapists.filter(t => t.salonId === salonId).slice(0, 3);

  const sortedShops = useMemo(() => {
    const sorted = [...shops];
    if (sortBy === "ranking") {
      sorted.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    } else if (sortBy === "reviews") {
      sorted.sort((a, b) => b.reviewCount - a.reviewCount);
    }
    return sorted;
  }, [shops, sortBy]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {/* Breadcrumb */}
          <nav className="mb-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">トップ</Link>
            <span className="mx-2">/</span>
            <Link href="/area" className="hover:text-foreground">エリア一覧</Link>
            <span className="mx-2">/</span>
            <Link href={`/area/${prefecture}`} className="hover:text-foreground">{decodedPrefecture}</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">{decodedDistrict}</span>
          </nav>

          <div className="flex flex-col gap-8 lg:flex-row">
          {/* Main Column */}
          <div className="flex-1">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{decodedDistrict}のメンズエステ おすすめランキング</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {shops.length}店舗を口コミ・評価でランキング
            </p>
          </div>

          {seoDescription && (
            <div className="mb-6">
              <p className="text-sm text-muted-foreground leading-relaxed">{seoDescription}</p>
            </div>
          )}

          {/* 並び替え */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-muted-foreground">並び替え</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ranking">おすすめ順</SelectItem>
                <SelectItem value="reviews">口コミ数順</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
              {sortedShops.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <p>該当する店舗が見つかりませんでした</p>
                  </CardContent>
                </Card>
              ) : (
                sortedShops.map(shop => {
                  const salonTherapists = getSalonTherapists(shop.id);
                  return (
                    <Link key={shop.id} href={`/salon/${shop.id}`}>
                      <Card className="transition-all hover:shadow-md hover:border-primary/20">
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-4 sm:flex-row">
                            {/* Shop Image */}
                            <div className="relative w-full sm:w-48 h-32 rounded-lg overflow-hidden bg-muted shrink-0">
                              <TherapistImage
                                src={shop.images[0]}
                                alt={shop.name}
                                fill
                                sizes="(max-width: 640px) 100vw, 192px"
                                className="object-cover"
                              />
                            </div>

                            {/* Shop Info */}
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {shop.rank && <RankBadge rank={shop.rank} />}
                                  <h3 className="font-bold text-lg">{shop.name}</h3>
                                </div>
                                {shop.averageScore > 0 && (
                                  isScoreLocked ? (
                                    <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded shrink-0">
                                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="font-bold text-muted-foreground">? ?</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded shrink-0">
                                      <Star className="h-4 w-4 fill-primary text-primary" />
                                      <span className="font-bold text-primary">{shop.averageScore.toFixed(1)}</span>
                                    </div>
                                  )
                                )}
                              </div>

                              {shop.access && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>{shop.access}</span>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                                {shop.hours && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{shop.hours}</span>
                                  </div>
                                )}
                                {shop.therapistCount > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    <span>{shop.therapistCount}人</span>
                                  </div>
                                )}
                                {shop.reviewCount > 0 && (
                                  <div className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    <span>{shop.reviewCount}件</span>
                                  </div>
                                )}
                              </div>

                              {shop.priceRange && (
                                <p className="text-sm font-medium mt-2">{shop.priceRange}</p>
                              )}

                              {/* 最新口コミプレビュー */}
                              {latestReviews[shop.id] && (
                                <div className="mt-3 p-2.5 bg-muted/50 rounded-md">
                                  <p className="text-sm text-foreground/80 line-clamp-2">
                                    {latestReviews[shop.id].comment_first_impression.length > 80
                                      ? latestReviews[shop.id].comment_first_impression.slice(0, 80) + "..."
                                      : latestReviews[shop.id].comment_first_impression}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {latestReviews[shop.id].nickname || "匿名ユーザー"}
                                    {" / "}
                                    {new Date(latestReviews[shop.id].created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })}
                                  </p>
                                </div>
                              )}

                              {shop.genres.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {shop.genres.map(genre => (
                                    <Badge key={genre} variant="secondary" className="text-xs">
                                      {genre}
                                    </Badge>
                                  ))}
                                </div>
                              )}

                              {salonTherapists.length > 0 && (
                                <div className="flex items-center gap-2 mt-3">
                                  <span className="text-xs text-muted-foreground">人気セラピスト:</span>
                                  <div className="flex -space-x-2">
                                    {salonTherapists.map(t => (
                                      <div key={t.id} className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-card">
                                        <TherapistImage src={t.images[0]} alt={t.name} fill sizes="32px" className="object-cover" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })
              )}
          </div>

          {/* 近隣エリアのメンズエステ */}
          {nearbyAreas.length > 0 && prefectureSlug && (
            <section className="mt-10">
              <div className="flex items-center gap-2 mb-4">
                <Navigation className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">近隣エリアのメンズエステ</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {nearbyAreas.map((area) => (
                  <Link
                    key={area.slug}
                    href={`/area/${prefectureSlug}/${area.slug}`}
                  >
                    <Badge
                      variant="outline"
                      className="px-3 py-1.5 text-sm hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer"
                    >
                      {area.name}
                      {area.salon_count != null && area.salon_count > 0 && (
                        <span className="ml-1 text-muted-foreground">({area.salon_count})</span>
                      )}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {/* SEO Content */}
          {seoContentHtml && (
            <div className="mt-8">
              {seoContentHtml}
            </div>
          )}
          </div>{/* end Main Column */}

          {/* Sidebar */}
          <div className="hidden lg:block lg:w-80 lg:shrink-0">
            <div className="lg:sticky lg:top-24">
              <Sidebar initialTherapists={initialSidebarTherapists} initialShops={initialSidebarShops} />
            </div>
          </div>
          </div>{/* end flex row */}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
