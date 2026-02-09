"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, PenSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export function LatestReviews() {
  const [reviewCount, setReviewCount] = useState<number | null>(null);

  useEffect(() => {
    async function checkReviews() {
      const { count } = await supabase
        .from("reviews")
        .select("id", { count: "exact", head: true });
      setReviewCount(count ?? 0);
    }
    checkReviews();
  }, []);

  return (
    <section className="mt-8">
      <Card className="overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              新着口コミ
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <div className="max-w-md mx-auto">
            <PenSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">口コミを募集中です</h3>
            <p className="text-sm text-muted-foreground mb-6">
              あなたの体験を共有して、他のユーザーの「発見」を手助けしませんか？
              口コミを投稿すると3日間すべての口コミが閲覧可能になります。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/review">
                <Button>口コミを投稿する</Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" className="bg-transparent">
                  無料会員登録
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
