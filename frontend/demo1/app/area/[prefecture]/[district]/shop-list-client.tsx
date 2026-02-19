"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, MapPin, Clock, Users, MessageSquare, SlidersHorizontal, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import type { Shop, Therapist, TherapistType, BodyType } from "@/lib/data";

interface ShopListPageClientProps {
  prefecture: string;
  district: string;
  decodedPrefecture: string;
  decodedDistrict: string;
  shops: Shop[];
  unrankedShops: Shop[];
  allTherapists: Therapist[];
  therapistTypes: readonly TherapistType[];
  bodyTypes: readonly BodyType[];
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500 text-white font-bold text-sm shrink-0 shadow-sm">
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-400 text-white font-bold text-sm shrink-0 shadow-sm">
        2
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-700 text-white font-bold text-sm shrink-0 shadow-sm">
        3
      </div>
    );
  }
  if (rank <= 10) {
    return (
      <div className="flex items-center justify-center w-8 h-8 text-muted-foreground font-semibold text-sm shrink-0">
        {rank}位
      </div>
    );
  }
  return null;
}

export function ShopListPageClient({
  prefecture,
  district,
  decodedPrefecture,
  decodedDistrict,
  shops,
  unrankedShops,
  allTherapists,
  therapistTypes,
  bodyTypes,
}: ShopListPageClientProps) {
  const [sortBy, setSortBy] = useState("ranking");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);

  // Get therapists for each shop
  const getShopTherapists = (shopId: string) => allTherapists.filter(t => t.shopId === shopId).slice(0, 3);

  // Sort ranked shops
  const sortedShops = useMemo(() => {
    const sorted = [...shops];
    if (sortBy === "ranking") {
      sorted.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    } else if (sortBy === "reviews") {
      sorted.sort((a, b) => b.reviewCount - a.reviewCount);
    } else if (sortBy === "score") {
      sorted.sort((a, b) => b.averageScore - a.averageScore);
    }
    return sorted;
  }, [shops, sortBy]);

  const toggleType = (typeId: string) => {
    setSelectedTypes(prev =>
      prev.includes(typeId) ? prev.filter(t => t !== typeId) : [...prev, typeId]
    );
  };

  const toggleStyle = (styleId: string) => {
    setSelectedStyles(prev =>
      prev.includes(styleId) ? prev.filter(s => s !== styleId) : [...prev, styleId]
    );
  };

  const totalCount = shops.length + unrankedShops.length;

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

          <div className="mb-6">
            <h1 className="text-2xl font-bold">{decodedDistrict}のメンズエステ おすすめランキング</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalCount}店舗を口コミ・評価でランキング
            </p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Filters - Sidebar */}
            <aside className="lg:w-64 shrink-0">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <SlidersHorizontal className="h-4 w-4" />
                    <h2 className="font-semibold">絞り込み</h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-2">並び替え</h3>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ranking">おすすめ順</SelectItem>
                          <SelectItem value="reviews">口コミ数順</SelectItem>
                          <SelectItem value="score">平均点順</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-2">タイプ</h3>
                      <div className="space-y-2">
                        {therapistTypes.map(type => (
                          <label key={type.id} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={selectedTypes.includes(type.id)}
                              onCheckedChange={() => toggleType(type.id)}
                            />
                            <span className="text-sm">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-2">スタイル</h3>
                      <div className="space-y-2">
                        {bodyTypes.map(body => (
                          <label key={body.id} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={selectedStyles.includes(body.id)}
                              onCheckedChange={() => toggleStyle(body.id)}
                            />
                            <span className="text-sm">{body.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </aside>

            {/* Shop List */}
            <div className="flex-1 space-y-4">
              {totalCount === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <p>該当する店舗が見つかりませんでした</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Ranked shops */}
                  {sortedShops.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Trophy className="h-4 w-4" />
                        <span>口コミランキング（{sortedShops.length}店舗）</span>
                      </div>
                      {sortedShops.map(shop => {
                        const shopTherapists = getShopTherapists(shop.id);
                        return (
                          <Link key={shop.id} href={`/shop/${shop.id}`}>
                            <Card className="transition-all hover:shadow-md hover:border-primary/20">
                              <CardContent className="p-4">
                                <div className="flex flex-col gap-4 sm:flex-row">
                                  {/* Rank Badge + Shop Image */}
                                  <div className="flex gap-3 sm:gap-3 items-start">
                                    {shop.rank && shop.rank <= 10 && (
                                      <RankBadge rank={shop.rank} />
                                    )}
                                    <div className="relative w-full sm:w-48 h-32 rounded-lg overflow-hidden bg-muted shrink-0">
                                      <Image
                                        src={shop.images[0] || "/placeholder.svg"}
                                        alt={shop.name}
                                        fill
                                        className="object-cover"
                                      />
                                    </div>
                                  </div>

                                  {/* Shop Info */}
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <h3 className="font-bold text-lg">{shop.name}</h3>
                                        {shop.access && (
                                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                            <MapPin className="h-3 w-3" />
                                            <span>{shop.access}</span>
                                          </div>
                                        )}
                                      </div>
                                      {shop.averageScore > 0 && (
                                        <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded">
                                          <Star className="h-4 w-4 fill-primary text-primary" />
                                          <span className="font-bold text-primary">{shop.averageScore.toFixed(1)}</span>
                                        </div>
                                      )}
                                    </div>

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

                                    {shop.genres.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {shop.genres.map(genre => (
                                          <Badge key={genre} variant="secondary" className="text-xs">
                                            {genre}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}

                                    {/* Popular Therapists */}
                                    {shopTherapists.length > 0 && (
                                      <div className="flex items-center gap-2 mt-3">
                                        <span className="text-xs text-muted-foreground">人気セラピスト:</span>
                                        <div className="flex -space-x-2">
                                          {shopTherapists.map(t => (
                                            <div key={t.id} className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-card">
                                              <Image src={t.images[0] || "/placeholder.svg"} alt={t.name} fill className="object-cover" />
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
                      })}
                    </>
                  )}

                  {/* Unranked shops */}
                  {unrankedShops.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-8 pt-4 border-t">
                        <span>まだ口コミがない店舗（{unrankedShops.length}店舗）</span>
                      </div>
                      {unrankedShops.map(shop => {
                        const shopTherapists = getShopTherapists(shop.id);
                        return (
                          <Link key={shop.id} href={`/shop/${shop.id}`}>
                            <Card className="transition-all hover:shadow-md hover:border-primary/20 opacity-80">
                              <CardContent className="p-4">
                                <div className="flex flex-col gap-4 sm:flex-row">
                                  {/* Shop Image */}
                                  <div className="relative w-full sm:w-48 h-32 rounded-lg overflow-hidden bg-muted shrink-0">
                                    <Image
                                      src={shop.images[0] || "/placeholder.svg"}
                                      alt={shop.name}
                                      fill
                                      className="object-cover"
                                    />
                                  </div>

                                  {/* Shop Info */}
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <h3 className="font-bold text-lg">{shop.name}</h3>
                                        {shop.access && (
                                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                            <MapPin className="h-3 w-3" />
                                            <span>{shop.access}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

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
                                    </div>

                                    {shop.priceRange && (
                                      <p className="text-sm font-medium mt-2">{shop.priceRange}</p>
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

                                    {shopTherapists.length > 0 && (
                                      <div className="flex items-center gap-2 mt-3">
                                        <span className="text-xs text-muted-foreground">人気セラピスト:</span>
                                        <div className="flex -space-x-2">
                                          {shopTherapists.map(t => (
                                            <div key={t.id} className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-card">
                                              <Image src={t.images[0] || "/placeholder.svg"} alt={t.name} fill className="object-cover" />
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
                      })}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
