"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Star, ArrowUpRight, Camera, Zap } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { cleanTherapistName, isPlaceholderName } from "@/lib/therapist-utils";

/* ────────────────────────────────────────────────────────────
   Pattern B: Cyber Neon
   ──────────────────────────────────────────────────────────
   Font:  Space Grotesk (heading) + JetBrains Mono (accents)
   Color: Void black #08080f / Cyan #00f0ff / Hot pink #ff2d55
   Layout: Grid-breaking, overlapping, terminal-inspired
   Vibe:  秋葉原の深夜、情報が脈打つ
   ──────────────────────────────────────────────────────────── */

interface PickupReview {
  id: string;
  score: number;
  comment: string;
  therapist_name: string;
  therapist_id: number;
  salon_name: string;
}

interface TherapistCard {
  id: number;
  name: string;
  age: number | null;
  image_url: string | null;
  salon_name: string;
}

// ─── Neon Image Fallback ─────────────────────────────────

function NeonImage({ src, alt }: { src: string | null; alt: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="absolute inset-0 bg-[#111119] flex flex-col items-center justify-center text-[#333]">
        <Camera className="h-6 w-6 mb-1" />
        <span className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          NO_IMG
        </span>
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

// ─── Animated counter ────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (value === 0) return;
    const duration = 1200;
    const start = performance.now();
    const from = ref.current;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (value - from) * eased);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(animate);
      else ref.current = value;
    }
    requestAnimationFrame(animate);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

// ─── Header ──────────────────────────────────────────────

function CyberHeader() {
  return (
    <header className="sticky top-0 z-50 bg-[#08080f]/90 backdrop-blur border-b border-[#00f0ff]/20">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
        <Link href="/mockup/b" className="flex items-center gap-2">
          <span
            className="text-xl font-bold text-[#00f0ff]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            SKR
          </span>
          <span
            className="text-xs text-[#555] hidden sm:inline"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            //menes-indexer
          </span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link
            href="/ranking"
            className="text-sm text-[#666] hover:text-[#00f0ff] transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            RANK
          </Link>
          <Link
            href="/search"
            className="text-sm text-[#666] hover:text-[#00f0ff] transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            SEARCH
          </Link>
          <Link
            href="/login"
            className="px-3 py-1 bg-[#00f0ff] text-[#08080f] text-xs font-bold hover:bg-[#00d4e0] transition-colors cursor-pointer"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            LOGIN
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ─── 1. Hero: Terminal Aesthetic ──────────────────────────

function CyberHero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState({ salons: 0, therapists: 0, reviews: 0 });

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowser();
      const [s, t, r] = await Promise.all([
        supabase.from("salons").select("*", { count: "exact", head: true }),
        supabase.from("therapists").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("reviews").select("*", { count: "exact", head: true }).eq("moderation_status", "approved"),
      ]);
      setStats({
        salons: s.count ?? 0,
        therapists: t.count ?? 0,
        reviews: r.count ?? 0,
      });
    }
    load();
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#08080f] px-6 py-20 sm:py-28">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#00f0ff 1px, transparent 1px), linear-gradient(90deg, #00f0ff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00f0ff]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Stats bar */}
        <div
          className="flex items-center justify-center gap-6 sm:gap-10 mb-10 text-[#555]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-[#00f0ff]">
              <AnimatedNumber value={stats.salons} />
            </div>
            <div className="text-xs mt-1">SALONS</div>
          </div>
          <div className="w-px h-10 bg-[#222]" />
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-[#ff2d55]">
              <AnimatedNumber value={stats.therapists} />
            </div>
            <div className="text-xs mt-1">THERAPISTS</div>
          </div>
          <div className="w-px h-10 bg-[#222]" />
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-white">
              <AnimatedNumber value={stats.reviews} />
            </div>
            <div className="text-xs mt-1">REVIEWS</div>
          </div>
        </div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white leading-none tracking-tighter mb-6"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          DISCOVER
          <br />
          <span className="text-[#00f0ff]">YOUR</span>{" "}
          <span className="text-[#ff2d55]">TYPE</span>
        </h1>

        <p className="text-[#555] text-sm mb-10 max-w-md mx-auto" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          &gt; 確認で終わるサイトから、発見が始まるサイトへ_
        </p>

        {/* Search */}
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 border border-[#222] bg-[#0c0c14] px-4 py-3 focus-within:border-[#00f0ff] transition-colors">
            <span className="text-[#00f0ff] text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              $
            </span>
            <input
              type="search"
              placeholder="search --name セラピスト名"
              className="flex-1 bg-transparent text-white outline-none text-sm placeholder:text-[#333]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
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
              className="text-[#00f0ff] hover:text-[#ff2d55] transition-colors cursor-pointer"
              aria-label="検索"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 2. Type Grid: Neon Tags ─────────────────────────────

const types = [
  { id: "idol", label: "アイドル系", color: "#00f0ff" },
  { id: "seiso", label: "清楚系", color: "#a78bfa" },
  { id: "gal", label: "ギャル系", color: "#ff2d55" },
  { id: "model", label: "モデル系", color: "#fbbf24" },
  { id: "imouto", label: "妹系", color: "#34d399" },
  { id: "yoen", label: "艶系", color: "#f472b6" },
];

function NeonTypes() {
  return (
    <section className="bg-[#0c0c14] py-14 px-6 border-t border-[#151520]">
      <div className="max-w-5xl mx-auto">
        <h2
          className="text-xs text-[#555] mb-6 tracking-wider"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          // TYPE_FILTER
        </h2>

        <div className="flex flex-wrap gap-3">
          {types.map((type) => (
            <Link
              key={type.id}
              href={`/search?type=${type.id}`}
              className="group relative px-5 py-3 border text-sm font-medium transition-all duration-200 cursor-pointer"
              style={{
                borderColor: `${type.color}33`,
                color: type.color,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              <span className="relative z-10">{type.label}</span>
              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: `linear-gradient(135deg, ${type.color}10, ${type.color}05)`,
                  boxShadow: `0 0 20px ${type.color}15`,
                }}
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 3. Reviews: Terminal Log Style ──────────────────────

function CyberReviews() {
  const [reviews, setReviews] = useState<PickupReview[]>([]);

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
        .limit(5);

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
    }
    load();
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section className="bg-[#08080f] py-14 px-6 border-t border-[#151520]">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2
            className="text-xs text-[#555] tracking-wider"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            // LATEST_REVIEWS
          </h2>
          <Link
            href="/search"
            className="text-xs text-[#00f0ff] hover:text-[#ff2d55] transition-colors flex items-center gap-1"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            VIEW_ALL
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="space-y-2">
          {reviews.map((review, i) => (
            <Link
              key={review.id}
              href={`/therapist/${review.therapist_id}`}
              className="group flex items-start gap-4 px-4 py-4 border border-[#151520] hover:border-[#00f0ff]/30 bg-[#0c0c14] hover:bg-[#0f0f1a] transition-all cursor-pointer"
            >
              {/* Line number */}
              <span
                className="text-[#333] text-xs shrink-0 w-6 text-right tabular-nums pt-0.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              {/* Score pill */}
              <div
                className="shrink-0 flex items-center gap-1 px-2 py-0.5"
                style={{
                  background: review.score >= 80 ? "#00f0ff15" : "#ff2d5515",
                  border: `1px solid ${review.score >= 80 ? "#00f0ff33" : "#ff2d5533"}`,
                }}
              >
                <Star
                  className="h-3 w-3"
                  style={{
                    color: review.score >= 80 ? "#00f0ff" : "#ff2d55",
                    fill: review.score >= 80 ? "#00f0ff" : "#ff2d55",
                  }}
                />
                <span
                  className="text-xs font-bold"
                  style={{
                    color: review.score >= 80 ? "#00f0ff" : "#ff2d55",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {review.score}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-sm font-medium" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {review.therapist_name}
                  </span>
                  <span className="text-[#333] text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    @{review.salon_name}
                  </span>
                </div>
                <p className="text-[#666] text-sm truncate">
                  {review.comment.slice(0, 60)}...
                </p>
              </div>

              <ArrowUpRight className="h-4 w-4 text-[#333] group-hover:text-[#00f0ff] transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 4. Popular Therapists ───────────────────────────────

function CyberTherapists() {
  const [therapists, setTherapists] = useState<TherapistCard[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/therapists/recommendations?limit=20");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTherapists(
          data
            .filter((t: any) => {
              if (isPlaceholderName(t.name)) return false;
              const imgs = t.image_urls as string[] | null;
              if (!imgs?.[0]) return false;
              return cleanTherapistName(t.name).length <= 15;
            })
            .slice(0, 8)
            .map((t: any) => {
              const imgs = t.image_urls as string[] | null;
              const shop = t.salons as any;
              return {
                id: Number(t.id),
                name: cleanTherapistName(t.name),
                age: t.age,
                image_url: imgs?.[0] || null,
                salon_name: shop?.display_name || shop?.name || "",
              };
            })
        );
      }
    }
    load();
  }, []);

  if (therapists.length === 0) return null;

  return (
    <section className="bg-[#0c0c14] py-14 px-6 border-t border-[#151520]">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2
            className="text-xs text-[#555] tracking-wider"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            // TRENDING
          </h2>
          <Link
            href="/ranking"
            className="text-xs text-[#00f0ff] hover:text-[#ff2d55] transition-colors flex items-center gap-1"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            RANKING
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {therapists.map((t, i) => (
            <Link
              key={t.id}
              href={`/therapist/${t.id}`}
              className="group relative overflow-hidden border border-[#151520] hover:border-[#00f0ff]/40 transition-all cursor-pointer"
            >
              <div className="relative aspect-[3/4] bg-[#111119]">
                <NeonImage src={t.image_url} alt={t.name} />
                {/* Scanline overlay */}
                <div
                  className="absolute inset-0 opacity-[0.03] pointer-events-none"
                  style={{
                    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)",
                  }}
                />
                {/* Rank */}
                <div
                  className="absolute top-2 left-2 px-1.5 py-0.5 bg-[#08080f]/80 border border-[#222] text-[10px] text-[#00f0ff]"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  #{i + 1}
                </div>
                {/* Bottom gradient */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#08080f] via-[#08080f]/60 to-transparent p-3 pt-10">
                  <p
                    className="text-white text-sm font-medium truncate"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {t.name}
                    {t.age && <span className="text-[#666] text-xs ml-1">({t.age})</span>}
                  </p>
                  <p className="text-[#444] text-xs truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {t.salon_name}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 5. Area: Compact Tags ───────────────────────────────

function CyberAreas() {
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
        .slice(0, 16)
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
    <section className="bg-[#08080f] py-14 px-6 border-t border-[#151520]">
      <div className="max-w-5xl mx-auto">
        <h2
          className="text-xs text-[#555] mb-6 tracking-wider"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          // AREAS
        </h2>

        <div className="flex flex-wrap gap-2">
          {areas.map((area) => (
            <Link
              key={area.slug}
              href={`/area/${area.pref_slug}/${area.slug}`}
              className="px-3 py-1.5 border border-[#222] text-xs text-[#888] hover:border-[#00f0ff]/40 hover:text-[#00f0ff] transition-all cursor-pointer"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {area.name}
              <span className="text-[#333] ml-1">({area.count})</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────

function CyberFooter() {
  return (
    <footer className="bg-[#08080f] border-t border-[#151520] py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-[#00f0ff] text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          SKR
        </span>
        <div className="flex items-center gap-6 text-[10px] text-[#444]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <Link href="/legal/terms" className="hover:text-[#888] transition-colors">TERMS</Link>
          <Link href="/legal/privacy" className="hover:text-[#888] transition-colors">PRIVACY</Link>
          <Link href="/legal/tokushoho" className="hover:text-[#888] transition-colors">TOKUSHOHO</Link>
        </div>
      </div>
      <p className="text-center text-[10px] text-[#222] mt-6" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        &copy; 2026 SKR // menes-indexer.com
      </p>
    </footer>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function MockupBPage() {
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');`}</style>

      <div
        className="min-h-screen flex flex-col bg-[#08080f] text-white"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <CyberHeader />

        <main className="flex-1">
          <CyberHero />
          <NeonTypes />
          <CyberReviews />
          <CyberTherapists />
          <CyberAreas />
        </main>

        <CyberFooter />
      </div>
    </>
  );
}
