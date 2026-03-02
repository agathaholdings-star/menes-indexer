"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, PenSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSupabaseBrowser } from "@/lib/supabase/client";

interface LatestReview {
  id: string;
  score: number;
  comment_first_impression: string;
  created_at: string;
  therapist_id: number;
  therapists: { name: string; salon_id: number; salons: { name: string } | null } | null;
}

export function LatestReviews() {
  const [reviews, setReviews] = useState<LatestReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLatest() {
      const supabase = createSupabaseBrowser();
      const { data } = await supabase
        .from("reviews")
        .select("id, score, comment_first_impression, created_at, therapist_id, therapists(name, salon_id, salons(name))")
        .eq("moderation_status", "approved")
        .order("created_at", { ascending: false })
        .limit(5);
      setReviews((data as unknown as LatestReview[]) || []);
      setLoading(false);
    }
    fetchLatest();
  }, []);

  if (loading) {
    return (
      <section className="mt-8">
        <Card>
          <CardHeader className="bg-primary text-primary-foreground py-3">
            <CardTitle className="text-base font-medium">新着口コミ</CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            読み込み中...
          </CardContent>
        </Card>
      </section>
    );
  }

  if (reviews.length === 0) {
    return (
      <section className="mt-8">
        <Card className="overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground py-3">
            <CardTitle className="text-base font-medium">新着口コミ</CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center">
            <PenSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">口コミを募集中です</h3>
            <p className="text-sm text-muted-foreground mb-6">
              あなたの体験を共有して、他のユーザーの「発見」を手助けしませんか？
            </p>
            <Link href="/review">
              <Button>口コミを投稿する</Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <Card className="overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">新着口コミ</CardTitle>
            <Badge variant="secondary" className="text-xs">{reviews.length}件</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {reviews.map((r) => (
            <Link key={r.id} href={`/therapist/${r.therapist_id}`} className="block hover:bg-muted/50 transition-colors">
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">
                    {r.therapists?.name || "不明"}
                  </span>
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-primary">{r.score}点</span>
                  </div>
                </div>
                {r.therapists?.salons?.name && (
                  <p className="text-xs text-muted-foreground mb-1">{r.therapists.salons.name}</p>
                )}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {r.comment_first_impression}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(r.created_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
