import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background animate-page-in">
      <SiteHeader />
      <main className="container mx-auto px-4 py-6">
        <div className="animate-pulse">
          {/* Breadcrumb skeleton */}
          <div className="flex gap-2 mb-6">
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="h-4 w-28 bg-muted rounded" />
          </div>
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main content */}
            <div className="flex-1">
              {/* Hero skeleton */}
              <div className="bg-muted/50 rounded-xl p-6 mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-muted" />
                  <div className="space-y-2">
                    <div className="h-7 w-64 bg-muted rounded" />
                    <div className="h-4 w-36 bg-muted rounded" />
                  </div>
                </div>
                <div className="h-4 w-72 bg-muted rounded mt-2" />
              </div>
              {/* Filter bar skeleton */}
              <div className="flex gap-3 mb-6">
                <div className="h-10 w-24 bg-muted rounded-lg" />
                <div className="h-10 w-24 bg-muted rounded-lg" />
                <div className="h-10 w-24 bg-muted rounded-lg" />
              </div>
              {/* Salon card list */}
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-muted/30 rounded-xl">
                    <div className="w-24 h-24 bg-muted rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-48 bg-muted rounded" />
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="h-4 w-64 bg-muted rounded" />
                      <div className="flex gap-2 mt-2">
                        <div className="h-6 w-16 bg-muted rounded-full" />
                        <div className="h-6 w-16 bg-muted rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Sidebar skeleton */}
            <div className="hidden lg:block w-80 flex-shrink-0">
              <div className="h-64 bg-muted rounded-xl mb-4" />
              <div className="h-48 bg-muted rounded-xl" />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
