"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Clock, Eye, ChevronRight, Search, Plus, Pin, Flame, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Sidebar } from "@/components/layout/sidebar";

const categories = [
  { id: "all", label: "すべて" },
  { id: "question", label: "質問" },
  { id: "info", label: "情報共有" },
  { id: "review", label: "体験談" },
  { id: "other", label: "雑談" },
];

const threads = [
  {
    id: 1,
    title: "新宿エリアでおすすめの店舗を教えてください",
    category: "question",
    author: "名無しさん",
    createdAt: "2時間前",
    replyCount: 24,
    viewCount: 312,
    lastReplyAt: "5分前",
    isPinned: true,
    isHot: true,
  },
  {
    id: 2,
    title: "初めてメンズエステに行く方へのアドバイス",
    category: "info",
    author: "経験者A",
    createdAt: "1日前",
    replyCount: 156,
    viewCount: 2341,
    lastReplyAt: "30分前",
    isPinned: true,
    isHot: false,
  },
  {
    id: 3,
    title: "池袋の〇〇に行ってきました",
    category: "review",
    author: "レビュアーB",
    createdAt: "3時間前",
    replyCount: 8,
    viewCount: 89,
    lastReplyAt: "1時間前",
    isPinned: false,
    isHot: true,
  },
  {
    id: 4,
    title: "施術中の会話ってどうしてますか？",
    category: "question",
    author: "名無しさん",
    createdAt: "5時間前",
    replyCount: 42,
    viewCount: 523,
    lastReplyAt: "10分前",
    isPinned: false,
    isHot: false,
  },
  {
    id: 5,
    title: "最近オープンした店舗情報まとめ",
    category: "info",
    author: "情報通C",
    createdAt: "2日前",
    replyCount: 67,
    viewCount: 1205,
    lastReplyAt: "2時間前",
    isPinned: false,
    isHot: false,
  },
  {
    id: 6,
    title: "予約が取りにくいセラピストの攻略法",
    category: "other",
    author: "名無しさん",
    createdAt: "1日前",
    replyCount: 33,
    viewCount: 678,
    lastReplyAt: "45分前",
    isPinned: false,
    isHot: false,
  },
];

export default function BBSPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = threads.filter((thread) => {
    const matchesCategory = activeCategory === "all" || thread.category === activeCategory;
    const matchesSearch = !searchQuery || thread.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedThreads = [...filteredThreads].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold">掲示板</h1>
                <p className="text-muted-foreground">メンズエステについて自由に語り合おう</p>
              </div>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                新規スレッド作成
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="スレッドを検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-6">
              <TabsList className="flex flex-wrap h-auto gap-1">
                {categories.map((category) => (
                  <TabsTrigger key={category.id} value={category.id} className="text-sm">
                    {category.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="space-y-3">
              {sortedThreads.map((thread) => (
                <Link key={thread.id} href={`/bbs/${thread.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {thread.isPinned && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Pin className="h-3 w-3" />
                                固定
                              </Badge>
                            )}
                            {thread.isHot && (
                              <Badge variant="secondary" className="gap-1 text-xs bg-orange-100 text-orange-700">
                                <Flame className="h-3 w-3" />
                                HOT
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {categories.find((c) => c.id === thread.category)?.label}
                            </Badge>
                          </div>
                          <h3 className="font-medium mb-2 line-clamp-1">{thread.title}</h3>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{thread.author}</span>
                            <span>{thread.createdAt}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            <span>{thread.replyCount}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            <span>{thread.viewCount}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{thread.lastReplyAt}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {sortedThreads.length === 0 && (
              <div className="text-center py-12">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">該当するスレッドがありません</p>
              </div>
            )}

            <div className="flex justify-center mt-8">
              <Button variant="outline">もっと見る</Button>
            </div>
          </div>

          <aside className="w-full lg:w-80 flex-shrink-0">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  人気のスレッド
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {threads.slice(0, 5).map((thread, index) => (
                  <Link key={thread.id} href={`/bbs/${thread.id}`} className="flex items-start gap-3 group">
                    <span className="text-lg font-bold text-muted-foreground w-6">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                        {thread.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{thread.replyCount}件のレス</p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">掲示板ルール</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>・個人情報の投稿は禁止です</li>
                  <li>・誹謗中傷・荒らし行為は禁止です</li>
                  <li>・法律に違反する内容は禁止です</li>
                  <li>・宣伝・営業目的の投稿は禁止です</li>
                </ul>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
