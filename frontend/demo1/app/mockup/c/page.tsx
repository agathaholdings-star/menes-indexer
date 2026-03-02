"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Star, ArrowRight, Camera, MoveRight } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { cleanTherapistName, isPlaceholderName } from "@/lib/therapist-utils";

/* ────────────────────────────────────────────────────────────
   Pattern C: Neo-Brutalist
   ──────────────────────────────────────────────────────────
   Font:  Sora (heading) + Work Sans (body)
   Color: Off-white #fefefe / Charcoal #111 / Vermilion orange #ff4400
   Layout: Massive typography, thick borders, sharp corners, bold blocks
   Vibe:  タイポグラフィが支配する、余白が贅沢な空間
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

// ─── Brutalist Image ─────────────────────────────────────

function BrutalistImage({ src, alt }: { src: string | null; alt: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="absolute inset-0 bg-[#f0f0f0] flex flex-col items-center justify-center text-[#ccc]">
        <Camera className="h-8 w-8 mb-1" />
        <span className="text-xs" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          No Photo
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

// ─── Header ──────────────────────────────────────────────

function BrutalistHeader() {
  return (
    <header className="sticky top-0 z-50 bg-[#fefefe] border-b-4 border-[#111]">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        <Link href="/mockup/c">
          <span
            className="text-2xl font-black text-[#111] tracking-tighter"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            SKR.
          </span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link
            href="/ranking"
            className="text-sm font-medium text-[#111] hover:text-[#ff4400] transition-colors"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Ranking
          </Link>
          <Link
            href="/search"
            className="text-sm font-medium text-[#111] hover:text-[#ff4400] transition-colors"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Search
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 bg-[#111] text-[#fefefe] text-sm font-bold hover:bg-[#ff4400] transition-colors cursor-pointer"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ─── 1. Hero: Giant Type ─────────────────────────────────

function BrutalistHero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState({ salons: 0, reviews: 0 });

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowser();
      const [s, r] = await Promise.all([
        supabase.from("salons").select("*", { count: "exact", head: true }),
        supabase.from("reviews").select("*", { count: "exact", head: true }).eq("moderation_status", "approved"),
      ]);
      setStats({ salons: s.count ?? 0, reviews: r.count ?? 0 });
    }
    load();
  }, []);

  return (
    <section className="bg-[#fefefe] px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
      <div className="max-w-7xl mx-auto">
        {/* Giant headline */}
        <h1
          className="text-[clamp(3rem,10vw,8rem)] font-black text-[#111] leading-[0.9] tracking-tighter"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          口コミで
          <br />
          <span className="text-[#ff4400]">発見</span>する
        </h1>

        {/* Stats + description */}
        <div className="mt-8 flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-16">
          <p
            className="text-[#666] text-base max-w-sm leading-relaxed"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            {stats.salons > 0 ? stats.salons.toLocaleString() : "---"}店舗のメンズエステから、
            {stats.reviews > 0 ? stats.reviews.toLocaleString() : "---"}
            件の口コミであなたの&quot;発見&quot;を。
          </p>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="flex border-4 border-[#111] focus-within:border-[#ff4400] transition-colors">
              <input
                type="search"
                placeholder="セラピスト名・店舗名"
                className="flex-1 px-4 py-3 bg-transparent text-[#111] text-base outline-none placeholder:text-[#ccc]"
                style={{ fontFamily: "'Work Sans', sans-serif" }}
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
                className="px-5 bg-[#111] text-[#fefefe] hover:bg-[#ff4400] transition-colors cursor-pointer"
                aria-label="検索"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 2. Types: Bold Text Links ───────────────────────────

const types = [
  { id: "idol", label: "アイドル系" },
  { id: "seiso", label: "清楚系" },
  { id: "gal", label: "ギャル系" },
  { id: "model", label: "モデル系" },
  { id: "imouto", label: "妹系" },
  { id: "yoen", label: "艶系" },
];

function BrutalistTypes() {
  return (
    <section className="bg-[#111] px-6 py-14">
      <div className="max-w-7xl mx-auto">
        <p
          className="text-[#666] text-xs uppercase tracking-widest mb-8"
          style={{ fontFamily: "'Work Sans', sans-serif" }}
        >
          Browse by type
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {types.map((type) => (
            <Link
              key={type.id}
              href={`/search?type=${type.id}`}
              className="group border border-[#222] px-4 py-6 flex items-center justify-between hover:bg-[#ff4400] hover:border-[#ff4400] transition-all cursor-pointer"
            >
              <span
                className="text-white text-lg font-bold group-hover:text-[#111] transition-colors"
                style={{ fontFamily: "'Sora', sans-serif" }}
              >
                {type.label}
              </span>
              <MoveRight className="h-4 w-4 text-[#444] group-hover:text-[#111] transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 3. Reviews: Quote Blocks ────────────────────────────

function BrutalistReviews() {
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
        .limit(3);

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
    <section className="bg-[#fefefe] px-6 py-16 sm:py-20">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <h2
            className="text-4xl sm:text-5xl font-black text-[#111] tracking-tighter"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            新着の声
          </h2>
          <Link
            href="/search"
            className="text-sm font-medium text-[#ff4400] hover:underline flex items-center gap-1"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            All reviews
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="space-y-6">
          {reviews.map((review) => (
            <Link
              key={review.id}
              href={`/therapist/${review.therapist_id}`}
              className="group block border-l-4 border-[#ff4400] pl-6 py-4 hover:bg-[#fff5f0] transition-colors cursor-pointer"
            >
              {/* Big quote */}
              <p
                className="text-[#111] text-lg sm:text-xl leading-relaxed mb-4"
                style={{ fontFamily: "'Work Sans', sans-serif" }}
              >
                &ldquo;{review.comment.slice(0, 100)}&hellip;&rdquo;
              </p>

              <div className="flex items-center gap-4">
                {/* Score */}
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-[#ff4400] text-[#ff4400]" />
                  <span
                    className="text-xl font-black text-[#ff4400]"
                    style={{ fontFamily: "'Sora', sans-serif" }}
                  >
                    {review.score}
                  </span>
                </div>

                <div className="w-px h-5 bg-[#ddd]" />

                <span
                  className="text-sm font-medium text-[#111]"
                  style={{ fontFamily: "'Work Sans', sans-serif" }}
                >
                  {review.therapist_name}
                </span>
                <span className="text-sm text-[#999]">{review.salon_name}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 4. Therapists: Bold Grid ────────────────────────────

function BrutalistTherapists() {
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
              };
            })
        );
      }
    }
    load();
  }, []);

  if (therapists.length === 0) return null;

  return (
    <section className="bg-[#111] px-6 py-16 sm:py-20">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <h2
            className="text-4xl sm:text-5xl font-black text-[#fefefe] tracking-tighter"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Trending
          </h2>
          <Link
            href="/ranking"
            className="text-sm font-medium text-[#ff4400] hover:underline flex items-center gap-1"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Ranking
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {therapists.map((t, i) => (
            <Link
              key={t.id}
              href={`/therapist/${t.id}`}
              className="group relative overflow-hidden border-2 border-[#222] hover:border-[#ff4400] transition-colors cursor-pointer"
            >
              <div className="relative aspect-[3/4] bg-[#1a1a1a]">
                <BrutalistImage src={t.image_url} alt={t.name} />

                {/* Index number */}
                <div
                  className="absolute top-3 left-3 text-6xl font-black text-white/10 leading-none"
                  style={{ fontFamily: "'Sora', sans-serif" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>

                {/* Bottom info */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#111] via-[#111]/70 to-transparent p-4 pt-16">
                  <p
                    className="text-white font-bold text-base truncate"
                    style={{ fontFamily: "'Sora', sans-serif" }}
                  >
                    {t.name}
                    {t.age && (
                      <span className="text-white/40 font-normal text-sm ml-1">
                        ({t.age})
                      </span>
                    )}
                  </p>
                  <p
                    className="text-white/40 text-sm truncate"
                    style={{ fontFamily: "'Work Sans', sans-serif" }}
                  >
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

// ─── 5. Area: Numbered List ──────────────────────────────

function BrutalistAreas() {
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
        .slice(0, 12)
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
    <section className="bg-[#fefefe] px-6 py-16 sm:py-20 border-t-4 border-[#111]">
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-4xl sm:text-5xl font-black text-[#111] tracking-tighter mb-10"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          エリア
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t-2 border-[#111]">
          {areas.map((area, i) => (
            <Link
              key={area.slug}
              href={`/area/${area.pref_slug}/${area.slug}`}
              className="group flex items-center gap-4 border-b-2 border-[#eee] px-2 py-4 hover:bg-[#fff5f0] transition-colors cursor-pointer"
            >
              <span
                className="text-2xl font-black text-[#eee] group-hover:text-[#ff4400] transition-colors tabular-nums w-10"
                style={{ fontFamily: "'Sora', sans-serif" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className="text-base font-medium text-[#111] flex-1"
                style={{ fontFamily: "'Work Sans', sans-serif" }}
              >
                {area.name}
              </span>
              <span className="text-sm text-[#bbb] tabular-nums" style={{ fontFamily: "'Sora', sans-serif" }}>
                {area.count}
              </span>
              <MoveRight className="h-4 w-4 text-[#ddd] group-hover:text-[#ff4400] transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────

function BrutalistFooter() {
  return (
    <footer className="bg-[#111] border-t-4 border-[#ff4400] py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <span
          className="text-xl font-black text-[#fefefe] tracking-tighter"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          SKR.
        </span>
        <div className="flex items-center gap-6 text-xs text-[#666]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          <Link href="/legal/terms" className="hover:text-[#fefefe] transition-colors">利用規約</Link>
          <Link href="/legal/privacy" className="hover:text-[#fefefe] transition-colors">プライバシー</Link>
          <Link href="/legal/tokushoho" className="hover:text-[#fefefe] transition-colors">特商法</Link>
        </div>
      </div>
      <p
        className="text-[#333] text-xs mt-6"
        style={{ fontFamily: "'Sora', sans-serif" }}
      >
        &copy; 2026 メンエスSKR
      </p>
    </footer>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function MockupCPage() {
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Work+Sans:wght@400;500;600;700&display=swap');`}</style>

      <div
        className="min-h-screen flex flex-col bg-[#fefefe] text-[#111]"
        style={{ fontFamily: "'Work Sans', sans-serif" }}
      >
        <BrutalistHeader />

        <main className="flex-1">
          <BrutalistHero />
          <BrutalistTypes />
          <BrutalistReviews />
          <BrutalistTherapists />
          <BrutalistAreas />
        </main>

        <BrutalistFooter />
      </div>
    </>
  );
}
