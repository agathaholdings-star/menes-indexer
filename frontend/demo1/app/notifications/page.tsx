"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Heart,
  CheckCheck,
  Loader2,
  PenSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseBrowser } from "@/lib/supabase/client";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString("ja-JP");
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "helpful":
      return <Heart className="h-5 w-5 text-pink-500" />;
    case "favorite":
      return <Heart className="h-5 w-5 text-red-500" />;
    case "follow_review":
      return <PenSquare className="h-5 w-5 text-primary" />;
    case "system":
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
}

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifications = useCallback(
    async (offset = 0, append = false) => {
      if (!user) return;
      const supabase = createSupabaseBrowser();
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body, link, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      const items = (data || []) as Notification[];

      if (append) {
        setNotifications((prev) => [...prev, ...items]);
      } else {
        setNotifications(items);
      }
      setHasMore(items.length === PAGE_SIZE);
      setLoading(false);
      setLoadingMore(false);
    },
    [user]
  );

  // Fetch unread count separately
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const supabase = createSupabaseBrowser();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setUnreadCount(count || 0);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchNotifications();
    fetchUnreadCount();
  }, [user, authLoading, router, fetchNotifications, fetchUnreadCount]);

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    const supabase = createSupabaseBrowser();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const markOneRead = async (id: number) => {
    if (!user) return;
    const supabase = createSupabaseBrowser();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", user.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleClickNotification = (n: Notification) => {
    if (!n.is_read) {
      markOneRead(n.id);
    }
    if (n.link) {
      router.push(n.link);
    }
  };

  const loadMore = () => {
    setLoadingMore(true);
    fetchNotifications(notifications.length, true);
  };

  if (authLoading || loading) {
    return (
      <>
        <SiteHeader />
        <main className="min-h-screen bg-background">
          <div className="mx-auto max-w-2xl px-4 py-12">
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">通知</h1>
              {unreadCount > 0 && (
                <Badge variant="default" className="text-xs">
                  {unreadCount}件未読
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                className="text-primary hover:text-primary"
              >
                <CheckCheck className="mr-1 h-4 w-4" />
                すべて既読
              </Button>
            )}
          </div>

          {/* Notification List */}
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Bell className="h-12 w-12 mb-4" />
              <p className="text-lg">通知はありません</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`w-full text-left rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 ${
                    !n.is_read ? "border-l-4 border-l-primary" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0">
                      {getNotificationIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          !n.is_read ? "font-bold" : "font-medium"
                        }`}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="mt-2 shrink-0">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                </button>
              ))}

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center pt-4 pb-2">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        読み込み中...
                      </>
                    ) : (
                      "もっと見る"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
