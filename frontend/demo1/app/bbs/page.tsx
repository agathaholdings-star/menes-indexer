"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MessageCircle, Clock, Eye, Search, Plus, Pin, Flame, TrendingUp, Send, Lock, Crown, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { type User, getEffectiveTier, tierPermissions } from "@/lib/data";

const categories = [
  { id: "all", label: "すべて" },
  { id: "question", label: "質問" },
  { id: "info", label: "情報共有" },
  { id: "review", label: "体験談" },
  { id: "other", label: "雑談" },
  { id: "vip", label: "VIP" },
];

interface DBThread {
  id: number;
  title: string;
  category: string;
  is_pinned: boolean;
  is_vip_only: boolean;
  view_count: number;
  reply_count: number;
  last_reply_at: string | null;
  created_at: string;
  user_id: string;
  profiles: { nickname: string | null } | null;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

export default function BBSPage() {
  const { user: authUser } = useAuth();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [threads, setThreads] = useState<DBThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState("other");
  const [creating, setCreating] = useState(false);
  const [newIsVipOnly, setNewIsVipOnly] = useState(false);

  // ティアチェック用
  const [membershipType, setMembershipType] = useState<string>("free");
  const [monthlyReviewCount, setMonthlyReviewCount] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  const { loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) { setProfileLoading(false); return; }
    const supabase = createSupabaseBrowser();
    supabase
      .from("profiles")
      .select("membership_type, monthly_review_count")
      .eq("id", authUser.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setMembershipType(data.membership_type || "free");
          setMonthlyReviewCount(data.monthly_review_count || 0);
        }
        setProfileLoading(false);
      });
  }, [authUser, authLoading]);

  const tierUser: User = {
    id: authUser?.id || "",
    email: authUser?.email || "",
    name: "",
    memberType: (membershipType as "free" | "standard" | "vip"),
    monthlyReviewCount,
    totalReviewCount: 0,
    registeredAt: "",
    favorites: [],
  };
  const effectiveTier = authUser ? getEffectiveTier(tierUser) : "free";
  const permissions = tierPermissions[effectiveTier];

  const fetchThreads = async () => {
    const supabase = createSupabaseBrowser();
    const { data } = await supabase
      .from("bbs_threads")
      .select("id, title, category, is_pinned, is_vip_only, view_count, reply_count, last_reply_at, created_at, user_id, profiles(nickname)")
      .order("is_pinned", { ascending: false })
      .order("last_reply_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(50);
    setThreads((data as unknown as DBThread[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchThreads(); }, []);

  const filteredThreads = threads.filter((thread) => {
    const matchesSearch = !searchQuery || thread.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeCategory === "vip") {
      return thread.is_vip_only;
    }
    // 通常タブではVIPスレッドを非VIPユーザーには非表示
    if (thread.is_vip_only && !permissions.canUseVIPBBS) return false;
    const matchesCategory = activeCategory === "all" || thread.category === activeCategory;
    return matchesCategory;
  });

  const handleCreateThread = async () => {
    if (!authUser || !newTitle.trim() || !newBody.trim()) return;
    setCreating(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.from("bbs_threads").insert({
      user_id: authUser.id,
      title: newTitle.trim(),
      body: newBody.trim(),
      category: newCategory,
      is_vip_only: newIsVipOnly,
    });
    if (!error) {
      setNewTitle("");
      setNewBody("");
      setNewCategory("other");
      setNewIsVipOnly(false);
      setShowCreateModal(false);
      fetchThreads();
    }
    setCreating(false);
  };

  // 人気スレッド（reply_count順）
  const popularThreads = [...threads].sort((a, b) => b.reply_count - a.reply_count).slice(0, 5);

  // Auth/プロフィール読み込み中
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-12 text-center">
          <div className="animate-pulse h-8 bg-muted rounded w-48 mx-auto" />
        </main>
        <SiteFooter />
      </div>
    );
  }

  // ティアゲート: スタンダード以上のみ
  if (!permissions.canUseBBS) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-muted/50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <Lock className="h-10 w-10 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-3">掲示板</h1>
            <p className="text-muted-foreground mb-6">
              掲示板はスタンダード会員以上の方がご利用いただけます。
              アップグレードしてコミュニティに参加しましょう。
            </p>
            <Link href="/pricing">
              <Button size="lg" className="gap-2">
                <Crown className="h-4 w-4" />
                スタンダード会員にアップグレード
              </Button>
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

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
              <Button className="gap-2" onClick={() => setShowCreateModal(true)} disabled={!authUser}>
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
                  <TabsTrigger key={category.id} value={category.id} className={`text-sm ${category.id === "vip" ? "gap-1" : ""}`}>
                    {category.id === "vip" && <Crown className="h-3 w-3" />}
                    {category.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* VIPタブ選択時に非VIPユーザーへのCTA */}
            {activeCategory === "vip" && !permissions.canUseVIPBBS && (
              <div className="mb-6 p-6 rounded-lg border-2 border-amber-300 bg-amber-50 text-center">
                <Crown className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2">VIP掲示板</h3>
                <p className="text-muted-foreground mb-4">
                  VIP会員限定の掲示板です。VIPにアップグレードして限定コミュニティに参加しましょう。
                </p>
                <Link href="/pricing">
                  <Button className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-white hover:from-amber-600 hover:to-yellow-500">
                    <Crown className="h-4 w-4" />
                    VIPにアップグレード
                  </Button>
                </Link>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Card key={i}><CardContent className="p-4"><div className="animate-pulse h-16 bg-muted rounded" /></CardContent></Card>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredThreads.map((thread) => (
                  <Link key={thread.id} href={`/bbs/${thread.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {thread.is_vip_only && (
                                <Badge className="gap-1 text-xs bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-0">
                                  <Crown className="h-3 w-3" />
                                  VIP
                                </Badge>
                              )}
                              {thread.is_pinned && (
                                <Badge variant="outline" className="gap-1 text-xs">
                                  <Pin className="h-3 w-3" />
                                  固定
                                </Badge>
                              )}
                              {thread.reply_count >= 10 && (
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
                              <span>{thread.profiles?.nickname || "名無しさん"}</span>
                              <span>{timeAgo(thread.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              <span>{thread.reply_count}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              <span>{thread.view_count}</span>
                            </div>
                            {thread.last_reply_at && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{timeAgo(thread.last_reply_at)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {!loading && filteredThreads.length === 0 && (
              <div className="text-center py-12">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">まだスレッドがありません</p>
                <p className="text-sm text-muted-foreground mb-4">最初のスレッドを作成しましょう</p>
                <Button onClick={() => setShowCreateModal(true)} disabled={!authUser}>新規スレッド作成</Button>
              </div>
            )}
          </div>

          <aside className="w-full lg:w-80 flex-shrink-0">
            {popularThreads.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    人気のスレッド
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {popularThreads.map((thread, index) => (
                    <Link key={thread.id} href={`/bbs/${thread.id}`} className="flex items-start gap-3 group">
                      <span className="text-lg font-bold text-muted-foreground w-6">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                          {thread.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{thread.reply_count}件のレス</p>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

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

      {/* 新規スレッド作成モーダル */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新規スレッド作成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>カテゴリ</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter((c) => c.id !== "all").map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>タイトル</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="スレッドのタイトルを入力"
                className="mt-1"
                maxLength={100}
              />
            </div>
            <div>
              <Label>本文</Label>
              <Textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="スレッドの内容を入力"
                rows={5}
                className="mt-1"
              />
            </div>
            {permissions.canUseVIPBBS && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsVipOnly}
                  onChange={(e) => setNewIsVipOnly(e.target.checked)}
                  className="rounded border-amber-400 text-amber-500 focus:ring-amber-500"
                />
                <Crown className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">VIP限定スレッド</span>
              </label>
            )}
            <Button
              className="w-full gap-2"
              onClick={handleCreateThread}
              disabled={creating || !newTitle.trim() || !newBody.trim()}
            >
              <Send className="h-4 w-4" />
              {creating ? "作成中..." : "スレッドを作成"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
