"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { TherapistImage } from "@/components/shared/therapist-image";
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
  Loader2,
  SlidersHorizontal,
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
import { therapistTypes, type User, getEffectiveTier, tierPermissions } from "@/lib/data";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { cleanTherapistName, isPlaceholderName } from "@/lib/therapist-utils";
import { CompatibilityLabel } from "@/components/therapist/compatibility-label";

interface PrefectureOption {
  id: string;
  name: string;
  districts: string[];
}

interface DBTherapist {
  id: number;
  name: string;
  age: number | null;
  image_url: string | null;
  salon_id: number;
  shop_name: string;
  shop_access: string | null;
  avg_score: number | null;
  review_count: number;
  looks_types: string[];
  body_types: string[];
  service_levels: string[];
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialType = searchParams.get("type") || "";
  const { user: authUser } = useAuth();

  // ティアチェック
  const [membershipType, setMembershipType] = useState<string>("free");
  const [monthlyReviewCount, setMonthlyReviewCount] = useState(0);

  useEffect(() => {
    if (!authUser) return;
    const sb = createSupabaseBrowser();
    sb.from("profiles")
      .select("membership_type, monthly_review_count")
      .eq("id", authUser.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setMembershipType(data.membership_type || "free");
          setMonthlyReviewCount(data.monthly_review_count || 0);
        }
      });
  }, [authUser]);

  const tierUser: User = {
    id: authUser?.id || "",
    email: authUser?.email || "",
    name: "",
    memberType: (membershipType as "free" | "standard" | "vip"),
    monthlyReviewCount,
    totalReviewCount: 0,
    registeredAt: "",
    favorites: [],
  };
  const effectiveTier = authUser ? getEffectiveTier(tierUser) : "free";
  const permissions = tierPermissions[effectiveTier];

  // エリアデータ（Supabaseから取得）
  const [areas, setAreas] = useState<PrefectureOption[]>([]);

  useEffect(() => {
    async function fetchAreas() {
      try {
        const [prefsRes, areasRes] = await Promise.all([
          fetch("/api/prefectures"),
          fetch("/api/areas"),
        ]);
        const prefectures = await prefsRes.json();
        const allAreas = await areasRes.json();
        if (!Array.isArray(prefectures) || !Array.isArray(allAreas)) return;

        const areasByPref = new Map<number, string[]>();
        for (const a of allAreas) {
          const list = areasByPref.get(a.prefecture_id) || [];
          list.push(a.name);
          areasByPref.set(a.prefecture_id, list);
        }

        setAreas(
          prefectures
            .filter((p: any) => (areasByPref.get(p.id) || []).length > 0)
            .map((p: any) => ({
              id: p.slug,
              name: p.name,
              districts: areasByPref.get(p.id) || [],
            }))
        );
      } catch (err) {
        console.error("エリア取得エラー:", err);
      }
    }
    fetchAreas();
  }, []);

  // 店舗検索結果（qパラメータがある場合）
  const [shopResults, setShopResults] = useState<{ id: number; name: string; display_name: string | null; access: string | null; image_url: string | null; slug: string | null }[]>([]);
  const [shopSearchLoading, setShopSearchLoading] = useState(false);

  useEffect(() => {
    if (!initialQuery) return;
    setShopSearchLoading(true);
    async function searchShops() {
      try {
        const res = await fetch(`/api/salons?search=${encodeURIComponent(initialQuery)}&limit=12`);
        const data = await res.json();
        setShopResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("店舗検索エラー:", err);
      } finally {
        setShopSearchLoading(false);
      }
    }
    searchShops();
  }, [initialQuery]);

  // セラピスト検索結果（DBから取得 + reviewsフィルタ）
  const [dbTherapists, setDbTherapists] = useState<DBTherapist[]>([]);
  const [therapistLoading, setTherapistLoading] = useState(true);
  const [searchTriggered, setSearchTriggered] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    async function fetchTherapists() {
      setTherapistLoading(true);

      try {
        // 1) reviewsベースのフィルタが必要かチェック
        const needsReviewFilter =
          selectedTypes.length > 0 ||
          selectedStyles.length > 0 ||
          (scoreFilter && scoreFilter !== "none") ||
          skrFilter ||
          hrFilter;

        let therapistIds: number[] | null = null;
        const reviewAggMap = new Map<number, { avg_score: number; count: number; looks: Set<string>; bodies: Set<string>; services: Set<string> }>();

        if (needsReviewFilter) {
          const revRes = await fetch("/api/reviews?limit=10000");
          const revJson = await revRes.json();
          const revData = revJson.data;
          if (Array.isArray(revData)) {
            for (const r of revData) {
              const tid = Number(r.therapist_id);
              if (!reviewAggMap.has(tid)) {
                reviewAggMap.set(tid, { avg_score: 0, count: 0, looks: new Set(), bodies: new Set(), services: new Set() });
              }
              const agg = reviewAggMap.get(tid)!;
              agg.count++;
              agg.avg_score += (r.score || 0);
              if (r.looks_type_id) agg.looks.add(String(r.looks_type_id));
              if (r.body_type_id) agg.bodies.add(String(r.body_type_id));
              if (r.service_level_id) agg.services.add(String(r.service_level_id));
            }

            for (const [, agg] of reviewAggMap) {
              agg.avg_score = Math.round(agg.avg_score / agg.count);
            }

            therapistIds = [];
            for (const [tid, agg] of reviewAggMap) {
              if (selectedTypes.length > 0 && !selectedTypes.some((t) => agg.looks.has(t))) continue;
              if (selectedStyles.length > 0 && !selectedStyles.some((s) => agg.bodies.has(s))) continue;
              if (scoreFilter && scoreFilter !== "none") {
                const minScore = parseInt(scoreFilter);
                if (agg.avg_score < minScore) continue;
              }
              if (skrFilter && !agg.services.has("2") && !agg.services.has("3")) continue;
              if (hrFilter && !agg.services.has("3")) continue;
              therapistIds.push(tid);
            }

            if (therapistIds.length === 0) {
              setDbTherapists([]);
              return;
            }
          }
        }

        // 2) セラピスト取得（API経由）
        const params = new URLSearchParams();
        if (selectedArea && selectedArea !== "all") {
          params.set("area_slug", selectedArea);
          if (selectedDistrict && selectedDistrict !== "all") {
            params.set("district", selectedDistrict);
          }
        }
        if (therapistIds && therapistIds.length > 0) {
          params.set("ids", therapistIds.join(","));
        }
        if (query) {
          params.set("name", query);
        }
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", "0");

        const therapistRes = await fetch(`/api/therapists?${params.toString()}`);
        const data = await therapistRes.json();

        if (Array.isArray(data)) {
          // レビュー集計データがない場合は取得
          if (!needsReviewFilter) {
            const allRevRes = await fetch("/api/reviews?limit=10000");
            const allRevJson = await allRevRes.json();
            if (Array.isArray(allRevJson.data)) {
              for (const r of allRevJson.data) {
                const tid = Number(r.therapist_id);
                if (!reviewAggMap.has(tid)) {
                  reviewAggMap.set(tid, { avg_score: 0, count: 0, looks: new Set(), bodies: new Set(), services: new Set() });
                }
                const agg = reviewAggMap.get(tid)!;
                agg.count++;
                agg.avg_score += (r.score || 0);
                if (r.looks_type_id) agg.looks.add(String(r.looks_type_id));
                if (r.body_type_id) agg.bodies.add(String(r.body_type_id));
                if (r.service_level_id) agg.services.add(String(r.service_level_id));
              }
              for (const [, agg] of reviewAggMap) {
                agg.avg_score = Math.round(agg.avg_score / agg.count);
              }
            }
          }

          let filtered = data.filter((t: any) => {
            if (isPlaceholderName(t.name)) return false;
            const cleaned = cleanTherapistName(t.name);
            if (cleaned.length > 15) return false;
            const shop = t.salons as { name: string; display_name: string | null } | null;
            if (shop && (cleaned === shop.name || cleaned === shop.display_name)) return false;
            if (therapistIds && !therapistIds.includes(Number(t.id))) return false;
            return true;
          });

          setDbTherapists(
            filtered.map((t: any) => {
              const imgs = t.image_urls as string[] | null;
              const shop = t.salons as { name: string; display_name: string | null; access: string | null } | null;
              const agg = reviewAggMap.get(Number(t.id));
              return {
                id: Number(t.id),
                name: cleanTherapistName(t.name),
                age: t.age,
                image_url: imgs?.[0] || null,
                salon_id: Number(t.salon_id),
                shop_name: shop?.display_name || shop?.name || "",
                shop_access: shop?.access || null,
                avg_score: agg?.avg_score || null,
                review_count: agg?.count || 0,
                looks_types: agg ? [...agg.looks] : [],
                body_types: agg ? [...agg.bodies] : [],
                service_levels: agg ? [...agg.services] : [],
              };
            })
          );
          setHasMore(filtered.length >= PAGE_SIZE);
          setCurrentOffset(PAGE_SIZE);
        } else {
          setDbTherapists([]);
          setHasMore(false);
        }
      } catch (err) {
        console.error("セラピスト検索エラー:", err);
        setDbTherapists([]);
      } finally {
        setTherapistLoading(false);
      }
    }
    fetchTherapists();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTriggered]);

  // フィルター状態
  const [query, setQuery] = useState(initialQuery);
  const [sortBy, setSortBy] = useState("newest");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [shopName, setShopName] = useState("");

  // URLのqパラメータが変わったらqueryを同期して再検索
  useEffect(() => {
    setQuery(initialQuery);
    setShopName(initialQuery);
    setSearchTriggered((n) => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    initialType ? [initialType] : []
  );
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [scoreFilter, setScoreFilter] = useState("");
  const [skrFilter, setSkrFilter] = useState(false);
  const [hrFilter, setHrFilter] = useState(false);

  const loadMoreTherapists = useCallback(async () => {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (selectedArea && selectedArea !== "all") {
        params.set("area_slug", selectedArea);
        if (selectedDistrict && selectedDistrict !== "all") {
          params.set("district", selectedDistrict);
        }
      }
      if (query) {
        params.set("name", query);
      }
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(currentOffset));
      const res = await fetch(`/api/therapists?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const newTherapists = data.map((t: any) => {
          const imgs = t.image_urls as string[] | null;
          const shop = t.salons as { name: string; display_name: string | null; access: string | null } | null;
          return {
            id: Number(t.id),
            name: cleanTherapistName(t.name),
            age: t.age,
            image_url: imgs?.[0] || null,
            salon_id: Number(t.salon_id),
            shop_name: shop?.display_name || shop?.name || "",
            shop_access: shop?.access || null,
            avg_score: null,
            review_count: 0,
            looks_types: [],
            body_types: [],
            service_levels: [],
          };
        }).filter((t: DBTherapist) => !isPlaceholderName(t.name) && t.name.length <= 15);
        setDbTherapists(prev => [...prev, ...newTherapists]);
        setHasMore(data.length >= PAGE_SIZE);
        setCurrentOffset(prev => prev + PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("追加読み込みエラー:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [currentOffset, selectedArea, selectedDistrict, query]);

  // モーダル
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [filterHidden, setFilterHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > 200 && currentY > lastScrollY.current) {
        // スクロールダウン → フィルター非表示
        setFilterHidden(true);
        setFiltersExpanded(false);
      } else if (currentY < lastScrollY.current) {
        // スクロールアップ → フィルター表示
        setFilterHidden(false);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const [upgradeType, setUpgradeType] = useState<"score" | "skr" | "hr" | "discovery">("score");

  // 権限チェック（実際のティアから判定）
  const canUseScoreFilter = permissions.canViewScores;
  const canUseSKRFilter = permissions.canUseSKRFilter;
  const canUseHRFilter = permissions.canUseHRFilter;
  const canSeeRecommend = permissions.canViewScores;
  const canSeeSKRBadge = permissions.canUseSKRFilter;
  const canSeeHRBadge = permissions.canUseHRFilter;

  const styleOptions = [
    { id: "1", label: "華奢" },
    { id: "2", label: "スレンダー" },
    { id: "3", label: "バランス" },
    { id: "4", label: "グラマー" },
    { id: "5", label: "ぽっちゃり" },
  ];

  const currentArea = areas.find((a) => a.id === selectedArea);

  // クライアントサイドフィルタリング（テキスト検索のみ）
  const filteredTherapists = dbTherapists.filter((t) => {
    const matchesQuery =
      !query ||
      t.name.includes(query) ||
      t.shop_name.includes(query);
    const matchesShop = !shopName || t.shop_name.includes(shopName);
    return matchesQuery && matchesShop;
  });

  // ソート
  const sortedTherapists = [...filteredTherapists].sort((a, b) => {
    if (sortBy === "rating") return (b.avg_score || 0) - (a.avg_score || 0);
    if (sortBy === "reviews") return b.review_count - a.review_count;
    return 0; // newest = default DB order
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
    setSearchTriggered((n) => n + 1);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <SiteHeader />

        <main className="container mx-auto px-4 py-6">
          {/* 検索フォーム（Sticky） */}
          <div className={`sticky top-0 z-40 bg-background pb-4 border-b mb-6 transition-transform duration-300 ${filterHidden ? "-translate-y-full" : "translate-y-0"}`}>
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

                  {/* セラピスト名・サロン名 */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">セラピスト名・サロン名</label>
                    <Input
                      placeholder="セラピスト名・サロン名で検索"
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setShopName(e.target.value); }}
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
                        <SelectItem value="newest">新着順</SelectItem>
                        <SelectItem value="rating">平均点順</SelectItem>
                        <SelectItem value="reviews">口コミ数順</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 検索ボタン */}
                  <div className="flex items-end">
                    <Button className="w-full gap-2" onClick={() => setSearchTriggered((n) => n + 1)}>
                      <Search className="h-4 w-4" />
                      検索
                    </Button>
                  </div>
                </div>

                {/* モバイル: 絞り込みトグルボタン */}
                <div className="md:hidden flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    絞り込み
                    {(selectedTypes.length > 0 || selectedStyles.length > 0) && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {selectedTypes.length + selectedStyles.length}
                      </Badge>
                    )}
                    <ChevronDown className={`h-4 w-4 transition-transform ${filtersExpanded ? "rotate-180" : ""}`} />
                  </Button>
                </div>

                {/* タイプ・スタイル（モバイルでは折りたたみ、デスクトップは常時表示） */}
                <div className={`space-y-4 ${filtersExpanded ? "" : "hidden md:block"}`}>
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

                  {/* SKRフィルター（未ログインには非表示） */}
                  {authUser && (
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
                  )}

                  {/* HRフィルター（未ログインには非表示） */}
                  {authUser && (
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
                  )}

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
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 店舗検索結果 */}
          {initialQuery && (
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-3">
                「{initialQuery}」の店舗検索結果
                {!shopSearchLoading && <span className="text-sm font-normal text-muted-foreground ml-2">{shopResults.length}件</span>}
              </h2>
              {shopSearchLoading ? (
                <div className="animate-pulse h-24 bg-muted rounded" />
              ) : shopResults.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {shopResults.map((shop) => (
                    <Link key={shop.id} href={`/salon/${shop.id}`}>
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-3 flex gap-3">
                          <div className="relative w-16 h-16 rounded overflow-hidden bg-muted shrink-0">
                            <TherapistImage
                              src={shop.image_url}
                              alt={shop.display_name || shop.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{shop.display_name || shop.name}</p>
                            {shop.access && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{shop.access}</span>
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">該当する店舗が見つかりませんでした</p>
              )}
            </div>
          )}

          {/* 隠れた名セラピスト（発見検索） */}
          {!therapistLoading && (() => {
            const hidden = dbTherapists.filter(
              (t) => t.review_count >= 1 && t.review_count <= 3 && (t.avg_score || 0) >= 85
            );
            if (hidden.length === 0) return null;

            if (!permissions.canUseDiscoverySearch) {
              return (
                <Card className="mb-6 border-muted bg-muted/30">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h3 className="font-bold mb-1 flex items-center justify-center gap-2">
                      <Gem className="h-4 w-4 text-primary" />
                      隠れた名セラピスト
                      <Badge variant="secondary" className="text-xs">発見</Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      まだ発見されていないダイヤの原石を見つけよう
                    </p>
                    <Button size="sm" onClick={() => { setUpgradeType("discovery"); setShowUpgradeModal(true); }}>
                      解放方法を見る
                    </Button>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card className="mb-6 border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Gem className="h-5 w-5 text-primary" />
                    隠れた名セラピスト
                    <Badge variant="secondary" className="text-xs">発見</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    口コミ3件以下なのに全員が85点以上。まだ発見されていないダイヤの原石
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {hidden.slice(0, 8).map((t) => (
                      <Link key={t.id} href={`/therapist/${t.id}`} className="w-[150px] flex-shrink-0">
                        <Card className="overflow-hidden hover:shadow-md transition-shadow">
                          <div className="aspect-[3/4] relative bg-muted">
                            <TherapistImage src={t.image_url} alt={t.name} fill className="object-cover" />
                            <div className="absolute top-2 right-2">
                              <Badge className="bg-primary/90 text-primary-foreground text-xs gap-1">
                                <Star className="h-3 w-3 fill-current" />
                                {t.avg_score}
                              </Badge>
                            </div>
                          </div>
                          <CardContent className="p-2">
                            <p className="font-medium text-sm truncate">{t.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{t.shop_name}</p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <div className="flex gap-6">
            {/* メインコンテンツ */}
            <div className="flex-1">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {therapistLoading ? "読み込み中..." : sortedTherapists.length > 0 ? `${sortedTherapists.length}件のセラピストが見つかりました` : ""}
                </p>
              </div>

              {/* セラピストグリッド */}
              {therapistLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[...Array(8)].map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="aspect-[3/4] bg-muted animate-pulse" />
                      <CardContent className="p-3 space-y-2">
                        <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                        <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sortedTherapists.map((therapist) => (
                    <Link key={therapist.id} href={`/therapist/${therapist.id}`}>
                      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full group">
                        <div className="aspect-[3/4] relative bg-muted">
                          <TherapistImage
                            src={therapist.image_url}
                            alt={therapist.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <CardContent className="p-3">
                          <div className="mb-1">
                            <h3 className="font-bold text-sm">
                              {therapist.name}
                              {therapist.age && (
                                <span className="font-normal text-muted-foreground ml-1">
                                  ({therapist.age})
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-muted-foreground">{therapist.shop_name}</p>
                          </div>
                          {therapist.review_count > 0 && (
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              {therapist.avg_score && (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Star className="h-3 w-3 fill-current" />
                                  {therapist.avg_score}
                                </Badge>
                              )}
                              {canSeeSKRBadge && therapist.service_levels.includes("2") && (
                                <Badge className="text-xs bg-orange-100 text-orange-700">
                                  <Flame className="h-3 w-3 mr-0.5" />SKR
                                </Badge>
                              )}
                              {canSeeHRBadge && therapist.service_levels.includes("3") && (
                                <Badge className="text-xs bg-purple-100 text-purple-700">
                                  <Gem className="h-3 w-3 mr-0.5" />HR
                                </Badge>
                              )}
                            </div>
                          )}
                          <CompatibilityLabel therapistId={String(therapist.id)} variant="badge" />
                          {therapist.shop_access && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{therapist.shop_access}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}

              {/* もっと見るボタン */}
              {!therapistLoading && hasMore && (
                <div className="text-center py-6">
                  <Button
                    variant="outline"
                    onClick={loadMoreTherapists}
                    disabled={loadingMore}
                    className="gap-2"
                  >
                    {loadingMore ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />読み込み中...</>
                    ) : (
                      <><ChevronDown className="h-4 w-4" />もっと見る</>
                    )}
                  </Button>
                </div>
              )}

              {!therapistLoading && sortedTherapists.length === 0 && (
                <div className="text-center py-12">
                  {shopResults.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      上記のサロンページからセラピストを確認できます
                    </p>
                  ) : (
                    <>
                      <p className="text-muted-foreground mb-4">
                        条件に一致するセラピストが見つかりませんでした
                      </p>
                      <Button variant="outline" onClick={clearFilters} className="bg-transparent">
                        条件をクリアして再検索
                      </Button>
                    </>
                  )}
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
                      {dbTherapists.slice(0, 4).map((t) => (
                        <Link key={t.id} href={`/therapist/${t.id}`}>
                          <div className="flex gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                            <TherapistImage
                              src={t.image_url}
                              alt={t.name}
                              width={64}
                              height={80}
                              className="w-16 h-20 object-cover rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm truncate block">{t.name}</span>
                              <p className="text-xs text-muted-foreground truncate">
                                {t.shop_name}
                              </p>
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
                {upgradeType === "discovery" && "発見検索を解放"}
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
              {upgradeType === "discovery" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    「隠れた名セラピスト」は口コミが少ないのに高評価のダイヤの原石を発見できる機能です。
                  </p>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-medium mb-2">解放方法</p>
                    <p className="text-sm">スタンダードプラン加入 + 月1件以上の口コミ投稿で解放されます</p>
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
