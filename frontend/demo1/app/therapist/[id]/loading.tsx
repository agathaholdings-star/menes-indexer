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
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="h-4 w-24 bg-muted rounded" />
          </div>
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main content */}
            <div className="flex-1">
              {/* Image skeleton */}
              <div className="aspect-[3/4] max-w-sm bg-muted rounded-xl mb-6" />
              {/* Name skeleton */}
              <div className="h-8 w-48 bg-muted rounded mb-2" />
              <div className="h-5 w-32 bg-muted rounded mb-6" />
              {/* Profile table skeleton */}
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted rounded" />
                ))}
              </div>
              {/* Radar chart skeleton */}
              <div className="mt-8">
                <div className="h-6 w-40 bg-muted rounded mb-4" />
                <div className="h-64 bg-muted rounded-xl" />
              </div>
              {/* Reviews skeleton */}
              <div className="mt-8 space-y-4">
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
