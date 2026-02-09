import Link from "next/link";
import Image from "next/image";
import { Trophy, ChevronRight, Star, TrendingUp, Medal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { supabase } from "@/lib/supabase";

interface RankedTherapist {
  id: number;
  name: string;
  age: number | null;
  image_urls: string[] | null;
  shop_id: number;
  shop_name: string;
  review_count: number;
  avg_score: number;
}

async function getRankings(): Promise<RankedTherapist[]> {
  // レビューをセラピストごとに集計
  const { data: reviewAgg } = await supabase
    .from("reviews")
    .select("therapist_id, score");

  if (!reviewAgg || reviewAgg.length === 0) return [];

  // 手動集計（Supabaseのクライアントには GROUP BY がないため）
  const aggMap = new Map<number, { total: number; count: number }>();
  for (const r of reviewAgg) {
    const existing = aggMap.get(r.therapist_id);
    if (existing) {
      existing.total += r.score || 0;
      existing.count += 1;
    } else {
      aggMap.set(r.therapist_id, { total: r.score || 0, count: 1 });
    }
  }

  // 最低1件のレビューがあるセラピストを対象、スコア順ソート
  const ranked = Array.from(aggMap.entries())
    .map(([id, { total, count }]) => ({
      therapist_id: id,
      avg_score: Math.round(total / count),
      review_count: count,
    }))
    .sort((a, b) => b.avg_score - a.avg_score || b.review_count - a.review_count)
    .slice(0, 50);

  if (ranked.length === 0) return [];

  // セラピスト詳細を取得
  const therapistIds = ranked.map((r) => r.therapist_id);
  const { data: therapists } = await supabase
    .from("therapists")
    .select("id, name, age, image_urls, shop_id")
    .in("id", therapistIds);

  if (!therapists) return [];

  // 店舗名を取得
  const shopIds = [...new Set(therapists.map((t) => t.shop_id))];
  const { data: shops } = await supabase
    .from("shops")
    .select("id, display_name, name")
    .in("id", shopIds);

  const shopMap = new Map(
    (shops || []).map((s) => [s.id, s.display_name || s.name])
  );
  const therapistMap = new Map(therapists.map((t) => [t.id, t]));

  return ranked
    .map((r) => {
      const t = therapistMap.get(r.therapist_id);
      if (!t) return null;
      return {
        id: t.id,
        name: t.name,
        age: t.age,
        image_urls: t.image_urls as string[] | null,
        shop_id: t.shop_id,
        shop_name: shopMap.get(t.shop_id) || "",
        review_count: r.review_count,
        avg_score: r.avg_score,
      };
    })
    .filter((r): r is RankedTherapist => r !== null);
}

const rankMedals = ["🥇", "🥈", "🥉"];

export default async function RankingPage() {
  const rankings = await getRankings();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-6">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition-colors">
            ホーム
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">ランキング</span>
        </nav>

        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">ランキング</h1>
              <p className="text-muted-foreground">
                口コミ・評価に基づくセラピストランキング
              </p>
            </div>
          </div>
        </div>

        {rankings.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-bold mb-2">準備中</h2>
              <p className="text-muted-foreground">
                口コミデータが集まり次第、ランキング機能を公開します。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rankings.map((t, index) => (
              <Link key={t.id} href={`/therapist/${t.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="w-10 text-center flex-shrink-0">
                        {index < 3 ? (
                          <span className="text-2xl">{rankMedals[index]}</span>
                        ) : (
                          <span className="text-lg font-bold text-muted-foreground">
                            {index + 1}
                          </span>
                        )}
                      </div>

                      {/* Image */}
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        {t.image_urls && t.image_urls.length > 0 ? (
                          <Image
                            src={t.image_urls[0]}
                            alt={t.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xl font-bold text-muted-foreground">
                              {t.name.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold truncate">{t.name}</span>
                          {t.age && (
                            <span className="text-sm text-muted-foreground">
                              ({t.age})
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {t.shop_name}
                        </p>
                      </div>

                      {/* Score */}
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-lg font-bold text-primary">
                            {t.avg_score}
                          </span>
                          <span className="text-sm text-muted-foreground">点</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t.review_count}件の口コミ
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
