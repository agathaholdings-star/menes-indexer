"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Star,
  MapPin,
  Lock,
  Flame,
  Gem,
  ChevronDown,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { therapists, therapistTypes, areas } from "@/lib/data";

type MemberLevel = "guest" | "free" | "freePosted" | "standard" | "vip";

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialType = searchParams.get("type") || "";

  // Demo: 会員レベル切替
  const [memberLevel, setMemberLevel] = useState<MemberLevel>("free");

  // フィルター状態
  const [query, setQuery] = useState(initialQuery);
  const [sortBy, setSortBy] = useState("reviews");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [shopName, setShopName] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    initialType ? [initialType] : []
  );
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [scoreFilter, setScoreFilter] = useState("");
  const [skrFilter, setSkrFilter] = useState(false);
  const [hrFilter, setHrFilter] = useState(false);

  // モーダル
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeType, setUpgradeType] = useState<"score" | "skr" | "hr">("score");

  // 権限チェック
  const canUseScoreFilter = ["freePosted", "standard", "vip"].includes(memberLevel);
  const canUseSKRFilter = ["standard", "vip"].includes(memberLevel);
  const canUseHRFilter = memberLevel === "vip";
  const canSeeRecommend = ["freePosted", "standard", "vip"].includes(memberLevel);
  const canSeeSKRBadge = ["standard", "vip"].includes(memberLevel);
  const canSeeHRBadge = memberLevel === "vip";

  const styleOptions = [
    { id: "slender", label: "スレンダー" },
    { id: "normal", label: "普通" },
    { id: "glamour", label: "グラマー" },
    { id: "chubby", label: "ぽっちゃり" },
  ];

  const currentArea = areas.find((a) => a.id === selectedArea);

  // フィルタリング
  const filteredTherapists = therapists.filter((t) => {
    const matchesQuery =
      !query ||
      t.name.includes(query) ||
      t.shopName.includes(query) ||
      t.tags.some((tag) => tag.includes(query));
    const matchesShop = !shopName || t.shopName.includes(shopName);
    const matchesType =
      selectedTypes.length === 0 || selectedTypes.includes(t.primaryType);
    const matchesStyle =
      selectedStyles.length === 0 || selectedStyles.includes(t.bodyType);
    const matchesArea = !selectedArea || t.area.includes(currentArea?.name || "");
    const matchesScore =
      !scoreFilter ||
      !canUseScoreFilter ||
      t.averageScore >= parseInt(scoreFilter);
    return matchesQuery && matchesShop && matchesType && matchesStyle && matchesArea && matchesScore;
  });

  // ソート
  const sortedTherapists = [...filteredTherapists].sort((a, b) => {
    switch (sortBy) {
      case "rating":
        return b.averageScore - a.averageScore;
      case "reviews":
        return b.reviewCount - a.reviewCount;
      case "newest":
        return 0;
      default:
        return b.reviewCount - a.reviewCount;
    }
  });

  const toggleType = (typeId: string) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  const toggleStyle = (styleId: string) => {
    setSelectedStyles((prev) =>
      prev.includes(styleId) ? prev.filter((s) => s !== styleId) : [...prev, styleId]
    );
  };

  const handleLockedFilter = (type: "score" | "skr" | "hr") => {
    setUpgradeType(type);
    setShowUpgradeModal(true);
  };

  const clearFilters = () => {
    setQuery("");
    setSelectedArea("");
    setSelectedDistrict("");
    setShopName("");
    setSelectedTypes([]);
    setSelectedStyles([]);
    setScoreFilter("");
    setSkrFilter(false);
    setHrFilter(false);
  };

  // モックのSKR/HRデータ（実際はDBから取得）
  const hasSKR = (id: string) => ["1", "3", "5"].includes(id);
  const hasHR = (id: string) => ["2", "4"].includes(id);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <SiteHeader />

        <main className="container mx-auto px-4 py-6">
          {/* Demo: 会員レベル切替 */}
          <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">Demo会員切替:</span>
            {(["guest", "free", "freePosted", "standard", "vip"] as MemberLevel[]).map(
              (level) => (
                <Button
                  key={level}
                  size="sm"
                  variant={memberLevel === level ? "default" : "outline"}
                  onClick={() => setMemberLevel(level)}
                  className={memberLevel !== level ? "bg-transparent" : ""}
                >
                  {level === "guest" && "未登録"}
                  {level === "free" && "無料(未投稿)"}
                  {level === "freePosted" && "無料(投稿済)"}
                  {level === "standard" && "スタンダード"}
                  {level === "vip" && "VIP"}
                </Button>
              )
            )}
          </div>

          {/* 検索フォーム（Sticky） */}
          <div className="sticky top-0 z-40 bg-background pb-4 border-b mb-6">
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* 基本フィルター */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* エリア */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">エリア</label>
                    <div className="flex gap-2">
                      <Select value={selectedArea} onValueChange={(v) => { setSelectedArea(v); setSelectedDistrict(""); }}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="都道府県" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全国</SelectItem>
                          {areas.map((area) => (
                            <SelectItem key={area.id} value={area.id}>
                              {area.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {currentArea && (
                        <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="地区" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全地区</SelectItem>
                            {currentArea.districts.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {/* サロン名 */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">サロン名</label>
                    <Input
                      placeholder="サロン名で検索"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                    />
                  </div>

                  {/* 並び替え */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">並び替え</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reviews">口コミ数順</SelectItem>
                        <SelectItem value="rating">平均点順</SelectItem>
                        <SelectItem value="newest">新着順</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 検索ボタン */}
                  <div className="flex items-end">
                    <Button className="w-full gap-2">
                      <Search className="h-4 w-4" />
                      検索
                    </Button>
                  </div>
                </div>

                {/* タイプ */}
                <div>
                  <label className="text-sm font-medium mb-2 block">タイプ</label>
                  <div className="flex flex-wrap gap-2">
                    {therapistTypes.map((type) => (
                      <label
                        key={type.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                          selectedTypes.includes(type.id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        <Checkbox
                          checked={selectedTypes.includes(type.id)}
                          onCheckedChange={() => toggleType(type.id)}
                          className="hidden"
                        />
                        <span className="text-sm">{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* スタイル */}
                <div>
                  <label className="text-sm font-medium mb-2 block">スタイル</label>
                  <div className="flex flex-wrap gap-2">
                    {styleOptions.map((style) => (
                      <label
                        key={style.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                          selectedStyles.includes(style.id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        <Checkbox
                          checked={selectedStyles.includes(style.id)}
                          onCheckedChange={() => toggleStyle(style.id)}
                          className="hidden"
                        />
                        <span className="text-sm">{style.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 有料フィルター */}
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
                  {/* 点数フィルター */}
                  <div className="flex items-center gap-2">
                    {canUseScoreFilter ? (
                      <Select value={scoreFilter} onValueChange={setScoreFilter}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="点数指定なし" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">指定なし</SelectItem>
                          <SelectItem value="80">80点以上</SelectItem>
                          <SelectItem value="70">70点以上</SelectItem>
                          <SelectItem value="60">60点以上</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            className="gap-2 opacity-60 bg-transparent"
                            onClick={() => handleLockedFilter("score")}
                          >
                            <Lock className="h-4 w-4" />
                            点数フィルター
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>口コミを投稿して解放</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* SKRフィルター */}
                  <div className="flex items-center gap-2">
                    {canUseSKRFilter ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={skrFilter}
                          onCheckedChange={(v) => setSkrFilter(v as boolean)}
                        />
                        <Flame className="h-4 w-4 text-orange-500" />
                        <span className="text-sm">SKRあり</span>
                      </label>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            className="gap-2 opacity-60 bg-transparent"
                            onClick={() => handleLockedFilter("skr")}
                          >
                            <Lock className="h-4 w-4" />
                            <Flame className="h-4 w-4" />
                            SKR
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>スタンダードプランで解放</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* HRフィルター */}
                  <div className="flex items-center gap-2">
                    {canUseHRFilter ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={hrFilter}
                          onCheckedChange={(v) => setHrFilter(v as boolean)}
                        />
                        <Gem className="h-4 w-4 text-purple-500" />
                        <span className="text-sm">HRあり</span>
                      </label>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            className="gap-2 opacity-60 bg-transparent"
                            onClick={() => handleLockedFilter("hr")}
                          >
                            <Lock className="h-4 w-4" />
                            <Gem className="h-4 w-4" />
                            HR
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>VIPプランで解放</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* クリアボタン */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="ml-auto gap-1"
                  >
                    <X className="h-4 w-4" />
                    クリア
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-6">
            {/* メインコンテンツ */}
            <div className="flex-1">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {sortedTherapists.length}件のセラピストが見つかりました
                </p>
              </div>

              {/* セラピストグリッド */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortedTherapists.map((therapist) => (
                  <Link key={therapist.id} href={`/therapist/${therapist.id}`}>
                    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full group">
                      <div className="aspect-[3/4] relative bg-muted">
                        <img
                          src={therapist.images[0] || "/placeholder.svg"}
                          alt={therapist.name}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* バッジ */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          <Badge className="bg-primary/90 text-primary-foreground text-xs">
                            {therapistTypes.find((t) => t.id === therapist.primaryType)?.label}
                          </Badge>
                        </div>
                        {/* SKR/HRバッジ */}
                        <div className="absolute top-2 right-2 flex flex-col gap-1">
                          {canSeeSKRBadge && hasSKR(therapist.id) && (
                            <Badge className="bg-orange-500 text-white gap-1">
                              <Flame className="h-3 w-3" />
                              SKR
                            </Badge>
                          )}
                          {canSeeHRBadge && hasHR(therapist.id) && (
                            <Badge className="bg-purple-600 text-white gap-1">
                              <Gem className="h-3 w-3" />
                              HR
                            </Badge>
                          )}
                        </div>
                        {/* スコア */}
                        <div className="absolute bottom-2 right-2">
                          <Badge variant="secondary" className="bg-background/90 text-foreground gap-1">
                            <Star className="h-3 w-3 fill-primary text-primary" />
                            {therapist.averageScore}点
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <div className="mb-1">
                          <h3 className="font-bold text-sm">
                            {therapist.name}
                            <span className="font-normal text-muted-foreground ml-1">
                              ({therapist.age})
                            </span>
                          </h3>
                          <p className="text-xs text-muted-foreground">{therapist.shopName}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <MapPin className="h-3 w-3" />
                          <span>
                            {therapist.area} {therapist.district}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {therapist.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs py-0">
                              {tag}
                            </Badge>
                          ))}
                          <Badge variant="outline" className="text-xs py-0">
                            {styleOptions.find((s) => s.id === therapist.bodyType)?.label}
                          </Badge>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          口コミ {therapist.reviewCount}件
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {sortedTherapists.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    条件に一致するセラピストが見つかりませんでした
                  </p>
                  <Button variant="outline" onClick={clearFilters} className="bg-transparent">
                    条件をクリアして再検索
                  </Button>
                </div>
              )}

              {/* ページネーション */}
              {sortedTherapists.length > 0 && (
                <div className="flex justify-center gap-2 mt-8">
                  <Button variant="outline" size="sm" disabled className="bg-transparent">
                    前へ
                  </Button>
                  <Button variant="default" size="sm">
                    1
                  </Button>
                  <Button variant="outline" size="sm" className="bg-transparent">
                    2
                  </Button>
                  <Button variant="outline" size="sm" className="bg-transparent">
                    3
                  </Button>
                  <Button variant="outline" size="sm" className="bg-transparent">
                    次へ
                  </Button>
                </div>
              )}
            </div>

            {/* サイドバー: レコメンド */}
            <div className="hidden xl:block w-80 shrink-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    あなたへのおすすめ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {canSeeRecommend ? (
                    <div className="space-y-4">
                      {therapists.slice(0, 4).map((t) => (
                        <Link key={t.id} href={`/therapist/${t.id}`}>
                          <div className="flex gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                            <img
                              src={t.images[0] || "/placeholder.svg"}
                              alt={t.name}
                              className="w-16 h-20 object-cover rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-sm truncate">{t.name}</span>
                                {canSeeSKRBadge && hasSKR(t.id) && (
                                  <Flame className="h-3 w-3 text-orange-500 shrink-0" />
                                )}
                                {canSeeHRBadge && hasHR(t.id) && (
                                  <Gem className="h-3 w-3 text-purple-500 shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {t.shopName}
                              </p>
                              <p className="text-xs text-primary mt-1">
                                {therapistTypes.find((type) => type.id === t.primaryType)?.label}
                                が好きなあなたに
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <Star className="h-3 w-3 fill-primary text-primary" />
                                <span className="text-xs font-medium">{t.averageScore}点</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        口コミを投稿すると
                        <br />
                        おすすめが表示されます
                      </p>
                      <Button size="sm" asChild>
                        <Link href="/review">口コミを投稿</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        <SiteFooter />

        {/* アップグレードモーダル */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {upgradeType === "score" && "点数フィルターを解放"}
                {upgradeType === "skr" && "SKRフィルターを解放"}
                {upgradeType === "hr" && "HRフィルターを解放"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {upgradeType === "score" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    点数フィルターを使うと、高評価のセラピストだけを絞り込めます。
                  </p>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-medium mb-2">解放方法</p>
                    <p className="text-sm">口コミを1件投稿すると無料で解放されます</p>
                  </div>
                  <Button className="w-full" asChild>
                    <Link href="/review">口コミを投稿して解放</Link>
                  </Button>
                </>
              )}
              {upgradeType === "skr" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    SKRフィルターを使うと、特別なサービスがあるセラピストを検索できます。
                  </p>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-medium mb-2">スタンダードプラン</p>
                    <p className="text-2xl font-bold text-primary">
                      ¥4,980<span className="text-sm font-normal">/月</span>
                    </p>
                  </div>
                  <Button className="w-full" asChild>
                    <Link href="/pricing">プランを確認</Link>
                  </Button>
                </>
              )}
              {upgradeType === "hr" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    HRフィルターを使うと、プレミアムなサービスがあるセラピストを検索できます。
                  </p>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-medium mb-2">VIPプラン</p>
                    <p className="text-2xl font-bold text-primary">
                      ¥14,980<span className="text-sm font-normal">/月</span>
                    </p>
                  </div>
                  <Button className="w-full" asChild>
                    <Link href="/pricing">プランを確認</Link>
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">読み込み中...</div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
