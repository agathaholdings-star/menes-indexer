"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth-context";

interface Recommendation {
  therapist_id: number;
  name: string;
  age: number | null;
  image_url: string | null;
  salon_id: number;
  shop_name: string;
  predicted_score: number;
  similar_user_count: number;
  reasons: string[];
}

interface SmartRecommendationsProps {
  excludeSalonId?: string;
}

export function SmartRecommendations({ excludeSalonId }: SmartRecommendationsProps) {
  const { user } = useAuth();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const params = new URLSearchParams({ limit: "8" });
    if (excludeSalonId) params.set("exclude_salon_id", excludeSalonId);

    fetch(`/api/recommendations?${params}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setRecs(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, excludeSalonId]);

  if (!user || loading || recs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          あなたへの新しい発見
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          好みが近いユーザーの評価をもとにおすすめ
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {recs.map((rec) => (
              <Link
                key={rec.therapist_id}
                href={`/therapist/${rec.therapist_id}`}
                className="w-[180px] flex-shrink-0"
              >
                <Card className="h-full transition-all hover:shadow-md hover:border-primary/20 overflow-hidden">
                  <div className="relative h-44 w-full overflow-hidden">
                    {rec.image_url ? (
                      <Image
                        src={rec.image_url}
                        alt={rec.name}
                        fill
                        sizes="180px"
                        className="object-cover transition-transform hover:scale-105"
                        unoptimized
                      />
                    ) : (
                      <div className="h-full w-full bg-muted flex items-center justify-center text-2xl text-muted-foreground">
                        {rec.name[0]}
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-primary/90 text-primary-foreground text-xs gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {rec.predicted_score}点
                      </Badge>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <div className="text-white">
                        <span className="font-bold text-sm">{rec.name}</span>
                        {rec.age && rec.age > 0 && (
                          <span className="text-xs text-white/80 ml-1">({rec.age})</span>
                        )}
                      </div>
                      <p className="text-xs text-white/80 truncate">{rec.shop_name}</p>
                    </div>
                  </div>
                  <CardContent className="p-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{rec.reasons[0]}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
