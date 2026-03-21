"use client";

import { SiteHeader } from "@/components/layout/site-header";
import { Sidebar } from "@/components/layout/sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { HeroSection } from "@/components/home/hero-section";
import { AreaGrid } from "@/components/home/area-grid";
import { LatestReviews } from "@/components/home/latest-reviews";
import type { LatestReview } from "@/components/home/latest-reviews";
import { TopReviewedSalons } from "@/components/home/top-reviewed-salons";
import type { SalonWithReviewCount } from "@/components/home/top-reviewed-salons";
import { ReviewCtaBanner } from "@/components/home/review-cta-banner";
import type { AreasGrouped, AreaItem } from "@/lib/supabase-data";

interface SidebarTherapist {
  id: number;
  name: string;
  image_url: string | null;
  shop_name: string;
}

interface SidebarShop {
  id: number;
  name: string;
  display_name: string | null;
  slug: string | null;
  access: string | null;
}

interface HomePageClientProps {
  areasGrouped: AreasGrouped;
  popularAreas: (AreaItem & { name: string })[];
  regionOrder: string[];
  latestReviews: LatestReview[];
  topReviewedSalons: SalonWithReviewCount[];
  initialSidebarTherapists?: SidebarTherapist[];
  initialSidebarShops?: SidebarShop[];
}

export function HomePageClient({ areasGrouped, popularAreas, regionOrder, latestReviews, topReviewedSalons, initialSidebarTherapists, initialSidebarShops }: HomePageClientProps) {
  return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />

        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6">
            {/* Hero - Full Width Above Columns */}
            <div className="mt-4">
              <HeroSection />
            </div>

            {/* 2-column layout below hero */}
            <div className="mt-6 flex flex-col gap-8 lg:flex-row">
              {/* Main Column */}
              <div className="flex-1 min-w-0 space-y-6">
                <AreaGrid
                  areasGrouped={areasGrouped}
                  popularAreas={popularAreas}
                  regionOrder={regionOrder}
                />
                <LatestReviews reviews={latestReviews} />
                <TopReviewedSalons salons={topReviewedSalons} />
                <ReviewCtaBanner />
              </div>

              {/* Sidebar */}
              <div className="lg:w-80 lg:shrink-0">
                <div className="lg:sticky lg:top-24">
                  <Sidebar initialTherapists={initialSidebarTherapists} initialShops={initialSidebarShops} />
                </div>
              </div>
            </div>
          </div>
        </main>

        <SiteFooter />
      </div>
  );
}
