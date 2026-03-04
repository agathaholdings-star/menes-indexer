"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Menu,
  User,
  LogIn,
  PenSquare,
  MapPin,
  Heart,
  Bell,
  Settings,
  LogOut,
  Crown,
  Star,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReviewWizardModal } from "@/components/review/review-wizard-modal";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { useTier } from "@/lib/hooks/use-tier";
import { ReviewerLevelBadge } from "@/components/shared/reviewer-level-badge";

export function SiteHeader() {
  const { user: authUser, loading: authLoading, signOut: authSignOut } = useAuth();
  const { effectiveTier, membershipType, monthlyReviewCount: tierMonthlyReviewCount, viewPermissionUntil, totalReviewCount } = useTier();
  const memberLevel = (membershipType || "free") as "free" | "standard" | "vip";
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const isLoggedIn = !!authUser;

  // 通知
  interface Notification {
    id: number;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    is_read: boolean;
    created_at: string;
  }
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!authUser) return;
    const supabase = createSupabaseBrowser();
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false })
      .limit(10);
    const items = (data || []) as Notification[];
    setNotifications(items);
    setUnreadCount(items.filter((n) => !n.is_read).length);
  }, [authUser]);

  // 初回取得 + 30秒ポーリング（タブ非表示時は停止）
  useEffect(() => {
    if (!authUser) return;
    fetchNotifications();

    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [authUser, fetchNotifications]);

  const markAllRead = async () => {
    if (!authUser || unreadCount === 0) return;
    const supabase = createSupabaseBrowser();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", authUser.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  const monthlyReviewCount = tierMonthlyReviewCount;

  const nickname = authUser?.user_metadata?.nickname || authUser?.email?.split("@")[0] || "ユーザー";

  // 無料閲覧残り日数を計算
  const computeRemainingDays = () => {
    if (!viewPermissionUntil) return 0;
    const diff = new Date(viewPermissionUntil).getTime() - Date.now();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  };

  const user = {
    name: nickname,
    avatar: null,
    remainingDays: computeRemainingDays(),
    unreadNotifications: unreadCount,
    monthlyReviewCount: monthlyReviewCount,
  };

  const getMemberBadge = () => {
    switch (memberLevel) {
      case "vip":
        return (
          <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-0 text-xs gap-1">
            <Crown className="h-3 w-3" />
            VIP
          </Badge>
        );
      case "standard":
        return (
          <Badge className="bg-primary text-primary-foreground text-xs gap-1">
            <Star className="h-3 w-3" />
            スタンダード
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="text-xs">無料会員</Badge>;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">SKR</span>
            </div>
            <span className="hidden text-lg font-bold sm:inline">メンエスSKR</span>
          </Link>

          {/* Search Bar - Desktop */}
          <form onSubmit={handleSearch} className="hidden max-w-md flex-1 md:flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="店舗名・セラピスト名で検索"
                className="w-full pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>

          {/* Navigation - Desktop */}
          <nav className="hidden items-center gap-1 lg:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/search">
                <Search className="mr-1 h-4 w-4" />
                セラピスト検索
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/area">
                <MapPin className="mr-1 h-4 w-4" />
                エリア検索
              </Link>
            </Button>
          </nav>

          {/* Auth & CTA */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="hidden sm:flex"
              onClick={() => setIsReviewModalOpen(true)}
            >
              <PenSquare className="mr-1 h-4 w-4" />
              口コミ投稿
            </Button>

            {isLoggedIn ? (
              /* Logged In State */
              <div className="flex items-center gap-2">
                {/* Notifications */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative hidden sm:flex">
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 p-0">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <p className="font-medium text-sm">通知</p>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                          すべて既読にする
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">通知はありません</div>
                      ) : (
                        notifications.map((n) => (
                          <Link
                            key={n.id}
                            href={n.link || "/mypage"}
                            className={`block px-4 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
                          >
                            <p className="text-sm font-medium">{n.title}</p>
                            {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(n.created_at).toLocaleDateString("ja-JP")}
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                    <Link
                      href="/notifications"
                      className="block text-center py-2 text-sm text-primary hover:underline border-t"
                    >
                      すべての通知を見る
                    </Link>
                  </PopoverContent>
                </Popover>

                {/* User Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 px-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {user.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {/* User Info Header */}
                    <div className="px-3 py-3 border-b">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{user.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {getMemberBadge()}
                            {totalReviewCount > 0 && (
                              <ReviewerLevelBadge level={totalReviewCount} size="sm" />
                            )}
                          </div>
                        </div>
                      </div>
                      {memberLevel === "free" && (
                        <div className="mt-3 p-2 rounded-md bg-muted text-sm">
                          <p className="text-muted-foreground">
                            {user.remainingDays > 0 ? (
                              <>無料閲覧残り: <span className="text-primary font-bold">{user.remainingDays}日</span></>
                            ) : (
                              <>口コミを投稿すると閲覧できます</>
                            )}
                          </p>
                        </div>
                      )}
                      {memberLevel === "standard" && (
                        <div className="mt-3 p-2 rounded-md bg-primary/10 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-muted-foreground text-xs">今月の投稿</p>
                            <span className="text-primary font-bold">{user.monthlyReviewCount}/3</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (user.monthlyReviewCount / 3) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <DropdownMenuItem asChild>
                      <Link href="/mypage" className="cursor-pointer">
                        <User className="h-4 w-4 mr-2" />
                        マイページ
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/mypage?tab=reviews" className="cursor-pointer">
                        <PenSquare className="h-4 w-4 mr-2" />
                        投稿した口コミ
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/mypage?tab=favorites" className="cursor-pointer">
                        <Heart className="h-4 w-4 mr-2" />
                        お気に入り
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />

                    {memberLevel !== "vip" && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/pricing" className="cursor-pointer text-primary font-medium">
                            <Crown className="h-4 w-4 mr-2" />
                            {memberLevel === "free" ? "有料会員になる" : "VIPにアップグレード"}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}

                    <DropdownMenuItem asChild>
                      <Link href="/mypage?tab=settings" className="cursor-pointer">
                        <Settings className="h-4 w-4 mr-2" />
                        設定
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive focus:text-destructive"
                      onClick={() => authSignOut()}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      ログアウト
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              /* Logged Out State */
              <div className="hidden items-center gap-2 sm:flex">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">
                    <LogIn className="mr-1 h-4 w-4" />
                    ログイン
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/register">新規登録</Link>
                </Button>
              </div>
            )}

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">メニューを開く</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex flex-col gap-4 pt-4">
                  {/* Mobile User Info */}
                  {isLoggedIn && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          {getMemberBadge()}
                        </div>
                      </div>
                      {memberLevel === "free" && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {user.remainingDays > 0 ? (
                            <>無料閲覧残り: <span className="text-primary font-bold">{user.remainingDays}日</span></>
                          ) : (
                            <>口コミを投稿すると閲覧できます</>
                          )}
                        </p>
                      )}
                      {memberLevel === "standard" && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">今月の投稿</span>
                            <span className="text-primary font-bold">{user.monthlyReviewCount}/3</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (user.monthlyReviewCount / 3) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mobile Search */}
                  <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="店舗名・セラピスト名で検索"
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </form>

                  {/* Mobile Navigation */}
                  <nav className="flex flex-col gap-1">
                    <Button variant="ghost" className="justify-start" asChild>
                      <Link href="/search">
                        <Search className="mr-2 h-4 w-4" />
                        セラピスト検索
                      </Link>
                    </Button>
                    <Button variant="ghost" className="justify-start" asChild>
                      <Link href="/area">
                        <MapPin className="mr-2 h-4 w-4" />
                        エリア検索
                      </Link>
                    </Button>
                  </nav>

                  {isLoggedIn && (
                    <>
                      <div className="border-t pt-4">
                        <p className="text-xs text-muted-foreground mb-2 px-1">マイページ</p>
                        <nav className="flex flex-col gap-1">
                          <Button variant="ghost" className="justify-start" asChild>
                            <Link href="/mypage">
                              <User className="mr-2 h-4 w-4" />
                              ダッシュボード
                            </Link>
                          </Button>
                          <Button variant="ghost" className="justify-start" asChild>
                            <Link href="/mypage?tab=favorites">
                              <Heart className="mr-2 h-4 w-4" />
                              お気に入り
                            </Link>
                          </Button>
                          <Button variant="ghost" className="justify-between" asChild>
                            <Link href="/notifications">
                              <span className="flex items-center">
                                <Bell className="mr-2 h-4 w-4" />
                                通知
                              </span>
                              {user.unreadNotifications > 0 && (
                                <Badge variant="secondary" className="text-xs">{user.unreadNotifications}</Badge>
                              )}
                            </Link>
                          </Button>
                        </nav>
                      </div>
                    </>
                  )}

                  <div className="border-t pt-4">
                    <Button
                      className="w-full"
                      onClick={() => setIsReviewModalOpen(true)}
                    >
                      <PenSquare className="mr-2 h-4 w-4" />
                      口コミ投稿
                    </Button>
                  </div>

                  {!isLoggedIn && (
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" asChild>
                        <Link href="/login">ログイン</Link>
                      </Button>
                      <Button asChild>
                        <Link href="/register">新規登録</Link>
                      </Button>
                    </div>
                  )}

                  {isLoggedIn && (
                    <div className="border-t pt-4 flex flex-col gap-2">
                      {memberLevel !== "vip" && (
                        <Button variant="outline" className="text-primary border-primary bg-transparent" asChild>
                          <Link href="/pricing">
                            <Crown className="mr-2 h-4 w-4" />
                            {memberLevel === "free" ? "有料会員になる" : "VIPにアップグレード"}
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => authSignOut()}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        ログアウト
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <ReviewWizardModal
        open={isReviewModalOpen}
        onOpenChange={setIsReviewModalOpen}
        memberType={isLoggedIn ? memberLevel : "free"}
        monthlyReviewCount={user.monthlyReviewCount}
      />
    </>
  );
}
