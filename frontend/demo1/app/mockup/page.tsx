"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  MapPin,
  ChevronDown,
  Star,
  Sparkles,
  Heart,
  Crown,
  Flame,
  Smile,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { VipFilter } from "@/components/home/vip-filter";
import { PopularTherapists } from "@/components/home/popular-therapists";
import { AreaGrid } from "@/components/home/area-grid";
import { createSupabaseBrowser } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────

interface PrefOption {
  label: string;
  value: string;
  slug: string;
}

interface PickupReview {
  id: string;
  score: number;
  comment_first_impression: string;
  therapist_name: string;
  therapist_age: number | null;
  therapist_id: number;
  salon_name: string;
}

interface ScoreBadge {
  score: number;
  therapist_name: string;
}

// ─── Type Discovery Data ─────────────────────────────────

const discoveryTypes = [
  { id: "idol", label: "アイドル系", icon: Sparkles, description: "華やかさと親しみやすさ" },
  { id: "seiso", label: "清楚系", icon: Heart, description: "上品で癒やし系" },
  { id: "gal", label: "ギャル系", icon: Crown, description: "ノリが良く元気" },
  { id: "model", label: "モデル系", icon: Star, description: "高嶺の花スタイル" },
  { id: "imouto", label: "妹系", icon: Smile, description: "甘え上手で可愛い" },
  { id: "yoen", label: "艶系", icon: Flame, description: "大人の色気" },
];

// ─── Hero Section ────────────────────────────────────────

function MockupHero() {
  const router = useRouter();
  const defaultArea: PrefOption = { label: "全国", value: "", slug: "" };
  const [selectedArea, setSelectedArea] = useState<PrefOption>(defaultArea);
  const [searchQuery, setSearchQuery] = useState("");
  const [prefectures, setPrefectures] = useState<PrefOption[]>([defaultArea]);
  const [reviewCount, setReviewCount] = useState(0);
  const [scoreBadges, setScoreBadges] = useState<ScoreBadge[]>([]);
  const [visibleBadgeIndex, setVisibleBadgeIndex] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createSupabaseBrowser();

        // Fetch prefectures
        const prefsRes = await fetch("/api/prefectures");
        const prefs = await prefsRes.json();
        if (Array.isArray(prefs)) {
          setPrefectures([
            defaultArea,
            ...prefs.map((p: any) => ({
              label: p.name,
              value: p.name,
              slug: p.slug,
            })),
          ]);
        }

        // Fetch review count
        const { count } = await supabase
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("moderation_status", "approved");
        if (count !== null) setReviewCount(count);

        // Fetch latest 3 reviews for score badges
        const { data: latestReviews } = await supabase
          .from("reviews")
          .select("score, therapist_id, therapists(name)")
          .eq("moderation_status", "approved")
          .not("score", "is", null)
          .order("created_at", { ascending: false })
          .limit(3);

        if (latestReviews) {
          setScoreBadges(
            latestReviews.map((r: any) => ({
              score: r.score,
              therapist_name: (r.therapists as any)?.name || "---",
            }))
          );
        }
      } catch (err) {
        console.error("Hero data fetch error:", err);
      }
    }
    fetchData();
  }, []);

  // Animate score badges cycling
  useEffect(() => {
    if (scoreBadges.length === 0) return;
    const interval = setInterval(() => {
      setVisibleBadgeIndex((prev) => (prev + 1) % scoreBadges.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [scoreBadges.length]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedArea.slug) params.set("area", selectedArea.slug);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl text-center">
        {/* Catchcopy */}
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl text-balance leading-tight animate-fade-in-up">
          <span className="text-primary">
            {reviewCount > 0 ? reviewCount.toLocaleString() : "---"}件
          </span>
          の口コミから、あなたの
          <span className="relative inline-block">
            <span className="relative z-10">&quot;発見&quot;</span>
            <span className="absolute bottom-0 left-0 right-0 h-2 bg-primary/20 -z-0" />
          </span>
          が始まる
        </h1>

        {/* Score badges */}
        <div className="mt-6 flex items-center justify-center gap-3 h-10">
          {scoreBadges.length > 0 && (
            <div
              key={visibleBadgeIndex}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-md border animate-badge-pop"
            >
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-bold text-primary">
                {scoreBadges[visibleBadgeIndex]?.score}点
              </span>
              <span className="text-sm text-muted-foreground">
                {scoreBadges[visibleBadgeIndex]?.therapist_name}
              </span>
              <span className="text-xs text-muted-foreground/60">たった今</span>
            </div>
          )}
          {scoreBadges.length === 0 && (
            <div className="h-10" /> /* Placeholder while loading */
          )}
        </div>

        {/* Search Bar */}
        <div className="mt-8 mx-auto max-w-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center rounded-xl bg-white p-1.5 shadow-lg border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto gap-2 text-foreground hover:bg-muted justify-start sm:justify-center px-4"
                >
                  <MapPin className="h-4 w-4 text-primary" />
                  {selectedArea.label}
                  <ChevronDown className="h-4 w-4 ml-auto sm:ml-1 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-80 overflow-y-auto"
              >
                {prefectures.map((area) => (
                  <DropdownMenuItem
                    key={area.slug || "all"}
                    onClick={() => setSelectedArea(area)}
                  >
                    {area.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="hidden sm:block w-px h-8 bg-border" />

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="店舗名・セラピスト名で検索"
                className="pl-10 border-0 shadow-none focus-visible:ring-0 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            <Button
              size="lg"
              className="w-full sm:w-auto px-8 rounded-xl"
              onClick={handleSearch}
            >
              <Search className="h-4 w-4 mr-2 sm:hidden" />
              検索
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Pickup Reviews Section ──────────────────────────────

function PickupReviews() {
  const [reviews, setReviews] = useState<PickupReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPickup() {
      try {
        const supabase = createSupabaseBrowser();
        const { data } = await supabase
          .from("reviews")
          .select(
            "id, score, comment_first_impression, therapist_id, therapists(name, age, salon_id, salons(name, display_name))"
          )
          .eq("moderation_status", "approved")
          .not("score", "is", null)
          .not("comment_first_impression", "is", null)
          .order("created_at", { ascending: false })
          .limit(5);

        if (data) {
          setReviews(
            data.map((r: any) => {
              const t = r.therapists as any;
              const s = t?.salons as any;
              return {
                id: r.id,
                score: r.score,
                comment_first_impression: r.comment_first_impression || "",
                therapist_name: t?.name || "---",
                therapist_age: t?.age || null,
                therapist_id: r.therapist_id,
                salon_name: s?.display_name || s?.name || "",
              };
            })
          );
        }
      } catch (err) {
        console.error("Pickup reviews fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPickup();
  }, []);

  if (loading) {
    return (
      <section className="mx-auto max-w-5xl px-4 mt-10">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-primary" />
          今週のピックアップ口コミ
        </h2>
        <div className="flex gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-[280px] h-[180px] flex-shrink-0 rounded-xl bg-muted animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  if (reviews.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          今週のピックアップ口コミ
        </h2>
        <Link
          href="/search"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          すべて見る
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 pb-4">
          {reviews.map((review) => (
            <Link
              key={review.id}
              href={`/therapist/${review.therapist_id}`}
              className="w-[280px] flex-shrink-0"
            >
              <Card className="group h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-muted/50 overflow-hidden">
                <CardContent className="p-4">
                  {/* Score */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-bold text-primary text-lg">
                        {review.score}
                      </span>
                      <span className="text-xs text-muted-foreground">点</span>
                    </div>
                  </div>

                  {/* Therapist info */}
                  <div className="mb-2">
                    <span className="font-bold text-sm">
                      {review.therapist_name}
                    </span>
                    {review.therapist_age && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({review.therapist_age})
                      </span>
                    )}
                    {review.salon_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {review.salon_name}
                      </p>
                    )}
                  </div>

                  {/* Comment with blur */}
                  <div className="relative">
                    <p className="text-sm text-muted-foreground line-clamp-2 whitespace-normal">
                      {review.comment_first_impression.slice(0, 50)}...
                    </p>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/80 pointer-events-none" />
                  </div>

                  <p className="text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    詳細を見る &rarr;
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}

// ─── Type Discovery Section ──────────────────────────────

function TypeDiscovery() {
  return (
    <section className="mx-auto max-w-5xl px-4 mt-10">
      <div className="rounded-xl bg-muted/30 p-6">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-lg font-bold">タイプで発見する</h2>
          <Badge className="bg-primary/10 text-primary border-0 text-xs font-medium">
            独自機能
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {discoveryTypes.map((type) => {
            const Icon = type.icon;
            return (
              <Link key={type.id} href={`/search?type=${type.id}`}>
                <button className="w-full flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 group">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary transition-transform duration-200 group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm">{type.label}</span>
                    <p className="text-xs text-muted-foreground">
                      {type.description}
                    </p>
                  </div>
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function MockupPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        {/* 1. Hero */}
        <MockupHero />

        {/* 2. Pickup Reviews */}
        <PickupReviews />

        {/* 3. Type Discovery */}
        <TypeDiscovery />

        {/* 4. VIP Filter */}
        <div className="mx-auto max-w-5xl px-4">
          <VipFilter />
        </div>

        {/* 5. Popular Therapists */}
        <div className="mx-auto max-w-5xl px-4">
          <PopularTherapists />
        </div>

        {/* 6. Area Grid */}
        <div className="mx-auto max-w-5xl px-4">
          <AreaGrid />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
