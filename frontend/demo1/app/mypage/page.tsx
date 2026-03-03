"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  MessageSquare,
  Settings,
  Bell,
  Crown,
  ChevronRight,
  Edit,
  Eye,
  Lock,
  Sparkles,
  LayoutDashboard,
  MessageCircle,
  Flame,
  Menu,
  X,
  Send,
  Plus,
  Share2,
  Search,
  ExternalLink,
  BarChart3,
  PenSquare,
  Monitor,
  Smartphone,
  Laptop,
  ThumbsUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { type EffectiveTier, getEffectiveTier, tierPermissions } from "@/lib/data";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { PreferenceMap } from "@/components/mypage/preference-map";
import { ReviewerLevelBadge } from "@/components/shared/reviewer-level-badge";

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


export default function MyPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [memberLevel, setMemberLevel] = useState<MemberLevel>("free");
  const [monthlyReviewCount, setMonthlyReviewCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>("1");
  const [messageInput, setMessageInput] = useState("");
  const [bbsTab, setBbsTab] = useState("general");


  // Settings state
  const [editNickname, setEditNickname] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Profile state
  const [profile, setProfile] = useState<{
    nickname: string;
    membership_type: string;
    monthly_review_count: number;
    total_review_count: number;
    view_permission_until: string | null;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Real data states
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [userReviews, setUserReviews] = useState<{
    id: string;
    therapist_name: string;
    shop_name: string;
    score: number;
    service_level_id: number | null;
    moderation_status: string;
    created_at: string;
  }[]>([]);
  const [skrReviews, setSkrReviews] = useState<{
    id: string;
    therapist_id: number;
    therapist_name: string;
    therapist_image: string | null;
    shop_name: string;
    service_level_id: number;
    score: number;
    comment: string;
    created_at: string;
  }[]>([]);
  const [preferenceData, setPreferenceData] = useState<{
    totalReviews: number;
    looksTypes: { id: string; count: number; percentage: number }[];
    bodyTypes: { id: string; count: number; percentage: number }[];
    serviceTypes: { id: string; count: number; percentage: number }[];
    avgParameters: { conversation: number; distance: number; technique: number; personality: number };
  } | null>(null);
  const [feedbackStats, setFeedbackStats] = useState({
    totalViews: 0, totalHelpful: 0, totalReal: 0, totalFake: 0, reviewCount: 0,
  });
  const [followingUsers, setFollowingUsers] = useState<{id: string; nickname: string; follower_count: number; total_review_count: number}[]>([]);

  // Fetch profile when auth user changes
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      const res = await fetch("/api/mypage");
      if (!res.ok) {
        setProfileLoading(false);
        return;
      }

      const data = await res.json();

      if (data.profile) {
        setProfile(data.profile);
        setMemberLevel((data.profile.membership_type || "free") as MemberLevel);
        setMonthlyReviewCount(data.profile.monthly_review_count || 0);
        setEditNickname(data.profile.nickname || "名無し");
      }
      setFavoriteCount(data.favoriteCount || 0);
      setUserReviews(data.userReviews || []);
      setSkrReviews(data.skrReviews || []);
      if (data.preferenceData) setPreferenceData(data.preferenceData);
      setFeedbackStats(data.feedbackStats || { totalViews: 0, totalHelpful: 0, totalReal: 0, totalFake: 0, reviewCount: 0 });

      // フォロー中ユーザー取得
      fetch("/api/user-follows?mode=following")
        .then(res => res.json())
        .then(fdata => setFollowingUsers(fdata.following || []))
        .catch(() => {});

      setProfileLoading(false);
    };

    fetchData();
  }, [authUser, authLoading]);

  // Loading state
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!authUser) return null; // redirect happening

  // getEffectiveTier でティアを計算
  const tierUser = {
    id: authUser.id,
    email: authUser.email || "",
    name: profile?.nickname || "名無し",
    memberType: memberLevel,
    monthlyReviewCount: monthlyReviewCount,
    totalReviewCount: profile?.total_review_count || 0,
    registeredAt: authUser.created_at || "",
    favorites: [],
  };
  const effectiveTier = getEffectiveTier(tierUser);
  const permissions = tierPermissions[effectiveTier];

  const memberSinceDate = authUser.created_at
    ? new Date(authUser.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long" })
    : "";

  const user = {
    nickname: profile?.nickname || "名無し",
    email: authUser.email || "",
    memberSince: memberSinceDate,
    reviewCount: profile?.total_review_count || 0,
    favoriteCount,
  };

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
                    <ReviewerLevelBadge level={profile?.total_review_count || 0} size="md" />
                    <p className="text-xs text-muted-foreground mt-1">{user.memberSince}から利用中</p>
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

            {/* 反響ダッシュボード */}
            {feedbackStats.reviewCount > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Eye className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{feedbackStats.totalViews.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">総閲覧数</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Heart className="h-5 w-5 mx-auto mb-1 text-pink-500" />
                    <p className="text-2xl font-bold">{feedbackStats.totalHelpful.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">参考になった</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <ThumbsUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <p className="text-2xl font-bold">
                      {feedbackStats.totalReal + feedbackStats.totalFake > 0
                        ? Math.round((feedbackStats.totalReal / (feedbackStats.totalReal + feedbackStats.totalFake)) * 100)
                        : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">REAL率</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 投稿数プログレスバー（Standard会員のみ） */}
            <ReviewProgressBar />

            {/* 嗜好マップ */}
            {preferenceData && <PreferenceMap data={preferenceData} />}

            {/* フォロー中ユーザー */}
            {followingUsers.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    フォロー中のレビュアー
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {followingUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm">
                        <span>{u.nickname || "匿名"}</span>
                        <ReviewerLevelBadge level={u.total_review_count} size="sm" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
              {userReviews.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">まだ口コミを投稿していません</p>
                  <p className="text-sm text-muted-foreground mb-4">口コミを投稿すると機能が解放されます</p>
                  <Link href="/review">
                    <Button>口コミを投稿する</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {userReviews.map((review) => (
                    <div key={review.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{review.therapist_name}</p>
                        <p className="text-sm text-muted-foreground truncate">{review.shop_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(review.created_at).toLocaleDateString("ja-JP")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge variant="secondary">{review.score}点</Badge>
                        <Badge
                          variant="outline"
                          className={
                            review.moderation_status === "approved"
                              ? "text-green-600 border-green-300"
                              : review.moderation_status === "rejected"
                              ? "text-destructive border-destructive"
                              : "text-amber-600 border-amber-300"
                          }
                        >
                          {review.moderation_status === "approved"
                            ? "承認済み"
                            : review.moderation_status === "rejected"
                            ? "却下"
                            : "審査中"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "favorites":
        return <FavoritesSection favoriteLimit={permissions.favoriteLimit} />;

      case "lists":
        if (!permissions.canUseDM) {
          return <LockScreen title="リスト共有機能" description="他のユーザーのお気に入りリストを閲覧したり、自分のリストを公開できます。スタンダード会員（月2本投稿）以上で利用可能です。" upgradeText="スタンダード会員になる" targetLevel="standard" />;
        }
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">リスト共有</CardTitle>
            </CardHeader>
            <CardContent className="text-center py-12">
              <Share2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">リスト共有機能は準備中です</p>
              <p className="text-sm text-muted-foreground">お気に入りリストの公開・共有機能を近日中にリリースします</p>
            </CardContent>
          </Card>
        );

      case "messages":
        if (!permissions.canUseDM) {
          return <LockScreen title="メッセージ機能" description="他のユーザーとDMでコミュニケーションができます。スタンダード会員（月2本投稿）以上で利用可能です。" upgradeText="スタンダード会員になる" targetLevel="standard" />;
        }
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">メッセージ</CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">メッセージページで会話を管理できます</p>
              <Link href="/messages">
                <Button className="gap-2">
                  <MessageCircle className="h-4 w-4" />
                  メッセージを開く
                </Button>
              </Link>
            </CardContent>
          </Card>
        );

      case "bbs":
        if (!permissions.canUseBBS) {
          return <LockScreen title="掲示板機能" description="他のユーザーと情報交換ができる掲示板を利用できます。スタンダード会員（月2本投稿）以上で利用可能です。" upgradeText="スタンダード会員になる" targetLevel="standard" />;
        }
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">掲示板</CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">掲示板でメンズエステについて語り合おう</p>
              <Link href="/bbs">
                <Button className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  掲示板を開く
                </Button>
              </Link>
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
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-4 p-4 border rounded-lg">
                        <div className="w-16 h-16 rounded-lg bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-24" />
                          <div className="h-3 bg-muted rounded w-32" />
                          <div className="h-3 bg-muted rounded w-full" />
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
              </div>
            </CardHeader>
            <CardContent>
              {skrReviews.length === 0 ? (
                <div className="text-center py-8">
                  <Flame className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">SKR/HRの口コミはまだありません</p>
                  <p className="text-sm text-muted-foreground mt-2">口コミが承認されると表示されます</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {skrReviews.map((review) => (
                    <div key={review.id} className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {review.therapist_image ? (
                          <img src={review.therapist_image} alt={review.therapist_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                            {review.therapist_name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/therapist/${review.therapist_id}`} className="font-medium hover:text-primary">
                            {review.therapist_name}
                          </Link>
                          <Badge className={String(review.service_level_id) === "3" ? "bg-gradient-to-r from-purple-500 to-purple-400" : "bg-gradient-to-r from-orange-500 to-orange-400"}>
                            {String(review.service_level_id) === "3" ? "HR" : "SKR"}
                          </Badge>
                          <Badge className="bg-primary text-primary-foreground">{review.score}点</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {review.shop_name} / {new Date(review.created_at).toLocaleDateString("ja-JP")}
                        </p>
                        {review.comment && (
                          <p className="text-sm mt-2 line-clamp-2">{review.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "notifications":
        return <NotificationsSection />;

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
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">{editNickname.charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <Label>ユーザー名</Label>
                  <Input
                    value={editNickname}
                    onChange={(e) => { setEditNickname(e.target.value); setProfileSaved(false); }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>メールアドレス</Label>
                  <Input value={user.email} disabled className="mt-1 bg-muted" />
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    disabled={savingProfile || editNickname === profile?.nickname}
                    onClick={async () => {
                      if (!authUser || !editNickname.trim()) return;
                      setSavingProfile(true);
                      const supabase = createSupabaseBrowser();
                      const { error } = await supabase
                        .from("profiles")
                        .update({ nickname: editNickname.trim() })
                        .eq("id", authUser.id);
                      setSavingProfile(false);
                      if (!error) {
                        setProfile(prev => prev ? { ...prev, nickname: editNickname.trim() } : prev);
                        setProfileSaved(true);
                      }
                    }}
                  >
                    {savingProfile ? "保存中..." : "保存"}
                  </Button>
                  {profileSaved && <span className="text-sm text-green-600">保存しました</span>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">パスワード変更</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>新しいパスワード</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); setPasswordSaved(false); }}
                    className="mt-1"
                    placeholder="8文字以上"
                  />
                </div>
                <div>
                  <Label>新しいパスワード（確認）</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(""); setPasswordSaved(false); }}
                    className="mt-1"
                  />
                </div>
                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                <div className="flex items-center gap-3">
                  <Button
                    disabled={savingPassword || !newPassword || !confirmPassword}
                    onClick={async () => {
                      if (newPassword.length < 8) {
                        setPasswordError("パスワードは8文字以上にしてください");
                        return;
                      }
                      if (newPassword !== confirmPassword) {
                        setPasswordError("パスワードが一致しません");
                        return;
                      }
                      setSavingPassword(true);
                      const supabase = createSupabaseBrowser();
                      const { error } = await supabase.auth.updateUser({ password: newPassword });
                      setSavingPassword(false);
                      if (error) {
                        setPasswordError(error.message);
                      } else {
                        setNewPassword("");
                        setConfirmPassword("");
                        setPasswordSaved(true);
                      }
                    }}
                  >
                    {savingPassword ? "変更中..." : "パスワードを変更"}
                  </Button>
                  {passwordSaved && <span className="text-sm text-green-600">変更しました</span>}
                </div>
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
              <CardContent>
                <div className="text-center py-6">
                  <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">通知設定は現在準備中です</p>
                </div>
              </CardContent>
            </Card>

            <DeviceManagementSection />

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-lg text-destructive">退会</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">退会すると全てのデータが削除され、復元できません。</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">退会する</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>本当に退会しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        退会すると、投稿した口コミ・お気に入り・メッセージなど全てのデータが完全に削除されます。この操作は取り消せません。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={async () => {
                          const res = await fetch("/api/account", { method: "DELETE" });
                          if (res.ok) {
                            const supabase = createSupabaseBrowser();
                            await supabase.auth.signOut();
                            router.push("/");
                          } else {
                            alert("退会処理に失敗しました。サポートにお問い合わせください。");
                          }
                        }}
                      >
                        退会する
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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

// お気に入りセクション（API連動）
function FavoritesSection({ favoriteLimit }: { favoriteLimit: number }) {
  const [favorites, setFavorites] = useState<{ id: number; name: string; age: number | null; image_url: string | null; shop_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/favorites")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setFavorites(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const removeFavorite = async (therapistId: number) => {
    await fetch("/api/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ therapist_id: therapistId }),
    });
    setFavorites((prev) => prev.filter((f) => f.id !== therapistId));
  };

  if (loading) {
    return <Card><CardContent className="p-6"><div className="animate-pulse h-32 bg-muted rounded" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">お気に入りセラピスト</CardTitle>
        <Badge variant="outline">{favorites.length} / {favoriteLimit === 999 ? "無制限" : favoriteLimit}</Badge>
      </CardHeader>
      <CardContent>
        {favorites.length === 0 ? (
          <div className="text-center py-8">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">まだお気に入りがありません</p>
            <p className="text-sm text-muted-foreground mb-4">セラピスト詳細ページからお気に入り登録できます</p>
            <Link href="/search">
              <Button>セラピストを探す</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {favorites.map((fav) => (
              <div key={fav.id} className="flex items-center gap-4 p-3 border rounded-lg">
                <Link href={`/therapist/${fav.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {fav.image_url ? (
                      <img src={fav.image_url} alt={fav.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">{fav.name[0]}</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{fav.name}{fav.age ? ` (${fav.age})` : ""}</p>
                    <p className="text-sm text-muted-foreground truncate">{fav.shop_name}</p>
                  </div>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => removeFavorite(fav.id)} className="text-muted-foreground hover:text-destructive">
                  <Heart className="h-4 w-4 fill-current text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 通知セクション（API連動）
function NotificationsSection() {
  const [notifications, setNotifications] = useState<{ id: number; type: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setNotifications(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  if (loading) {
    return <Card><CardContent className="p-6"><div className="animate-pulse h-32 bg-muted rounded" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">通知</CardTitle>
        {notifications.some((n) => !n.is_read) && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
            すべて既読にする
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">通知はありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className={`p-4 border rounded-lg ${!n.is_read ? "bg-primary/5 border-primary/20" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${!n.is_read ? "bg-primary" : "bg-transparent"}`} />
                  <div className="flex-1">
                    {n.link ? (
                      <Link href={n.link} className="hover:underline">
                        <h4 className="font-medium">{n.title}</h4>
                      </Link>
                    ) : (
                      <h4 className="font-medium">{n.title}</h4>
                    )}
                    {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeviceManagementSection() {
  const [sessions, setSessions] = useState<{ id: string; device_label: string | null; ip_address: string | null; last_active_at: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSessions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const removeSession = async (id: string) => {
    setRemoving(id);
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setRemoving(null);
  };

  if (loading) {
    return <Card><CardContent className="p-6"><div className="animate-pulse h-24 bg-muted rounded" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">ログイン中のデバイス</CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">アクティブなセッションはありません</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const label = s.device_label || "不明なデバイス";
              const isMobile = label.includes("iPhone") || label.includes("Android") || label.includes("iPad");
              const Icon = isMobile ? Smartphone : label.includes("macOS") || label.includes("Windows") ? Laptop : Monitor;
              const lastActive = new Date(s.last_active_at);
              const diffMs = Date.now() - lastActive.getTime();
              const diffMin = Math.floor(diffMs / 60000);
              const timeAgo = diffMin < 1 ? "たった今" : diffMin < 60 ? `${diffMin}分前` : diffMin < 1440 ? `${Math.floor(diffMin / 60)}時間前` : `${Math.floor(diffMin / 1440)}日前`;

              return (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground">最終利用: {timeAgo}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSession(s.id)}
                    disabled={removing === s.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {removing === s.id ? "切断中..." : "切断"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          最大2台のデバイスでログインできます。
        </p>
      </CardContent>
    </Card>
  );
}
