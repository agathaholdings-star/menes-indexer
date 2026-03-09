"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MessageSquare, MapPin, Users, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SalonWithReviewCount {
  id: number;
  name: string;
  display_name: string | null;
  access: string | null;
  review_count: number;
  therapist_count: number;
  area_name: string | null;
}

export function TopReviewedSalons() {
  const [salons, setSalons] = useState<SalonWithReviewCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTopSalons() {
      try {
        const res = await fetch("/api/salons/top-reviewed?limit=8");
        const data = await res.json();
        setSalons(Array.isArray(data) ? data : []);
      } catch {
        setSalons([]);
      } finally {
        setLoading(false);
      }
    }
    fetchTopSalons();
  }, []);

  if (loading) {
    return (
      <section>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              口コミが多いサロン
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            読み込み中...
          </CardContent>
        </Card>
      </section>
    );
  }

  if (salons.length === 0) return null;

  return (
    <section>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
            口コミが多いサロン
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {salons.map((salon, i) => (
            <Link
              key={salon.id}
              href={`/salon/${salon.id}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <span className="text-lg font-bold text-muted-foreground w-6 text-center shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                  {salon.display_name || salon.name}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {salon.area_name && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {salon.area_name}
                    </span>
                  )}
                  {salon.access && !salon.area_name && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {salon.access}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {salon.therapist_count}人
                  </span>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0 gap-1">
                <MessageSquare className="h-3 w-3" />
                {salon.review_count}件
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
