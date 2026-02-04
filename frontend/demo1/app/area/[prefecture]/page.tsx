import Link from "next/link";
import { MapPin, ChevronRight, Store, Users, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Sidebar } from "@/components/layout/sidebar";
import { areas, shops, therapists } from "@/lib/data";

export default async function AreaPrefecturePage({
  params,
}: {
  params: Promise<{ prefecture: string }>;
}) {
  const { prefecture } = await params;
  const area = areas.find((a) => a.id === prefecture);
  const areaShops = shops.filter((s) => s.area === prefecture);
  const areaTherapists = therapists.filter((t) => t.area === prefecture || t.area === area?.name);

  const prefectureName = area?.name || decodeURIComponent(prefecture);

  // Districts with mock data
  const districts = [
    { id: "shinjuku", name: "新宿", shopCount: 24, therapistCount: 156 },
    { id: "ikebukuro", name: "池袋", shopCount: 18, therapistCount: 98 },
    { id: "shibuya", name: "渋谷", shopCount: 15, therapistCount: 87 },
    { id: "roppongi", name: "六本木", shopCount: 12, therapistCount: 64 },
    { id: "ueno", name: "上野", shopCount: 21, therapistCount: 112 },
    { id: "gotanda", name: "五反田", shopCount: 28, therapistCount: 178 },
    { id: "kinshicho", name: "錦糸町", shopCount: 14, therapistCount: 72 },
    { id: "akihabara", name: "秋葉原", shopCount: 8, therapistCount: 45 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition-colors">
            ホーム
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{prefectureName}</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {/* Hero */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{prefectureName}のメンズエステ</h1>
                  <p className="text-muted-foreground">
                    {areaShops.length > 0 ? areaShops.length : districts.reduce((sum, d) => sum + d.shopCount, 0)}店舗 /{" "}
                    {areaTherapists.length > 0 ? areaTherapists.length : districts.reduce((sum, d) => sum + d.therapistCount, 0)}名のセラピスト
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {prefectureName}エリアのメンズエステ店舗・セラピスト情報を掲載。
                口コミやレーダーチャートで自分に合ったセラピストを見つけよう。
              </p>
            </div>

            {/* District Grid */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4">エリアから探す</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {districts.map((district) => (
                  <Link
                    key={district.id}
                    href={`/area/${prefecture}/${district.id}`}
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardContent className="p-4">
                        <h3 className="font-bold text-lg mb-2">{district.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Store className="h-4 w-4" />
                            {district.shopCount}店舗
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {district.therapistCount}名
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>

            {/* Popular Shops in Area */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">人気の店舗</h2>
                <Link
                  href={`/search?area=${prefecture}`}
                  className="text-sm text-primary hover:underline"
                >
                  すべて見る
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {shops.slice(0, 4).map((shop) => (
                  <Link key={shop.id} href={`/shop/${shop.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                            <img
                              src={shop.thumbnail || "/placeholder.svg"}
                              alt={shop.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold truncate">{shop.name}</h3>
                            <p className="text-sm text-muted-foreground mb-1">
                              {shop.district}
                            </p>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 fill-primary text-primary" />
                                <span className="text-sm font-medium">
                                  {shop.rating}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                ({shop.reviewCount}件)
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {shop.therapistCount}名在籍
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>

            {/* Popular Therapists in Area */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">人気のセラピスト</h2>
                <Link
                  href={`/search?area=${prefecture}`}
                  className="text-sm text-primary hover:underline"
                >
                  すべて見る
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {therapists.slice(0, 6).map((therapist, index) => (
                  <Link key={therapist.id} href={`/therapist/${therapist.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-14 h-14 rounded-full bg-muted overflow-hidden">
                              <img
                                src={therapist.images[0] || "/placeholder.svg"}
                                alt={therapist.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold truncate">{therapist.name}</h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {therapist.shopName}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="h-3 w-3 fill-primary text-primary" />
                              <span className="text-xs font-medium">
                                {therapist.rating}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({therapist.reviewCount}件)
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-80 flex-shrink-0">
            <Sidebar />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
