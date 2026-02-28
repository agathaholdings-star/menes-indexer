"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Search, PenSquare, User, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const isLoggedIn = !!authUser;

  const navItems = [
    { href: "/", icon: Home, label: "ホーム", requiresAuth: false },
    { href: "/search", icon: Search, label: "検索", requiresAuth: false },
    { href: "/review", icon: PenSquare, label: "投稿", requiresAuth: true },
    { href: isLoggedIn ? "/mypage" : "/login", icon: isLoggedIn ? User : LogIn, label: isLoggedIn ? "マイページ" : "ログイン", requiresAuth: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          const handleClick = (e: React.MouseEvent) => {
            if (item.requiresAuth && !isLoggedIn) {
              e.preventDefault();
              router.push(`/login?redirect=${encodeURIComponent(item.href)}`);
            }
          };

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClick}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-4 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
