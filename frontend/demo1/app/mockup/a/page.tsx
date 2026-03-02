"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Star, ArrowRight, Camera } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { cleanTherapistName, isPlaceholderName } from "@/lib/therapist-utils";

/* ────────────────────────────────────────────────────────────
   Pattern A: 和モダン Editorial
   ──────────────────────────────────────────────────────────
   Font:  Shippori Mincho (明朝体) + Zen Kaku Gothic New
   Color: Ink #1a1a1a / Warm white #faf8f5 / Vermilion #c7372f
   Layout: Asymmetric editorial, generous whitespace, vertical accents
   Vibe:  高級雑誌を読むような体験
   ──────────────────────────────────────────────────────────── */

// ─── Shared types ────────────────────────────────────────

interface PickupReview {
  id: string;
  score: number;
  comment: string;
  therapist_name: string;
  therapist_id: number;
  salon_name: string;
}

interface FeaturedTherapist {
  id: number;
  name: string;
  age: number | null;
  image_url: string | null;
  salon_name: string;
  score: number;
}

// ─── Inline image with fallback ──────────────────────────

function EditorialImage({ src, alt }: { src: string | null; alt: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="absolute inset-0 bg-[#e8e4df] flex flex-col items-center justify-center text-[#a09890]">
        <Camera className="h-8 w-8 mb-1 opacity-40" />
        <span className="text-xs opacity-40 font-sans">No Photo</span>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover"
      onError={() => setErr(true)}
      unoptimized
    />
  );
}

// ─── Header ──────────────────────────────────────────────

function EditorialHeader() {
  return (
    <header className="sticky top-0 z-50 bg-[#faf8f5]/95 backdrop-blur-sm border-b border-[#e0dbd5]">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <Link href="/mockup/a" className="flex items-baseline gap-2">
          <span
            className="text-2xl tracking-tight text-[#1a1a1a]"
            style={{ fontFamily: "'Shippori Mincho', serif" }}
          >
            メンエスSKR
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-[#6b6560]">
          <Link href="/ranking" className="hover:text-[#c7372f] transition-colors">
            ランキング
          </Link>
          <Link href="/search" className="hover:text-[#c7372f] transition-colors">
            検索
          </Link>
          <Link
            href="/login"
            className="px-4 py-1.5 border border-[#1a1a1a] text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-[#faf8f5] transition-colors text-xs tracking-wider uppercase"
          >
            ログイン
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ─── 1. Hero: Asymmetric Editorial ───────────────────────

function EditorialHero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState({ salons: 0, reviews: 0 });
  const [featured, setFeatured] = useState<FeaturedTherapist | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowser();
      const [salonRes, reviewRes] = await Promise.all([
        supabase.from("salons").select("*", { count: "exact", head: true }),
        supabase
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("moderation_status", "approved"),
      ]);
      setStats({
        salons: salonRes.count ?? 0,
        reviews: reviewRes.count ?? 0,
      });

      // One featured therapist with high score + image
      const { data } = await supabase
        .from("reviews")
        .select(
          "score, therapist_id, therapists(id, name, age, image_urls, salon_id, salons(name, display_name))"
        )
        .eq("moderation_status", "approved")
        .not("score", "is", null)
        .order("score", { ascending: false })
        .limit(50);

      if (data) {
        for (const r of data as any[]) {
          const t = r.therapists;
          if (!t) continue;
          const imgs = t.image_urls as string[] | null;
          if (!imgs?.[0]) continue;
          if (isPlaceholderName(t.name)) continue;
          const name = cleanTherapistName(t.name);
          if (name.length > 10) continue;
          const s = t.salons as any;
          setFeatured({
            id: t.id,
            name,
            age: t.age,
            image_url: imgs[0],
            salon_name: s?.display_name || s?.name || "",
            score: r.score,
          });
          break;
        }
      }
    }
    load();
  }, []);

  return (
    <section className="bg-[#faf8f5] overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          {/* Left: Text */}
          <div className="lg:col-span-7 space-y-8">
            {/* Vertical accent line + label */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-px bg-[#c7372f]" />
              <span className="text-xs tracking-[0.3em] text-[#c7372f] uppercase">
                口コミで発見する
              </span>
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-6xl leading-[1.2] text-[#1a1a1a]"
              style={{ fontFamily: "'Shippori Mincho', serif" }}
            >
              確認で終わらない、
              <br />
              <span className="relative inline-block">
                発見が始まる
                <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-[#c7372f]" />
              </span>
            </h1>

            <p className="text-[#6b6560] text-base leading-relaxed max-w-lg">
              {stats.salons > 0 ? stats.salons.toLocaleString() : "---"}店舗、
              {stats.reviews > 0 ? stats.reviews.toLocaleString() : "---"}
              件の口コミから
              あなたにぴったりのセラピストに出会う。
            </p>

            {/* Search */}
            <div className="max-w-md">
              <div className="relative">
                <input
                  type="search"
                  placeholder="店舗名・セラピスト名で検索"
                  className="w-full border-b-2 border-[#1a1a1a] bg-transparent py-3 pr-12 text-base text-[#1a1a1a] placeholder:text-[#b0aaa4] outline-none focus:border-[#c7372f] transition-colors"
                  style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif" }}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && query.trim()) {
                      router.push(`/search?q=${encodeURIComponent(query)}`);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (query.trim())
                      router.push(`/search?q=${encodeURIComponent(query)}`);
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[#1a1a1a] hover:text-[#c7372f] transition-colors cursor-pointer"
                  aria-label="検索"
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Featured therapist image */}
          <div className="lg:col-span-5">
            {featured ? (
              <Link href={`/therapist/${featured.id}`} className="block group">
                <div className="relative aspect-[3/4] max-w-[360px] mx-auto lg:ml-auto overflow-hidden">
                  <EditorialImage src={featured.image_url} alt={featured.name} />
                  {/* Overlay caption */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#1a1a1a]/80 to-transparent p-6 pt-16">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="h-4 w-4 fill-[#c7372f] text-[#c7372f]" />
                      <span className="text-white font-bold">{featured.score}点</span>
                    </div>
                    <p
                      className="text-white text-xl"
                      style={{ fontFamily: "'Shippori Mincho', serif" }}
                    >
                      {featured.name}
                      {featured.age && (
                        <span className="text-white/60 text-sm ml-2">
                          ({featured.age})
                        </span>
                      )}
                    </p>
                    <p className="text-white/50 text-sm mt-0.5">
                      {featured.salon_name}
                    </p>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="aspect-[3/4] max-w-[360px] mx-auto lg:ml-auto bg-[#e8e4df] animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 2. Type Discovery: Numbered List ────────────────────

const types = [
  { id: "idol", label: "アイドル系", sub: "華やかさと親しみやすさ" },
  { id: "seiso", label: "清楚系", sub: "上品で癒やし系" },
  { id: "gal", label: "ギャル系", sub: "ノリが良く元気" },
  { id: "model", label: "モデル系", sub: "高嶺の花スタイル" },
  { id: "imouto", label: "妹系", sub: "甘え上手で可愛い" },
  { id: "yoen", label: "艶系", sub: "大人の色気" },
];

function TypeDiscovery() {
  return (
    <section className="bg-[#1a1a1a] py-16 sm:py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-px bg-[#c7372f]" />
          <span className="text-xs tracking-[0.3em] text-[#c7372f] uppercase">
            Type Discovery
          </span>
        </div>

        <h2
          className="text-3xl sm:text-4xl text-[#faf8f5] mb-12"
          style={{ fontFamily: "'Shippori Mincho', serif" }}
        >
          タイプから探す
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-[#333]">
          {types.map((type, i) => (
            <Link
              key={type.id}
              href={`/search?type=${type.id}`}
              className="group flex items-baseline gap-4 border-b border-[#333] px-4 py-6 hover:bg-[#222] transition-colors cursor-pointer"
            >
              <span
                className="text-3xl text-[#444] group-hover:text-[#c7372f] transition-colors tabular-nums"
                style={{ fontFamily: "'Shippori Mincho', serif" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <span className="text-lg text-[#faf8f5] group-hover:text-[#c7372f] transition-colors">
                  {type.label}
                </span>
                <p className="text-sm text-[#6b6560] mt-0.5">{type.sub}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#444] group-hover:text-[#c7372f] ml-auto transition-colors opacity-0 group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 3. Pickup Reviews: Editorial Cards ──────────────────

function PickupReviews() {
  const [reviews, setReviews] = useState<PickupReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowser();
      const { data } = await supabase
        .from("reviews")
        .select(
          "id, score, comment_first_impression, therapist_id, therapists(name, salon_id, salons(name, display_name))"
        )
        .eq("moderation_status", "approved")
        .not("score", "is", null)
        .not("comment_first_impression", "is", null)
        .order("created_at", { ascending: false })
        .limit(4);

      if (data) {
        setReviews(
          data.map((r: any) => {
            const t = r.therapists as any;
            const s = t?.salons as any;
            return {
              id: r.id,
              score: r.score,
              comment: r.comment_first_impression || "",
              therapist_name: t?.name ? cleanTherapistName(t.name) : "---",
              therapist_id: r.therapist_id,
              salon_name: s?.display_name || s?.name || "",
            };
          })
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <section className="bg-[#faf8f5] py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 bg-[#eee9e3] animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (reviews.length === 0) return null;

  return (
    <section className="bg-[#faf8f5] py-16 sm:py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-px bg-[#c7372f]" />
          <span className="text-xs tracking-[0.3em] text-[#c7372f] uppercase">
            Reviews
          </span>
        </div>

        <div className="flex items-end justify-between mb-10">
          <h2
            className="text-3xl sm:text-4xl text-[#1a1a1a]"
            style={{ fontFamily: "'Shippori Mincho', serif" }}
          >
            新着の声
          </h2>
          <Link
            href="/search"
            className="text-sm text-[#c7372f] hover:underline flex items-center gap-1"
          >
            すべて見る
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* 2-column editorial grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[#e0dbd5]">
          {reviews.map((review) => (
            <Link
              key={review.id}
              href={`/therapist/${review.therapist_id}`}
              className="group bg-[#faf8f5] p-8 hover:bg-[#f5f0eb] transition-colors cursor-pointer"
            >
              {/* Score */}
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-4 w-4 fill-[#c7372f] text-[#c7372f]" />
                <span
                  className="text-2xl text-[#c7372f]"
                  style={{ fontFamily: "'Shippori Mincho', serif" }}
                >
                  {review.score}
                </span>
              </div>

              {/* Comment excerpt */}
              <p className="text-[#1a1a1a] leading-relaxed mb-4 line-clamp-3">
                &ldquo;{review.comment.slice(0, 80)}&hellip;&rdquo;
              </p>

              {/* Therapist & salon */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-[#1a1a1a]">
                    {review.therapist_name}
                  </span>
                  {review.salon_name && (
                    <span className="text-xs text-[#a09890] ml-2">
                      {review.salon_name}
                    </span>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-[#c7372f] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 4. Popular Therapists: Film Strip ───────────────────

function PopularTherapists() {
  const [therapists, setTherapists] = useState<FeaturedTherapist[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/therapists/recommendations?limit=20");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTherapists(
          data
            .filter((t: any) => {
              if (isPlaceholderName(t.name)) return false;
              const cleaned = cleanTherapistName(t.name);
              if (cleaned.length > 15) return false;
              const imgs = t.image_urls as string[] | null;
              if (!imgs?.[0]) return false;
              return true;
            })
            .slice(0, 6)
            .map((t: any) => {
              const imgs = t.image_urls as string[] | null;
              const shop = t.salons as any;
              return {
                id: Number(t.id),
                name: cleanTherapistName(t.name),
                age: t.age,
                image_url: imgs?.[0] || null,
                salon_name: shop?.display_name || shop?.name || "",
                score: 0,
              };
            })
        );
      }
    }
    load();
  }, []);

  if (therapists.length === 0) return null;

  return (
    <section className="bg-[#1a1a1a] py-16 sm:py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-px bg-[#c7372f]" />
          <span className="text-xs tracking-[0.3em] text-[#c7372f] uppercase">
            Popular
          </span>
        </div>

        <div className="flex items-end justify-between mb-10">
          <h2
            className="text-3xl sm:text-4xl text-[#faf8f5]"
            style={{ fontFamily: "'Shippori Mincho', serif" }}
          >
            注目のセラピスト
          </h2>
          <Link
            href="/ranking"
            className="text-sm text-[#c7372f] hover:underline flex items-center gap-1"
          >
            ランキング
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Horizontal scroll */}
        <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
          {therapists.map((t) => (
            <Link
              key={t.id}
              href={`/therapist/${t.id}`}
              className="group flex-shrink-0 w-[200px]"
            >
              <div className="relative aspect-[3/4] overflow-hidden mb-3">
                <EditorialImage src={t.image_url} alt={t.name} />
                <div className="absolute inset-0 bg-[#1a1a1a]/0 group-hover:bg-[#1a1a1a]/20 transition-colors" />
              </div>
              <p className="text-[#faf8f5] text-sm">
                {t.name}
                {t.age && (
                  <span className="text-[#6b6560] ml-1">({t.age})</span>
                )}
              </p>
              <p className="text-[#6b6560] text-xs">{t.salon_name}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 5. Area Links: Minimal ──────────────────────────────

function AreaLinks() {
  const [areas, setAreas] = useState<
    { name: string; slug: string; pref_slug: string; count: number }[]
  >([]);

  useEffect(() => {
    async function load() {
      const [prefsRes, areasRes] = await Promise.all([
        fetch("/api/prefectures"),
        fetch("/api/areas"),
      ]);
      const prefs = await prefsRes.json();
      const areasData = await areasRes.json();
      if (!Array.isArray(prefs) || !Array.isArray(areasData)) return;

      const prefMap = new Map<number, string>();
      for (const p of prefs) prefMap.set(p.id, p.slug);

      const top = areasData
        .filter((a: any) => (a.salon_count ?? 0) > 0)
        .sort((a: any, b: any) => (b.salon_count ?? 0) - (a.salon_count ?? 0))
        .slice(0, 20)
        .map((a: any) => ({
          name: a.name,
          slug: a.slug,
          pref_slug: prefMap.get(a.prefecture_id) || "",
          count: a.salon_count ?? 0,
        }));

      setAreas(top);
    }
    load();
  }, []);

  if (areas.length === 0) return null;

  return (
    <section className="bg-[#faf8f5] py-16 sm:py-20 px-6 border-t border-[#e0dbd5]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-px bg-[#c7372f]" />
          <span className="text-xs tracking-[0.3em] text-[#c7372f] uppercase">
            Area
          </span>
        </div>

        <h2
          className="text-3xl sm:text-4xl text-[#1a1a1a] mb-10"
          style={{ fontFamily: "'Shippori Mincho', serif" }}
        >
          エリアから探す
        </h2>

        <div className="flex flex-wrap gap-3">
          {areas.map((area) => (
            <Link
              key={area.slug}
              href={`/area/${area.pref_slug}/${area.slug}`}
              className="px-4 py-2 border border-[#d0cbc5] text-sm text-[#1a1a1a] hover:border-[#c7372f] hover:text-[#c7372f] transition-colors cursor-pointer"
            >
              {area.name}
              <span className="text-[#a09890] ml-1 text-xs">({area.count})</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────

function EditorialFooter() {
  return (
    <footer className="bg-[#1a1a1a] border-t border-[#333] py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <span
            className="text-xl text-[#faf8f5]"
            style={{ fontFamily: "'Shippori Mincho', serif" }}
          >
            メンエスSKR
          </span>
          <div className="flex items-center gap-8 text-xs text-[#6b6560]">
            <Link href="/legal/terms" className="hover:text-[#faf8f5] transition-colors">
              利用規約
            </Link>
            <Link href="/legal/privacy" className="hover:text-[#faf8f5] transition-colors">
              プライバシー
            </Link>
            <Link href="/legal/tokushoho" className="hover:text-[#faf8f5] transition-colors">
              特定商取引法
            </Link>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-[#333]">
          <p className="text-xs text-[#444]">&copy; 2026 メンエスSKR</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function MockupAPage() {
  return (
    <>
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap');`}</style>

      <div
        className="min-h-screen flex flex-col bg-[#faf8f5] text-[#1a1a1a]"
        style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif" }}
      >
        <EditorialHeader />

        <main className="flex-1">
          <EditorialHero />
          <TypeDiscovery />
          <PickupReviews />
          <PopularTherapists />
          <AreaLinks />
        </main>

        <EditorialFooter />
      </div>
    </>
  );
}
