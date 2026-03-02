export interface LevelInfo {
  level: number;
  title: string;
  color: string;        // tailwind text color
  borderColor: string;  // tailwind border color
  bgColor: string;      // tailwind bg color (for badge)
  nextLevelAt: number;  // next tier minimum level (0 if max)
}

const LEVEL_TIERS = [
  { min: 150, title: "レジェンド", color: "text-orange-500", borderColor: "border-orange-400", bgColor: "bg-orange-50", nextLevelAt: 0 },
  { min: 100, title: "マスター", color: "text-red-500", borderColor: "border-red-400", bgColor: "bg-red-50", nextLevelAt: 150 },
  { min: 75, title: "ダイヤモンド", color: "text-cyan-500", borderColor: "border-cyan-400", bgColor: "bg-cyan-50", nextLevelAt: 100 },
  { min: 50, title: "プラチナ", color: "text-purple-500", borderColor: "border-purple-400", bgColor: "bg-purple-50", nextLevelAt: 75 },
  { min: 35, title: "ゴールド", color: "text-yellow-500", borderColor: "border-yellow-400", bgColor: "bg-yellow-50", nextLevelAt: 50 },
  { min: 20, title: "シルバー", color: "text-slate-500", borderColor: "border-slate-400", bgColor: "bg-slate-50", nextLevelAt: 35 },
  { min: 10, title: "ブロンズ", color: "text-amber-600", borderColor: "border-amber-500", bgColor: "bg-amber-50", nextLevelAt: 20 },
  { min: 5, title: "レギュラー", color: "text-blue-500", borderColor: "border-blue-400", bgColor: "bg-blue-50", nextLevelAt: 10 },
  { min: 1, title: "ビギナー", color: "text-gray-500", borderColor: "border-gray-300", bgColor: "bg-gray-50", nextLevelAt: 5 },
] as const;

export function getLevelInfo(totalReviews: number): LevelInfo {
  const level = Math.min(Math.max(totalReviews, 0), 199);

  if (level === 0) {
    return {
      level: 0,
      title: "",
      color: "",
      borderColor: "",
      bgColor: "",
      nextLevelAt: 1,
    };
  }

  for (const tier of LEVEL_TIERS) {
    if (level >= tier.min) {
      return {
        level,
        title: tier.title,
        color: tier.color,
        borderColor: tier.borderColor,
        bgColor: tier.bgColor,
        nextLevelAt: tier.nextLevelAt,
      };
    }
  }

  // fallback (should not reach)
  return {
    level,
    title: "ビギナー",
    color: "text-gray-500",
    borderColor: "border-gray-300",
    bgColor: "bg-gray-50",
    nextLevelAt: 5,
  };
}
