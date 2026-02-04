"use client";

import { SiteHeader } from "@/components/layout/site-header";
import { Sidebar } from "@/components/layout/sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { HeroSection } from "@/components/home/hero-section";
import { TypeGrid } from "@/components/home/type-grid";
import { VipFilter } from "@/components/home/vip-filter";
import { AreaGrid } from "@/components/home/area-grid";
import { LatestReviews } from "@/components/home/latest-reviews";
import { PopularTherapists } from "@/components/home/popular-therapists";
import { AreaPopularShops } from "@/components/home/area-popular-shops";
import {
  MemberLevelProvider,
  MemberLevelDebug,
} from "@/components/shared/member-level-debug";

export function HomePageClient() {
  return (
    <MemberLevelProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />

        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6">
            {/* Debug: Member Level Switcher */}
            <MemberLevelDebug />

            {/* Hero - Full Width Above Columns */}
            <div className="mt-4">
              <HeroSection />
            </div>

            {/* 2-column layout below hero */}
            <div className="mt-6 flex flex-col gap-8 lg:flex-row">
              {/* Main Column */}
              <div className="flex-1 space-y-6">
                <TypeGrid />
                <VipFilter />
                <AreaPopularShops />
                <AreaGrid />
                <LatestReviews />
                <PopularTherapists />
              </div>

              {/* Sidebar */}
              <div className="lg:w-80 lg:shrink-0">
                <div className="lg:sticky lg:top-24">
                  <Sidebar />
                </div>
              </div>
            </div>
          </div>
        </main>

        <SiteFooter />
      </div>
    </MemberLevelProvider>
  );
}
