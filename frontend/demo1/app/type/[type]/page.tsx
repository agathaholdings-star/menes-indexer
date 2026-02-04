import Link from "next/link";
import { ChevronRight, Star, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Sidebar } from "@/components/layout/sidebar";
import { therapists, therapistTypes } from "@/lib/data";

export default async function TypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const typeInfo = therapistTypes.find((t) => t.id === type);
  const typeTherapists = therapists.filter((t) => t.primaryType === type);

  const typeName = typeInfo?.label || decodeURIComponent(type);
  const typeDescription = typeInfo?.description || "";

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
                    {typeTherapists.length > 0 ? typeTherapists.length : "多数"}名のセラピストが登録中
                  </p>
                </div>
              </div>
              {typeDescription && (
                <p className="text-sm text-muted-foreground">
                  {typeDescription}
                </p>
              )}
            </div>

            {/* Results Count */}
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                {typeTherapists.length > 0 ? typeTherapists.length : therapists.length}件のセラピストが見つかりました
              </p>
            </div>

            {/* Therapist Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(typeTherapists.length > 0 ? typeTherapists : therapists).map((therapist) => (
                <Link key={therapist.id} href={`/therapist/${therapist.id}`}>
                  <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full">
                    <div className="aspect-[4/3] relative bg-muted">
                      <img
                        src={therapist.images[0] || "/placeholder.svg"}
                        alt={therapist.name}
                        className="object-cover w-full h-full"
                      />
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-primary text-primary-foreground">
                          {therapistTypes.find((t) => t.id === therapist.primaryType)?.label || typeName}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-bold">{therapist.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {therapist.shopName}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-4 w-4 fill-primary text-primary" />
                          <span className="font-medium">{therapist.rating}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <MapPin className="h-3 w-3" />
                        <span>{therapist.area}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {therapist.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
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
