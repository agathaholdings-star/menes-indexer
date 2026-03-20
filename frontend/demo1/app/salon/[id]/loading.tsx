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
              {/* Shop header with image */}
              <div className="flex flex-col sm:flex-row gap-6 mb-8">
                <div className="w-full sm:w-48 aspect-square bg-muted rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-8 w-56 bg-muted rounded" />
                  <div className="h-5 w-40 bg-muted rounded" />
                  <div className="h-4 w-64 bg-muted rounded" />
                  <div className="h-4 w-48 bg-muted rounded" />
                </div>
              </div>
              {/* Info cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 bg-muted rounded-xl" />
                ))}
              </div>
              {/* Therapist grid */}
              <div className="mb-8">
                <div className="h-6 w-40 bg-muted rounded mb-4" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="aspect-[3/4] bg-muted rounded-xl" />
                      <div className="h-4 w-20 bg-muted rounded" />
                      <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              </div>
              {/* Reviews skeleton */}
              <div className="space-y-4">
                <div className="h-6 w-32 bg-muted rounded" />
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded-xl" />
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
