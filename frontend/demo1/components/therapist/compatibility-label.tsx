"use client";

import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

interface CompatibilityData {
  score: number;
  label: string;
  color: string;
  reasons: string[];
  needsMoreReviews: boolean;
}

interface CompatibilityLabelProps {
  therapistId: string;
  variant?: "badge" | "card";
}

export function CompatibilityLabel({
  therapistId,
  variant = "badge",
}: CompatibilityLabelProps) {
  const { user } = useAuth();
  const [data, setData] = useState<CompatibilityData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    fetch(`/api/compatibility?therapist_ids=${therapistId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && json[therapistId]) {
          setData(json[therapistId]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, therapistId]);

  if (!user || loading || !data) return null;

  // Not enough user reviews
  if (data.needsMoreReviews) {
    if (variant === "badge") return null;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2 text-sm text-muted-foreground">
        <HelpCircle className="h-4 w-4 flex-shrink-0" />
        <span>口コミを3件以上投稿すると相性ラベルが表示されます</span>
      </div>
    );
  }

  // No reviews for this therapist
  if (data.score < 0) return null;

  const colorMap: Record<string, string> = {
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    yellow: "bg-amber-100 text-amber-800 border-amber-200",
    gray: "bg-muted text-muted-foreground border-border",
  };

  const iconColorMap: Record<string, string> = {
    green: "text-emerald-600",
    yellow: "text-amber-600",
    gray: "text-muted-foreground",
  };

  const badgeClass = colorMap[data.color] || colorMap.gray;
  const iconClass = iconColorMap[data.color] || iconColorMap.gray;

  if (variant === "badge") {
    return (
      <Badge variant="outline" className={`gap-1 ${badgeClass}`}>
        <Sparkles className={`h-3 w-3 ${iconClass}`} />
        {data.label}
      </Badge>
    );
  }

  // Card variant for therapist detail page
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${badgeClass}`}>
      <div className="flex items-center gap-2">
        <TrendingUp className={`h-5 w-5 ${iconClass}`} />
        <span className="font-bold">{data.label}</span>
        {data.score > 0 && (
          <span className="text-xs opacity-70">({data.score}点)</span>
        )}
      </div>
      {data.reasons.length > 0 && (
        <span className="text-sm">
          {data.reasons.join(" / ")}
        </span>
      )}
    </div>
  );
}
