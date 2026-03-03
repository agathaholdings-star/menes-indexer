import Link from "next/link";
import Image from "next/image";
import { Crown, TrendingUp, Star, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockTherapists, mockShops } from "@/lib/data";

const MIN_REVIEW_COUNT_FOR_RANKING = 3;

const rankingTherapists = [...mockTherapists]
  .filter((t) => t.reviewCount >= MIN_REVIEW_COUNT_FOR_RANKING)
  .sort((a, b) => b.averageScore - a.averageScore)
  .slice(0, 5);

interface SidebarProps {
  /** 都道府県名でおすすめ店舗をフィルターする（例: "東京", "大阪"） */
  prefectureName?: string;
}

export function Sidebar({ prefectureName }: SidebarProps = {}) {
  const recommendedShops = prefectureName
    ? mockShops.filter((shop) => shop.area === prefectureName)
    : mockShops;

  // フィルター結果が少ない場合は全店舗をフォールバック表示
  const displayShops = recommendedShops.length > 0 ? recommendedShops : mockShops;
  return (
    <aside className="flex flex-col gap-6">
      {/* Ranking Card */}
      {rankingTherapists.length > 0 && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-5 w-5 text-primary" />
            人気ランキング
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-3">
            {rankingTherapists.map((therapist, index) => (
              <li key={therapist.id}>
                <Link
                  href={`/therapist/${therapist.id}`}
                  className="flex items-center gap-3 group"
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0
                        ? "bg-primary text-primary-foreground"
                        : index === 1
                        ? "bg-primary/70 text-primary-foreground"
                        : index === 2
                        ? "bg-primary/50 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="relative h-10 w-10 overflow-hidden rounded-full">
                    <Image
                      src={therapist.images[0] || "/placeholder.svg"}
                      alt={therapist.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {therapist.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {therapist.shopName}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 text-primary">
                    <Star className="h-3 w-3 fill-current" />
                    <span className="text-xs font-bold">{therapist.averageScore}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/ranking"
            className="mt-4 flex items-center justify-center gap-1 text-sm text-primary hover:underline"
          >
            <TrendingUp className="h-4 w-4" />
            ランキングをもっと見る
          </Link>
        </CardContent>
      </Card>
      )}

      {/* Recommended Shops */}
      {displayShops.length > 0 && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-primary" />
            おすすめ店舗
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-2">
            {displayShops.map((shop) => (
              <li key={shop.id}>
                <Link
                  href={`/shop/${shop.id}`}
                  className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{shop.name}</p>
                    <p className="text-xs text-muted-foreground">{shop.district}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-0.5 text-primary">
                      <Star className="h-3 w-3 fill-current" />
                      <span className="text-xs font-bold">{shop.averageScore}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {shop.reviewCount}件
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      )}
    </aside>
  );
}
