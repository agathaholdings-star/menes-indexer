import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-6">
        <div className="animate-pulse">
          {/* Breadcrumb skeleton */}
          <div className="flex gap-2 mb-6">
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
          </div>
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main content */}
            <div className="flex-1">
              {/* Hero skeleton */}
              <div className="bg-muted/50 rounded-xl p-6 mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-muted" />
                  <div className="space-y-2">
                    <div className="h-7 w-52 bg-muted rounded" />
                    <div className="h-4 w-32 bg-muted rounded" />
                  </div>
                </div>
                <div className="h-4 w-80 bg-muted rounded" />
              </div>
              {/* Section heading */}
              <div className="h-6 w-36 bg-muted rounded mb-4" />
              {/* Area card grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted rounded-xl" />
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
