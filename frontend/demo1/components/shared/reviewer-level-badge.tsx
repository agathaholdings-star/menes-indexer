"use client";

import { Award } from "lucide-react";
import { getLevelInfo } from "@/lib/reviewer-level";

interface ReviewerLevelBadgeProps {
  level: number;
  size?: "sm" | "md";
}

export function ReviewerLevelBadge({ level, size = "sm" }: ReviewerLevelBadgeProps) {
  const info = getLevelInfo(level);

  if (info.level === 0) return null;

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${info.color} ${info.borderColor} ${info.bgColor}`}
      >
        <Award className="h-2.5 w-2.5" />
        <span>Lv.{info.level}</span>
        <span>{info.title}</span>
      </span>
    );
  }

  // md size: with progress bar
  const progressPercent =
    info.nextLevelAt > 0
      ? Math.round((info.level / info.nextLevelAt) * 100)
      : 100;

  const nextTierTitle = info.nextLevelAt > 0
    ? getLevelInfo(info.nextLevelAt).title
    : null;

  return (
    <div className="w-full max-w-xs">
      <div className={`flex items-center gap-1.5 mb-1 ${info.color}`}>
        <Award className="h-4 w-4" />
        <span className="text-sm font-bold">Lv.{info.level}</span>
        <span className="text-sm font-medium">{info.title}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${info.level >= 150 ? "bg-gradient-to-r from-orange-400 to-red-500" : info.level >= 75 ? "bg-gradient-to-r from-cyan-400 to-purple-500" : "bg-primary"}`}
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {info.nextLevelAt > 0 ? (
          <>
            {info.level}/{info.nextLevelAt} (次: {nextTierTitle})
          </>
        ) : (
          <>MAX</>
        )}
      </p>
    </div>
  );
}
