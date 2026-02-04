"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const prefectures = [
  { label: "全国", value: "" },
  { label: "東京", value: "東京" },
  { label: "神奈川", value: "神奈川" },
  { label: "大阪", value: "大阪" },
  { label: "愛知", value: "愛知" },
  { label: "福岡", value: "福岡" },
];

export function HeroSection() {
  const router = useRouter();
  const [selectedArea, setSelectedArea] = useState(prefectures[0]);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedArea.value) params.set("area", selectedArea.value);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 sm:p-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl text-center">
        {/* Badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <Sparkles className="h-3 w-3" />
          次世代メンズエステ口コミサービス
        </div>

        {/* Main Copy */}
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl text-balance leading-tight">
          名前を知らなくても、タイプで<span className="relative">
            <span className="relative z-10">"発見"</span>
            <span className="absolute bottom-0 left-0 right-0 h-2 bg-white/30 -z-0" />
          </span>できる
        </h1>

        <p className="mt-3 text-sm text-white/80">
          清楚系、ギャル系、アイドル系...好みのタイプから、あなたにぴったりのセラピストが見つかる
        </p>

        {/* Search Bar */}
        <div className="mt-6 mx-auto max-w-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center rounded-xl bg-white p-1.5 shadow-xl">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full sm:w-auto gap-2 text-foreground hover:bg-muted justify-start sm:justify-center px-4">
                  <MapPin className="h-4 w-4 text-primary" />
                  {selectedArea.label}
                  <ChevronDown className="h-4 w-4 ml-auto sm:ml-1 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {prefectures.map((area) => (
                  <DropdownMenuItem
                    key={area.label}
                    onClick={() => setSelectedArea(area)}
                  >
                    {area.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="hidden sm:block w-px h-8 bg-border" />

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="店舗名・セラピスト名で検索"
                className="pl-10 border-0 shadow-none focus-visible:ring-0 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            <Button size="lg" className="w-full sm:w-auto px-8 rounded-xl" onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2 sm:hidden" />
              検索
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-white/80">
          <div className="text-center">
            <p className="text-xl font-bold text-white">14,500+</p>
            <p className="text-xs">登録店舗</p>
          </div>
          <div className="w-px h-8 bg-white/20 hidden sm:block" />
          <div className="text-center">
            <p className="text-xl font-bold text-white">45万+</p>
            <p className="text-xs">口コミ件数</p>
          </div>
          <div className="w-px h-8 bg-white/20 hidden sm:block" />
          <div className="text-center">
            <p className="text-xl font-bold text-white">6</p>
            <p className="text-xs">タイプ分類</p>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
    </section>
  );
}
