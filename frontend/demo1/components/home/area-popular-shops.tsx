"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { mockShops } from "@/lib/data";

const areaShops = {
  東京: [
    { id: "shop1", name: "relax tokyo（リラックス東京）", area: "新橋", image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6c?w=400&h=200&fit=crop", description: "新橋駅近でスタイルのいいセラピストさん多数。上質で新感覚なトロけるオイルマッサージは体験必須！！" },
    { id: "shop2", name: "グランドガイア（Grand Gaia）", area: "代々木", image: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=400&h=200&fit=crop", description: "追加オプションなく明朗会計の非常にコスパ良いサロン。セラピストの質も大変良く満足度が高いです。" },
    { id: "shop3", name: "SALON BLANCA（サロンブランカ）", area: "人形町", image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&h=200&fit=crop", description: "人形町のメンエスならここ一択かもしれません！キレイなお姉さんセラピストがたくさん待ってます！" },
    { id: "shop4", name: "ANNA（アンナ）", area: "五反田", image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=200&fit=crop", description: "口コミはもちろんぜひ体験レポートも読んでいただきたい、激戦区でも人気のサロン。" },
  ],
  大阪: [
    { id: "shop5", name: "ルミエール梅田", area: "梅田", image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6c?w=400&h=200&fit=crop", description: "梅田エリアNo.1の人気店。厳選されたセラピストが在籍。" },
    { id: "shop6", name: "アロマクイーン難波", area: "難波", image: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=400&h=200&fit=crop", description: "難波駅直結の好立地。リピーター続出の人気サロン。" },
    { id: "shop7", name: "心斎橋プレミアム", area: "心斎橋", image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&h=200&fit=crop", description: "心斎橋の隠れ家サロン。ワンランク上の癒しを体験。" },
    { id: "shop8", name: "天王寺リラクゼーション", area: "天王寺", image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=200&fit=crop", description: "天王寺エリアで話題の新店舗。口コミ急上昇中！" },
  ],
  名古屋: [
    { id: "shop9", name: "栄アロマスパ", area: "栄", image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6c?w=400&h=200&fit=crop", description: "栄駅徒歩3分。名古屋最大級のセラピスト数を誇る。" },
    { id: "shop10", name: "名駅プレミアムサロン", area: "名駅", image: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=400&h=200&fit=crop", description: "名古屋駅直結の好立地。出張ビジネスマンに人気。" },
    { id: "shop11", name: "金山リフレッシュ", area: "金山", image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&h=200&fit=crop", description: "金山総合駅すぐ。コスパ抜群で初心者にもおすすめ。" },
    { id: "shop12", name: "今池ヒーリング", area: "今池", image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=200&fit=crop", description: "今池エリアの老舗サロン。安定したサービス品質。" },
  ],
  福岡: [
    { id: "shop13", name: "中洲プレミアム", area: "中洲", image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6c?w=400&h=200&fit=crop", description: "中洲エリアNo.1。九州最大級のメンズエステ。" },
    { id: "shop14", name: "天神アロマガーデン", area: "天神", image: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=400&h=200&fit=crop", description: "天神駅徒歩2分。福岡で最も予約の取れないサロン。" },
    { id: "shop15", name: "博多リラクゼーション", area: "博多", image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&h=200&fit=crop", description: "博多駅直結。出張ビジネスマンに絶大な人気。" },
    { id: "shop16", name: "博多プレミアムスパ", area: "博多", image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=200&fit=crop", description: "博多の新店舗。口コミ急上昇中の注目サロン。" },
  ],
};

interface AreaSectionProps {
  area: string;
  shops: typeof areaShops.東京;
  defaultOpen?: boolean;
}

function AreaSection({ area, shops, defaultOpen = false }: AreaSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
      >
        <span>{area}エリアのおすすめメンズエステ</span>
        <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      
      {isOpen && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-background">
          {shops.map((shop) => (
            <div key={shop.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative">
                <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                  {shop.name}
                </span>
                <Image
                  src={shop.image || "/placeholder.svg"}
                  alt={shop.name}
                  width={400}
                  height={200}
                  className="w-full h-32 object-cover"
                />
              </div>
              <div className="p-3">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {shop.description}
                </p>
                <Link href={`/shop/${shop.id}`}>
                  <Button variant="outline" className="w-full text-primary border-primary hover:bg-primary/5 bg-transparent">
                    口コミと店舗詳細を見る
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AreaPopularShops() {
  return (
    <section className="mt-8">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            口コミ投稿急上昇サロン
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AreaSection area="東京" shops={areaShops.東京} defaultOpen={true} />
          <AreaSection area="大阪" shops={areaShops.大阪} />
          <AreaSection area="名古屋" shops={areaShops.名古屋} />
          <AreaSection area="福岡" shops={areaShops.福岡} />
        </CardContent>
      </Card>
    </section>
  );
}
