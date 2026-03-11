import type { Metadata } from "next";
import Link from "next/link";
import { TherapistImage } from "@/components/shared/therapist-image";
import { ChevronRight, Star, MapPin, PenSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Sidebar } from "@/components/layout/sidebar";
import { therapistTypes } from "@/lib/data";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { cleanTherapistName } from "@/lib/therapist-utils";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type } = await params;
  const typeInfo = therapistTypes.find((t) => t.id === type);
  const typeName = typeInfo?.label || decodeURIComponent(type);
  return {
    title: `${typeName}系セラピスト`,
    description: `${typeName}系のメンズエステセラピスト一覧。口コミ評価の高い${typeName}系セラピストを探せます。`,
    alternates: { canonical: `/type/${type}` },
  };
}

interface DBTherapist {
  id: number;
  name: string;
  image_urls: string[] | null;
  salon_id: number;
  age: number | null;
  salons: { name: string; display_name: string | null } | null;
}

export default async function TypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const typeInfo = therapistTypes.find((t) => t.id === type);
  const typeName = typeInfo?.label || decodeURIComponent(type);
  const typeDescription = typeInfo?.description || "";

  // 口コミからタイプが判明しているセラピストを取得
  const { data: reviewData } = await supabase
    .from("reviews")
    .select("therapist_id")
    .eq("looks_type_id", Number(type));

  let typeTherapists: DBTherapist[] = [];

  if (reviewData && reviewData.length > 0) {
    const therapistIds = [...new Set(reviewData.map((r) => r.therapist_id))];
    const { data } = await supabase
      .from("therapists")
      .select("id, name, image_urls, salon_id, age, salons(name, display_name)")
      .in("id", therapistIds)
      .eq("status", "active")
      .limit(30);
    typeTherapists = (data as unknown as DBTherapist[]) || [];
  }

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
          <span className="text-foreground">{typeName}系セラピスト</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {/* Hero */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-4 mb-4">
                {typeInfo && (
                  <div className="text-4xl">{typeInfo.icon}</div>
                )}
                <div>
                  <h1 className="text-2xl font-bold">{typeName}系セラピスト</h1>
                  <p className="text-muted-foreground">
                    {typeTherapists.length > 0
                      ? `${typeTherapists.length}名のセラピストが登録中`
                      : "口コミ投稿でセラピストのタイプが判明します"}
                  </p>
                </div>
              </div>
              {typeDescription && (
                <p className="text-sm text-muted-foreground">
                  {typeDescription}
                </p>
              )}
            </div>

            {typeTherapists.length > 0 ? (
              <>
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">
                    {typeTherapists.length}件のセラピストが見つかりました
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {typeTherapists.map((therapist) => {
                    const imageUrl = therapist.image_urls?.[0];
                    const salonName = therapist.salons?.display_name || therapist.salons?.name || "";
                    const displayName = cleanTherapistName(therapist.name);
                    return (
                      <Link key={therapist.id} href={`/therapist/${therapist.id}`}>
                        <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full">
                          <div className="aspect-[4/3] relative bg-muted">
                            <TherapistImage
                              src={imageUrl}
                              alt={displayName}
                              fill
                              className="object-cover"
                            />
                            <div className="absolute top-2 left-2">
                              <Badge className="bg-primary text-primary-foreground">
                                {typeName}
                              </Badge>
                            </div>
                          </div>
                          <CardContent className="p-4">
                            <h3 className="font-bold">{displayName}</h3>
                            <p className="text-sm text-muted-foreground">{salonName}</p>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Empty state - no typed therapists yet */
              <div className="text-center py-16">
                <PenSquare className="h-16 w-16 mx-auto text-muted-foreground mb-6" />
                <h2 className="text-xl font-bold mb-2">
                  まだ{typeName}系のデータがありません
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  口コミを投稿するとセラピストのタイプが記録され、このページに表示されます。
                  あなたの投稿が他のユーザーの「発見」につながります。
                </p>
                <Link href="/review">
                  <Button size="lg">口コミを投稿する</Button>
                </Link>
              </div>
            )}
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
