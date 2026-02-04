"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, MapPin, Clock, Users, MessageSquare, SlidersHorizontal } from "lucide-react";
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
  allTherapists: Therapist[];
  therapistTypes: readonly TherapistType[];
  bodyTypes: readonly BodyType[];
}

export function ShopListPageClient({
  prefecture,
  district,
  decodedPrefecture,
  decodedDistrict,
  shops,
  allTherapists,
  therapistTypes,
  bodyTypes,
}: ShopListPageClientProps) {
  const [sortBy, setSortBy] = useState("reviews");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);

  // Get therapists for each shop
  const getShopTherapists = (shopId: string) => allTherapists.filter(t => t.shopId === shopId).slice(0, 3);

  // Sort shops
  const sortedShops = [...shops].sort((a, b) => {
    if (sortBy === "reviews") return b.reviewCount - a.reviewCount;
    if (sortBy === "score") return b.averageScore - a.averageScore;
    return 0;
  });

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

          <h1 className="text-2xl font-bold mb-6">{decodedDistrict}のメンズエステ店舗一覧</h1>

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
                          <SelectItem value="reviews">口コミ数順</SelectItem>
                          <SelectItem value="score">平均点順</SelectItem>
                          <SelectItem value="new">新着順</SelectItem>
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
              {sortedShops.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <p>該当する店舗が見つかりませんでした</p>
                  </CardContent>
                </Card>
              ) : (
                sortedShops.map(shop => {
                  const shopTherapists = getShopTherapists(shop.id);
                  return (
                    <Link key={shop.id} href={`/shop/${shop.id}`}>
                      <Card className="transition-all hover:shadow-md hover:border-primary/20">
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
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <MapPin className="h-3 w-3" />
                                    <span>{shop.access}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded">
                                  <Star className="h-4 w-4 fill-primary text-primary" />
                                  <span className="font-bold text-primary">{shop.averageScore}</span>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{shop.hours}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  <span>{shop.therapistCount}人</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  <span>{shop.reviewCount}件</span>
                                </div>
                              </div>

                              <p className="text-sm mt-2">{shop.priceRange}</p>

                              <div className="flex flex-wrap gap-1 mt-2">
                                {shop.genres.map(genre => (
                                  <Badge key={genre} variant="secondary" className="text-xs">
                                    {genre}
                                  </Badge>
                                ))}
                              </div>

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
                })
              )}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
