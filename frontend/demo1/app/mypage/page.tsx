"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Heart,
  MessageSquare,
  Settings,
  Bell,
  Crown,
  ChevronRight,
  Star,
  Edit,
  Eye,
  Lock,
  Sparkles,
  LayoutDashboard,
  Users,
  MessageCircle,
  Flame,
  Menu,
  X,
  Send,
  Plus,
  Share2,
  Globe,
  Trash2,
  UserPlus,
  Search,
  Filter,
  ExternalLink,
  BarChart3,
  PenSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { therapists, reviews, type EffectiveTier, getEffectiveTier, tierPermissions } from "@/lib/data";

type MemberLevel = "free" | "standard" | "vip";
type Section = "dashboard" | "reviews" | "favorites" | "lists" | "messages" | "bbs" | "skr" | "notifications" | "settings";

const sidebarItems = [
  { id: "dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { id: "search", label: "セラピスト検索", icon: Search, isLink: true, href: "/search" },
  { id: "reviews", label: "投稿した口コミ", icon: Edit },
  { id: "favorites", label: "お気に入り", icon: Heart },
  { id: "lists", label: "リスト共有", icon: Share2 },
  { id: "messages", label: "メッセージ", icon: MessageCircle },
  { id: "bbs", label: "掲示板", icon: MessageSquare },
  { id: "skr", label: "SKR/HRリスト", icon: Flame },
  { id: "notifications", label: "通知", icon: Bell },
  { id: "settings", label: "設定", icon: Settings },
] as const;

// Mock data
const mockConversations = [
  { id: "1", name: "田中さん", lastMessage: "了解です！ありがとうございます", time: "10:30", unread: 2, avatar: "T" },
  { id: "2", name: "佐藤さん", lastMessage: "その店舗良かったですよ", time: "昨日", unread: 0, avatar: "S" },
  { id: "3", name: "山田さん", lastMessage: "今度行ってみます", time: "3日前", unread: 0, avatar: "Y" },
];

const mockPublicLists = [
  { id: "1", userName: "メンエスマスター", avatar: "M", listName: "渋谷ギャル系TOP10", count: 10, followers: 234 },
  { id: "2", userName: "癒し探求者", avatar: "Y", listName: "清楚系おすすめ", count: 8, followers: 156 },
  { id: "3", userName: "週末リピーター", avatar: "S", listName: "コスパ最強リスト", count: 15, followers: 89 },
];

const mockBBSThreads = [
  { id: "1", title: "初心者におすすめの店舗教えてください", author: "新規さん", comments: 24, lastUpdate: "1時間前", category: "質問" },
  { id: "2", title: "渋谷エリアの最新情報", author: "渋谷マスター", comments: 56, lastUpdate: "3時間前", category: "エリア" },
  { id: "3", title: "最近のトレンドについて", author: "情報通", comments: 18, lastUpdate: "昨日", category: "雑談" },
];

const mockSKRReviews = [
  { id: "1", therapistName: "あいか", shopName: "アロマモア", level: "skr", rating: 92, comment: "サービスが素晴らしかった...", date: "2024-01-15", image: therapists[0]?.images[0] },
  { id: "2", therapistName: "みく", shopName: "Premium Salon", level: "hr", rating: 95, comment: "期待以上の対応で...", date: "2024-01-14", image: therapists[1]?.images[0] },
  { id: "3", therapistName: "りの", shopName: "Healing Room", level: "skr", rating: 88, comment: "リピート確定です...", date: "2024-01-13", image: therapists[2]?.images[0] },
];

export default function MyPage() {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [memberLevel, setMemberLevel] = useState<MemberLevel>("standard");
  const [monthlyReviewCount, setMonthlyReviewCount] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>("1");
  const [messageInput, setMessageInput] = useState("");
  const [bbsTab, setBbsTab] = useState("general");
  const [listPublic, setListPublic] = useState(false);

  // getEffectiveTier でティアを計算
  const mockUser = {
    id: "user1",
    email: "test@example.com",
    name: "テストユーザー",
    memberType: memberLevel,
    monthlyReviewCount: monthlyReviewCount,
    totalReviewCount: 12,
    registeredAt: "2024-01-01",
    favorites: [],
  };
  const effectiveTier = getEffectiveTier(mockUser);
  const permissions = tierPermissions[effectiveTier];

  const user = {
    nickname: "テストユーザー",
    email: "test@example.com",
    memberSince: "2024年1月",
    reviewCount: 12,
    favoriteCount: 5,
  };

  const userReviews = reviews.slice(0, 3);
  const favoriteTherapists = therapists.slice(0, 5);

  // Lock screen component
  const LockScreen = ({ title, description, upgradeText, targetLevel }: { title: string; description: string; upgradeText: string; targetLevel: "standard" | "vip" }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${targetLevel === "vip" ? "bg-amber-100" : "bg-primary/10"}`}>
        <Lock className={`h-10 w-10 ${targetLevel === "vip" ? "text-amber-500" : "text-primary"}`} />
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-md">{description}</p>
      <Link href="/pricing">
        <Button className={targetLevel === "vip" ? "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500" : ""}>
          {upgradeText}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </Link>
    </div>
  );

  // 投稿数プログレスバー（Standard会員用）
  const ReviewProgressBar = () => {
    if (memberLevel !== "standard") return null;
    const remaining = Math.max(0, 3 - monthlyReviewCount);
    const progressPercent = Math.min(100, (monthlyReviewCount / 3) * 100);

    const currentUnlock = monthlyReviewCount >= 3
      ? "VIP相当の全機能"
      : monthlyReviewCount >= 2
      ? "セラピスト分析 + 掲示板"
      : monthlyReviewCount >= 1
      ? "発見検索"
      : "口コミ読み放題";

    const nextUnlock = monthlyReviewCount >= 3
      ? null
      : monthlyReviewCount >= 2
      ? "VIP相当の全機能"
      : monthlyReviewCount >= 1
      ? "セラピスト分析 + 掲示板"
      : "発見検索";

    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PenSquare className="h-5 w-5 text-primary" />
              <h3 className="font-bold">今月の投稿数</h3>
            </div>
            <span className="text-2xl font-bold text-primary">{monthlyReviewCount}/3</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 mb-3">
            <div
              className="bg-primary h-3 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              現在: <span className="font-medium text-foreground">{currentUnlock}</span>
            </span>
            {nextUnlock && remaining > 0 && (
              <span className="text-primary font-medium">
                あと{remaining}本 → {nextUnlock}
              </span>
            )}
            {monthlyReviewCount >= 3 && (
              <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 border-0 text-white">
                全機能解放中
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <div className="space-y-6">
            {/* User Profile Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {user.nickname.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-2xl font-bold">{user.nickname}</h1>
                      <Badge className={permissions.color}>{permissions.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.memberSince}から利用中</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{user.reviewCount}</p>
                    <p className="text-sm text-muted-foreground">累計投稿</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{user.favoriteCount}</p>
                    <p className="text-sm text-muted-foreground">お気に入り</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">
                      {permissions.canViewReviewBody ? "無制限" : "投稿で解放"}
                    </p>
                    <p className="text-sm text-muted-foreground">口コミ閲覧</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 投稿数プログレスバー（Standard会員のみ） */}
            <ReviewProgressBar />

            {/* Member Benefits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  現在の特典
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg border ${permissions.canViewReviewBody ? "bg-primary/5 border-primary/20" : "bg-muted/50"}`}>
                    <div className="flex items-center gap-3">
                      {permissions.canViewReviewBody ? <Eye className="h-5 w-5 text-primary" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
                      <div>
                        <p className="font-medium">口コミ閲覧</p>
                        <p className="text-sm text-muted-foreground">{permissions.canViewReviewBody ? "全文閲覧可能" : "投稿で3日間解放"}</p>
                      </div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg border ${permissions.canUseDiscoverySearch ? "bg-primary/5 border-primary/20" : "bg-muted/50"}`}>
                    <div className="flex items-center gap-3">
                      {permissions.canUseDiscoverySearch ? <Search className="h-5 w-5 text-primary" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
                      <div>
                        <p className="font-medium">発見検索</p>
                        <p className="text-sm text-muted-foreground">{permissions.canUseDiscoverySearch ? "タイプxエリアxスコアで検索" : memberLevel === "standard" ? "月1本投稿で解放" : "Standard以上"}</p>
                      </div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg border ${permissions.canUseTherapistAnalysis ? "bg-primary/5 border-primary/20" : "bg-muted/50"}`}>
                    <div className="flex items-center gap-3">
                      {permissions.canUseTherapistAnalysis ? <BarChart3 className="h-5 w-5 text-primary" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
                      <div>
                        <p className="font-medium">セラピスト分析</p>
                        <p className="text-sm text-muted-foreground">{permissions.canUseTherapistAnalysis ? "レーダーチャート等" : memberLevel === "standard" ? "月2本投稿で解放" : "Standard以上"}</p>
                      </div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg border ${permissions.canUseSKRFilter ? "bg-amber-50 border-amber-200" : "bg-muted/50"}`}>
                    <div className="flex items-center gap-3">
                      {permissions.canUseSKRFilter ? <Crown className="h-5 w-5 text-amber-500" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
                      <div>
                        <p className="font-medium">SKR/HRフィルター</p>
                        <p className="text-sm text-muted-foreground">{permissions.canUseSKRFilter ? "サービスレベルで絞り込み可能" : memberLevel === "standard" ? "月3本投稿で解放" : "Standard(3本) or VIP"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upgrade CTA */}
            {memberLevel !== "vip" && (
              <Card className={`border-primary/20 ${memberLevel === "free" ? "bg-gradient-to-r from-primary/10 to-primary/5" : "bg-gradient-to-r from-amber-500/10 to-amber-400/5"}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${memberLevel === "free" ? "bg-primary/20" : "bg-amber-500/20"}`}>
                        <Crown className={`h-6 w-6 ${memberLevel === "free" ? "text-primary" : "text-amber-500"}`} />
                      </div>
                      <div>
                        <h3 className="font-bold">{memberLevel === "free" ? "スタンダード会員になる" : "VIP会員にアップグレード"}</h3>
                        <p className="text-sm text-muted-foreground">{memberLevel === "free" ? "月額¥4,980で口コミ読み放題 + 投稿で機能解放" : "月額¥14,980で投稿不要の全機能使い放題"}</p>
                      </div>
                    </div>
                    <Link href="/pricing">
                      <Button className={memberLevel === "standard" ? "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500" : ""}>
                        詳細を見る
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "reviews":
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">投稿した口コミ</CardTitle>
              <Badge variant="outline">{userReviews.length}件</Badge>
            </CardHeader>
            <CardContent>
              {userReviews.length > 0 ? (
                <div className="space-y-4">
                  {userReviews.map((review) => (
                    <div key={review.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Link href={`/therapist/${review.therapistId}`} className="font-medium hover:text-primary">
                              {review.therapistName}
                            </Link>
                            <Badge className="bg-primary text-primary-foreground">{review.score}点</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{review.shopName} / {review.createdAt}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {review.tags?.map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                          <div className="mt-3 space-y-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">第一印象: </span>
                              {review.q1FirstImpression}
                            </div>
                            <div>
                              <span className="text-muted-foreground">施術・接客: </span>
                              {review.q2Service}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">まだ口コミを投稿していません</p>
                  <Button>口コミを投稿する</Button>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "favorites":
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">お気に入りセラピスト</CardTitle>
              <Badge variant="outline">{favoriteTherapists.length} / {permissions.favoriteLimit === 999 ? "無制限" : permissions.favoriteLimit}</Badge>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                {favoriteTherapists.map((therapist) => (
                  <div key={therapist.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      <img src={therapist.images[0] || "/placeholder.svg"} alt={therapist.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/therapist/${therapist.id}`} className="font-medium hover:text-primary">{therapist.name}</Link>
                      <p className="text-sm text-muted-foreground truncate">{therapist.shopName}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        <span className="text-xs font-medium">{therapist.rating}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-primary flex-shrink-0">
                      <Heart className="h-5 w-5 fill-current" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case "lists":
        if (!permissions.canUseDM) {
          return <LockScreen title="リスト共有機能" description="他のユーザーのお気に入りリストを閲覧したり、自分のリストを公開できます。スタンダード会員（月2本投稿）以上で利用可能です。" upgradeText="スタンダード会員になる" targetLevel="standard" />;
        }
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">自分のリスト設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">公開ステータス</p>
                    <p className="text-sm text-muted-foreground">他のユーザーがあなたのリストを閲覧できます</p>
                  </div>
                  <Switch checked={listPublic} onCheckedChange={setListPublic} />
                </div>
                {listPublic && (
                  <>
                    <div>
                      <Label>リスト名</Label>
                      <Input placeholder="例: 渋谷ギャル系おすすめ" className="mt-1" />
                    </div>
                    <Button variant="outline" className="gap-2 bg-transparent">
                      <Share2 className="h-4 w-4" />
                      共有URLをコピー
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">公開リスト一覧</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="リストを検索" className="pl-9 w-48" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockPublicLists.map((list) => (
                    <div key={list.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-primary">{list.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{list.listName}</p>
                        <p className="text-sm text-muted-foreground">{list.userName} / {list.count}人のセラピスト</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{list.followers} フォロワー</p>
                        <div className="flex gap-2 mt-1">
                          <Button size="sm" variant="outline" className="bg-transparent"><UserPlus className="h-4 w-4" /></Button>
                          <Button size="sm"><ExternalLink className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "messages":
        if (!permissions.canUseDM) {
          return <LockScreen title="メッセージ機能" description="他のユーザーとDMやグループチャットでコミュニケーションができます。スタンダード会員（月2本投稿）以上で利用可能です。" upgradeText="スタンダード会員になる" targetLevel="standard" />;
        }
        return (
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="border-b">
              <Tabs defaultValue="dm" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="dm">DM</TabsTrigger>
                  <TabsTrigger value="groups">グループ</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/3 border-r overflow-y-auto">
                {mockConversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv.id)}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b ${selectedConversation === conv.id ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">{conv.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{conv.name}</p>
                          <span className="text-xs text-muted-foreground">{conv.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                      </div>
                      {conv.unread > 0 && (
                        <Badge className="bg-primary text-primary-foreground">{conv.unread}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex-1 flex flex-col">
                {selectedConversation ? (
                  <>
                    <div className="p-4 border-b">
                      <h4 className="font-medium">{mockConversations.find(c => c.id === selectedConversation)?.name}</h4>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      <div className="flex justify-start">
                        <div className="max-w-[70%] p-3 rounded-lg bg-muted">
                          <p className="text-sm">こんにちは！渋谷でおすすめの店舗ありますか？</p>
                          <p className="text-xs text-muted-foreground mt-1">10:25</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-[70%] p-3 rounded-lg bg-primary text-primary-foreground">
                          <p className="text-sm">アロマモアがおすすめですよ！</p>
                          <p className="text-xs text-primary-foreground/70 mt-1">10:28</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="max-w-[70%] p-3 rounded-lg bg-muted">
                          <p className="text-sm">了解です！ありがとうございます</p>
                          <p className="text-xs text-muted-foreground mt-1">10:30</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 border-t">
                      <div className="flex gap-2">
                        <Input
                          placeholder="メッセージを入力..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          className="flex-1"
                        />
                        <Button size="icon"><Send className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    会話を選択してください
                  </div>
                )}
              </div>
            </div>
          </Card>
        );

      case "bbs":
        if (!permissions.canUseBBS) {
          return <LockScreen title="掲示板機能" description="他のユーザーと情報交換ができる掲示板を利用できます。スタンダード会員（月2本投稿）以上で利用可能です。" upgradeText="スタンダード会員になる" targetLevel="standard" />;
        }
        return (
          <Card>
            <CardHeader>
              <Tabs value={bbsTab} onValueChange={setBbsTab}>
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="general">一般</TabsTrigger>
                    <TabsTrigger value="vip" className="gap-1">
                      <Crown className="h-4 w-4" />
                      VIP限定
                    </TabsTrigger>
                  </TabsList>
                  <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" />
                    新規スレッド
                  </Button>
                </div>
              </Tabs>
            </CardHeader>
            <CardContent>
              {bbsTab === "vip" && !permissions.canUseVIPBBS ? (
                <LockScreen title="VIP限定掲示板" description="VIP会員専用の掲示板です。より深い情報交換ができます。スタンダード会員は月3本投稿、またはVIP会員で利用可能です。" upgradeText="VIP会員になる" targetLevel="vip" />
              ) : (
                <>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <Button variant="outline" size="sm" className="bg-transparent">全て</Button>
                    <Button variant="outline" size="sm" className="bg-transparent">雑談</Button>
                    <Button variant="outline" size="sm" className="bg-transparent">情報交換</Button>
                    <Button variant="outline" size="sm" className="bg-transparent">質問</Button>
                    <Button variant="outline" size="sm" className="bg-transparent">エリア別</Button>
                  </div>
                  <div className="space-y-3">
                    {mockBBSThreads.map((thread) => (
                      <Link key={thread.id} href={`/bbs/${thread.id}`} className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">{thread.category}</Badge>
                              <h4 className="font-medium">{thread.title}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">{thread.author} / {thread.lastUpdate}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{thread.comments}</p>
                            <p className="text-xs text-muted-foreground">コメント</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );

      case "skr":
        if (!permissions.canUseSKRFilter) {
          return (
            <Card>
              <CardContent className="p-0">
                <div className="relative">
                  <div className="blur-sm pointer-events-none p-6 space-y-4">
                    {mockSKRReviews.map((review) => (
                      <div key={review.id} className="flex gap-4 p-4 border rounded-lg">
                        <div className="w-16 h-16 rounded-lg bg-muted" />
                        <div className="flex-1">
                          <p className="font-medium">{review.therapistName}</p>
                          <p className="text-sm text-muted-foreground">{review.shopName}</p>
                          <p className="text-sm mt-2">{review.comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
                        <Flame className="h-10 w-10 text-amber-500" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">SKR/HRリスト</h3>
                      <p className="text-muted-foreground mb-6 max-w-md">
                        {memberLevel === "standard"
                          ? "月3本投稿でVIP相当の機能が解放されます。またはVIP会員で即利用可能です。"
                          : "VIP会員限定のサービスレベル別口コミリストです。"}
                      </p>
                      <Link href="/pricing">
                        <Button className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500">
                          {memberLevel === "standard" ? "VIPにアップグレード" : "VIP会員になる"}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Flame className="h-5 w-5 text-amber-500" />
                  SKR/HRリスト
                </CardTitle>
                <div className="flex gap-2">
                  <Select defaultValue="all">
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="レベル" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全て</SelectItem>
                      <SelectItem value="skr">SKR</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="エリア" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全エリア</SelectItem>
                      <SelectItem value="tokyo">東京</SelectItem>
                      <SelectItem value="osaka">大阪</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockSKRReviews.map((review) => (
                  <div key={review.id} className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      <img src={review.image || "/placeholder.svg"} alt={review.therapistName} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link href="#" className="font-medium hover:text-primary">{review.therapistName}</Link>
                        <Badge className={review.level === "hr" ? "bg-gradient-to-r from-purple-500 to-purple-400" : "bg-gradient-to-r from-orange-500 to-orange-400"}>
                          {review.level === "hr" ? "HR" : "SKR"}
                        </Badge>
                        <Badge className="bg-primary text-primary-foreground">{review.rating}点</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.shopName} / {review.date}</p>
                      <p className="text-sm mt-2">{review.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case "notifications":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">通知</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { title: "新着口コミがあります", description: "お気に入りのセラピストに新しい口コミが投稿されました", time: "1時間前", read: false },
                  { title: "DMが届きました", description: "田中さんからメッセージが届いています", time: "3時間前", read: false },
                  { title: "口コミが承認されました", description: "投稿した口コミが承認され、公開されました", time: "1日前", read: true },
                  { title: "フォロー中のリストが更新", description: "「渋谷ギャル系TOP10」に新しいセラピストが追加されました", time: "2日前", read: true },
                  { title: "今月の投稿数リセット", description: "毎月1日に投稿数がリセットされました", time: "3日前", read: true },
                ].map((notification, index) => (
                  <div key={index} className={`p-4 border rounded-lg ${!notification.read ? "bg-primary/5 border-primary/20" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${!notification.read ? "bg-primary" : "bg-transparent"}`} />
                      <div className="flex-1">
                        <h4 className="font-medium">{notification.title}</h4>
                        <p className="text-sm text-muted-foreground">{notification.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case "settings":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">プロフィール編集</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">{user.nickname.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <Button variant="outline" className="bg-transparent">アバターを変更</Button>
                </div>
                <div>
                  <Label>ユーザー名</Label>
                  <Input defaultValue={user.nickname} className="mt-1" />
                </div>
                <div>
                  <Label>メールアドレス</Label>
                  <Input defaultValue={user.email} className="mt-1" />
                </div>
                <Button>保存</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">パスワード変更</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>現在のパスワード</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <div>
                  <Label>新しいパスワード</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <div>
                  <Label>新しいパスワード（確認）</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <Button>パスワードを変更</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">会員プラン</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">現在のプラン</p>
                    <Badge className={permissions.color}>{permissions.label}</Badge>
                  </div>
                  <Link href="/pricing">
                    <Button variant="outline" className="bg-transparent">プランを変更</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">通知設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "新着口コミ通知", description: "お気に入りセラピストに口コミが投稿された時" },
                  { label: "DM通知", description: "新しいメッセージを受信した時" },
                  { label: "運営からのお知らせ", description: "キャンペーンや重要なお知らせ" },
                ].map((setting, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{setting.label}</p>
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-lg text-destructive">退会</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">退会すると全てのデータが削除され、復元できません。</p>
                <Button variant="destructive">退会する</Button>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-6">
        {/* Debug: Member Level & Post Count Switcher */}
        <Card className="mb-6 border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-primary mb-1">デバッグ: 会員レベル切替</p>
                  <p className="text-xs text-muted-foreground">各会員レベルでの表示を確認できます</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={memberLevel === "free" ? "default" : "outline"} onClick={() => setMemberLevel("free")} className={memberLevel === "free" ? "" : "bg-transparent"}>無料</Button>
                  <Button size="sm" variant={memberLevel === "standard" ? "default" : "outline"} onClick={() => setMemberLevel("standard")} className={memberLevel === "standard" ? "" : "bg-transparent"}>スタンダード</Button>
                  <Button size="sm" variant={memberLevel === "vip" ? "default" : "outline"} onClick={() => setMemberLevel("vip")} className={memberLevel === "vip" ? "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500" : "bg-transparent"}>VIP</Button>
                </div>
              </div>
              {memberLevel === "standard" && (
                <div className="flex items-center gap-4 pt-2 border-t border-primary/20">
                  <p className="text-xs text-muted-foreground">今月の投稿数:</p>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map(n => (
                      <Button
                        key={n}
                        size="sm"
                        variant={monthlyReviewCount === n ? "default" : "outline"}
                        onClick={() => setMonthlyReviewCount(n)}
                        className={monthlyReviewCount === n ? "" : "bg-transparent"}
                      >
                        {n}本
                      </Button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    → 有効ティア: <Badge variant="outline" className="text-xs">{effectiveTier}</Badge>
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-6">
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <Card className="sticky top-6">
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {sidebarItems.map((item) => {
                    const Icon = item.icon;
                    const isLocked =
                      (item.id === "lists" && !permissions.canUseDM) ||
                      (item.id === "messages" && !permissions.canUseDM) ||
                      (item.id === "bbs" && !permissions.canUseBBS) ||
                      (item.id === "skr" && !permissions.canUseSKRFilter);

                    if ("isLink" in item && item.isLink) {
                      return (
                        <Link
                          key={item.id}
                          href={"href" in item ? item.href : "/"}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-muted"
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-sm font-medium">{item.label}</span>
                          <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                        </Link>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id as Section)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          activeSection === item.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="flex-1">{item.label}</span>
                        {isLocked && <Lock className="h-4 w-4 opacity-50" />}
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </aside>

          {/* Mobile Sidebar Toggle */}
          <div className="lg:hidden fixed bottom-4 right-4 z-50">
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-6 w-6" />
            </Button>
          </div>

          {/* Mobile Sidebar */}
          {sidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
              <div className="absolute right-0 top-0 bottom-0 w-72 bg-background p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">メニュー</h3>
                  <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <nav className="space-y-1">
                  {sidebarItems.map((item) => {
                    const Icon = item.icon;
                    const isLocked =
                      (item.id === "lists" && !permissions.canUseDM) ||
                      (item.id === "messages" && !permissions.canUseDM) ||
                      (item.id === "bbs" && !permissions.canUseBBS) ||
                      (item.id === "skr" && !permissions.canUseSKRFilter);

                    if ("isLink" in item && item.isLink) {
                      return (
                        <Link
                          key={item.id}
                          href={"href" in item ? item.href : "/"}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-muted"
                          onClick={() => setSidebarOpen(false)}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-sm font-medium">{item.label}</span>
                          <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                        </Link>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveSection(item.id as Section);
                          setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          activeSection === item.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="flex-1">{item.label}</span>
                        {isLocked && <Lock className="h-4 w-4 opacity-50" />}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {renderSection()}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
