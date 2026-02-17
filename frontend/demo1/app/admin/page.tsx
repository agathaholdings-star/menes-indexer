"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, Trash2, Eye, CheckCircle, XCircle, Clock, MessageCircle, Star, Users, ShieldCheck, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { useAuth } from "@/lib/auth-context";

type ModerationStatus = "pending" | "approved" | "rejected";
type ReviewFilter = ModerationStatus | "all";

interface ReviewRow {
  id: string;
  score: number | null;
  looks_type_id: number | null;
  body_type_id: number | null;
  service_level_id: number | null;
  moderation_status: ModerationStatus;
  comment_first_impression: string | null;
  comment_service: string | null;
  comment_advice: string | null;
  created_at: string | null;
  user_id: string;
  therapist_id: number;
  salon_id: number;
  therapist_name?: string;
  shop_name?: string;
  user_nickname?: string;
  verification_image_path: string | null;
  is_verified: boolean | null;
}

interface ThreadRow {
  id: number;
  title: string;
  category: string;
  reply_count: number;
  view_count: number;
  created_at: string;
  user_id: string;
  user_nickname?: string;
}

interface UserRow {
  id: string;
  nickname: string | null;
  membership_type: string;
  total_review_count: number;
  created_at: string;
}

const STATUS_LABELS: Record<ModerationStatus, string> = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
};

const STATUS_BADGE_VARIANT: Record<ModerationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
};

async function adminAction(action: string, params: Record<string, any> = {}) {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
  return res.json();
}

export default function AdminPage() {
  const { user: authUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ shops: 0, therapists: 0, reviews: 0, users: 0, pending: 0 });
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number | string } | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) { setIsAdmin(false); setLoading(false); return; }

    async function fetchData() {
      const res = await fetch("/api/admin");
      if (res.status === 401 || res.status === 403) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setIsAdmin(true);
      setStats(data.stats);
      setReviews(
        (data.reviews || []).map((r: any) => ({
          ...r,
          moderation_status: r.moderation_status as ModerationStatus,
        }))
      );
      setThreads(data.threads || []);
      setUsers((data.users as UserRow[]) || []);
      setLoading(false);
    }

    fetchData();
  }, [authUser]);

  const handleApprove = async (reviewId: string) => {
    setActionLoading(reviewId);
    const result = await adminAction("approve_review", { review_id: reviewId });
    if (result.ok) {
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, moderation_status: "approved" as ModerationStatus } : r))
      );
      setStats((prev) => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
    } else {
      console.error("Approve failed:", result.error);
    }
    setActionLoading(null);
  };

  const handleReject = async (reviewId: string) => {
    setActionLoading(reviewId);
    const result = await adminAction("reject_review", { review_id: reviewId });
    if (result.ok) {
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, moderation_status: "rejected" as ModerationStatus } : r))
      );
      setStats((prev) => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
    } else {
      console.error("Reject failed:", result.error);
    }
    setActionLoading(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;

    if (type === "review") {
      await adminAction("delete_review", { review_id: id });
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } else if (type === "thread") {
      await adminAction("delete_thread", { thread_id: id });
      setThreads((prev) => prev.filter((t) => t.id !== id));
    }
    setDeleteTarget(null);
  };

  const handleVerify = async (reviewId: string) => {
    setActionLoading(reviewId);
    const result = await adminAction("verify_review", { review_id: reviewId });
    if (result.ok) {
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, is_verified: true } : r))
      );
    } else {
      console.error("Verify failed:", result.error);
    }
    setActionLoading(null);
  };

  const handleApproveAndVerify = async (reviewId: string) => {
    setActionLoading(reviewId);
    const approveResult = await adminAction("approve_review", { review_id: reviewId });
    if (approveResult.ok) {
      const verifyResult = await adminAction("verify_review", { review_id: reviewId });
      if (verifyResult.ok) {
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId ? { ...r, moderation_status: "approved" as ModerationStatus, is_verified: true } : r
          )
        );
      }
      setStats((prev) => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
    } else {
      console.error("Approve+Verify failed:", approveResult.error);
    }
    setActionLoading(null);
  };

  const handleShowImage = async (path: string) => {
    const result = await adminAction("get_image_url", { path });
    if (result.url) {
      setPreviewImageUrl(result.url);
    }
  };

  const filteredReviews = reviewFilter === "all"
    ? reviews
    : reviews.filter((r) => r.moderation_status === reviewFilter);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">読み込み中...</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!authUser || !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-12 text-center">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">管理者専用</h1>
          <p className="text-muted-foreground">アクセス権限がありません</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">管理ダッシュボード</h1>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "店舗", value: stats.shops, icon: "🏪" },
            { label: "セラピスト", value: stats.therapists, icon: "👤" },
            { label: "口コミ", value: stats.reviews, icon: "⭐" },
            { label: "承認待ち", value: stats.pending, icon: "⏳" },
            { label: "ユーザー", value: stats.users, icon: "👥" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl mb-1">{s.icon}</p>
                <p className="text-2xl font-bold">{loading ? "..." : s.value.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="reviews">
          <TabsList>
            <TabsTrigger value="reviews" className="gap-1">
              <Star className="h-4 w-4" />
              口コミ
              {stats.pending > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {stats.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="threads" className="gap-1">
              <MessageCircle className="h-4 w-4" />
              掲示板
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1">
              <Users className="h-4 w-4" />
              ユーザー
            </TabsTrigger>
          </TabsList>

          {/* Reviews tab */}
          <TabsContent value="reviews" className="mt-4">
            {/* Status sub-filter */}
            <div className="flex gap-2 mb-4">
              {(["pending", "approved", "rejected", "all"] as ReviewFilter[]).map((f) => (
                <Button
                  key={f}
                  variant={reviewFilter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReviewFilter(f)}
                  className={reviewFilter !== f ? "bg-transparent" : ""}
                >
                  {f === "all" ? "全て" : STATUS_LABELS[f as ModerationStatus]}
                  {f === "pending" && stats.pending > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                      {stats.pending}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredReviews.length === 0 && !loading && (
                <p className="text-center text-muted-foreground py-8">口コミがありません</p>
              )}
              {filteredReviews.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    {/* Header: who wrote about whom */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-base">
                          {r.therapist_name}
                          <span className="text-muted-foreground font-normal text-sm ml-1">
                            @ {r.shop_name}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          投稿者: {r.user_nickname} / {r.created_at && new Date(r.created_at).toLocaleString("ja-JP")}
                        </p>
                      </div>
                      <Badge variant={STATUS_BADGE_VARIANT[r.moderation_status]}>
                        {STATUS_LABELS[r.moderation_status]}
                      </Badge>
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge>{r.score ?? 0}点</Badge>
                      {r.looks_type_id && <Badge variant="secondary">{r.looks_type_id}</Badge>}
                      {r.body_type_id && <Badge variant="secondary">{r.body_type_id}</Badge>}
                      {r.service_level_id && (
                        <Badge variant={String(r.service_level_id) === "3" ? "destructive" : "secondary"}>
                          {String(r.service_level_id) === "1" ? "健全" : String(r.service_level_id) === "2" ? "SKR" : "HR"}
                        </Badge>
                      )}
                      {r.is_verified && (
                        <Badge variant="default" className="bg-green-600 gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          認証済み
                        </Badge>
                      )}
                      {r.verification_image_path && !r.is_verified && (
                        <Badge variant="outline" className="gap-1">
                          <ImageIcon className="h-3 w-3" />
                          スクショあり
                        </Badge>
                      )}
                    </div>

                    {/* Verification Image */}
                    {r.verification_image_path && (
                      <div className="mb-3">
                        <button
                          type="button"
                          onClick={() => handleShowImage(r.verification_image_path!)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
                        >
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          予約スクショを確認
                        </button>
                      </div>
                    )}

                    {/* Review content */}
                    <div className="space-y-2 text-sm border-l-2 border-muted pl-3">
                      {r.comment_first_impression && (
                        <div>
                          <span className="font-medium text-xs">第一印象: </span>
                          <span className="text-muted-foreground">{r.comment_first_impression}</span>
                        </div>
                      )}
                      {r.comment_service && (
                        <div>
                          <span className="font-medium text-xs">サービス: </span>
                          <span className="text-muted-foreground">{r.comment_service}</span>
                        </div>
                      )}
                      {r.comment_advice && (
                        <div>
                          <span className="font-medium text-xs">アドバイス: </span>
                          <span className="text-muted-foreground">{r.comment_advice}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
                      {r.moderation_status === "pending" && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            disabled={actionLoading === r.id}
                            onClick={() => handleApprove(r.id)}
                            className="gap-1"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            承認
                          </Button>
                          {r.verification_image_path && !r.is_verified && (
                            <Button
                              variant="default"
                              size="sm"
                              disabled={actionLoading === r.id}
                              onClick={() => handleApproveAndVerify(r.id)}
                              className="gap-1 bg-green-600 hover:bg-green-700"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              承認&認証
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading === r.id}
                            onClick={() => handleReject(r.id)}
                            className="gap-1 bg-transparent"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            却下
                          </Button>
                        </>
                      )}
                      {r.verification_image_path && !r.is_verified && r.moderation_status !== "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionLoading === r.id}
                          onClick={() => handleVerify(r.id)}
                          className="gap-1 border-green-600 text-green-600 hover:bg-green-50 bg-transparent"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          認証する
                        </Button>
                      )}
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ type: "review", id: r.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* BBS tab */}
          <TabsContent value="threads" className="space-y-3 mt-4">
            {threads.length === 0 && !loading && (
              <p className="text-center text-muted-foreground py-8">スレッドがありません</p>
            )}
            {threads.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">#{t.id}</Badge>
                        <Badge variant="secondary">{t.category}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {t.reply_count}件の返信 / {t.view_count}閲覧
                        </span>
                      </div>
                      <p className="font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.user_nickname} / {new Date(t.created_at).toLocaleString("ja-JP")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Link href={`/bbs/${t.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ type: "thread", id: t.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Users tab */}
          <TabsContent value="users" className="space-y-3 mt-4">
            {users.map((u) => (
              <Card key={u.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{u.nickname || "名無し"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={u.membership_type === "vip" ? "default" : u.membership_type === "standard" ? "secondary" : "outline"}
                        >
                          {u.membership_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          口コミ {u.total_review_count}件
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("ja-JP")}登録
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                      {u.id.slice(0, 8)}...
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <SiteFooter />

      {/* Image preview overlay */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <img src={previewImageUrl} alt="予約スクショ" className="max-w-full max-h-[80vh] rounded-lg object-contain" />
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "review" && "この口コミを削除します。この操作は取り消せません。"}
              {deleteTarget?.type === "thread" && "このスレッドと全ての返信を削除します。この操作は取り消せません。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
