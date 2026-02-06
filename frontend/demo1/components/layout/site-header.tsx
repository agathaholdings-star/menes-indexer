"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Search,
  Menu,
  User,
  LogIn,
  PenSquare,
  MapPin,
  MessageSquare,
  Trophy,
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
import { ReviewWizardModal } from "@/components/review/review-wizard-modal";

export function SiteHeader() {
  // Demo state - in production, use auth context
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [memberLevel, setMemberLevel] = useState<"free" | "standard" | "vip">("free");
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const [monthlyReviewCount, setMonthlyReviewCount] = useState(1);

  const user = {
    name: "山田太郎",
    avatar: null,
    remainingDays: 3,
    unreadNotifications: 5,
    unreadMessages: 2,
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

  // Demo: cycle through states
  const cycleAuthState = () => {
    if (!isLoggedIn) {
      setIsLoggedIn(true);
      setMemberLevel("free");
    } else if (memberLevel === "free") {
      setMemberLevel("standard");
    } else if (memberLevel === "standard") {
      setMemberLevel("vip");
    } else {
      setIsLoggedIn(false);
      setMemberLevel("free");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">ME</span>
            </div>
            <span className="hidden text-lg font-bold sm:inline">メンエスインデクサ</span>
          </Link>

          {/* Search Bar - Desktop */}
          <div className="hidden max-w-md flex-1 md:flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="店舗名・セラピスト名で検索"
                className="w-full pl-10"
              />
            </div>
          </div>

          {/* Navigation - Desktop */}
          <nav className="hidden items-center gap-1 lg:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/search">
                <Search className="mr-1 h-4 w-4" />
                セラピスト検索
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/area/東京">
                <MapPin className="mr-1 h-4 w-4" />
                エリア検索
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/ranking">
                <Trophy className="mr-1 h-4 w-4" />
                ランキング
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/bbs">
                <MessageSquare className="mr-1 h-4 w-4" />
                掲示板
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
                <Button variant="ghost" size="icon" className="relative hidden sm:flex" asChild>
                  <Link href="/mypage?tab=notifications">
                    <Bell className="h-5 w-5" />
                    {user.unreadNotifications > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                        {user.unreadNotifications}
                      </span>
                    )}
                  </Link>
                </Button>

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
                          </div>
                        </div>
                      </div>
                      {memberLevel === "free" && (
                        <div className="mt-3 p-2 rounded-md bg-muted text-sm">
                          <p className="text-muted-foreground">
                            無料閲覧残り: <span className="text-primary font-bold">{user.remainingDays}日</span>
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
                    <DropdownMenuItem asChild>
                      <Link href="/mypage?tab=messages" className="cursor-pointer flex items-center justify-between">
                        <span className="flex items-center">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          メッセージ
                        </span>
                        {user.unreadMessages > 0 && (
                          <Badge variant="secondary" className="text-xs">{user.unreadMessages}</Badge>
                        )}
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
                      onClick={() => setIsLoggedIn(false)}
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

            {/* Demo Toggle Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={cycleAuthState}
              className="text-xs hidden xl:flex bg-transparent"
            >
              Demo: {!isLoggedIn ? "未ログイン" : memberLevel}
            </Button>

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
                          無料閲覧残り: <span className="text-primary font-bold">{user.remainingDays}日</span>
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
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="店舗名・セラピスト名で検索"
                      className="pl-10"
                    />
                  </div>

                  {/* Mobile Navigation */}
                  <nav className="flex flex-col gap-1">
                    <Button variant="ghost" className="justify-start" asChild>
                      <Link href="/search">
                        <Search className="mr-2 h-4 w-4" />
                        セラピスト検索
                      </Link>
                    </Button>
                    <Button variant="ghost" className="justify-start" asChild>
                      <Link href="/area/東京">
                        <MapPin className="mr-2 h-4 w-4" />
                        エリア検索
                      </Link>
                    </Button>
                    <Button variant="ghost" className="justify-start" asChild>
                      <Link href="/ranking">
                        <Trophy className="mr-2 h-4 w-4" />
                        ランキング
                      </Link>
                    </Button>
                    <Button variant="ghost" className="justify-start" asChild>
                      <Link href="/bbs">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        掲示板
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
                            <Link href="/mypage?tab=messages">
                              <span className="flex items-center">
                                <MessageSquare className="mr-2 h-4 w-4" />
                                メッセージ
                              </span>
                              {user.unreadMessages > 0 && (
                                <Badge variant="secondary" className="text-xs">{user.unreadMessages}</Badge>
                              )}
                            </Link>
                          </Button>
                          <Button variant="ghost" className="justify-between" asChild>
                            <Link href="/mypage?tab=notifications">
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
                        onClick={() => setIsLoggedIn(false)}
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
