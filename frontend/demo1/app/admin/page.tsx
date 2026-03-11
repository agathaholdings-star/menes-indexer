"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, Trash2, Eye, CheckCircle, XCircle, Clock, MessageCircle, Star, Users, ShieldCheck, ImageIcon, X, Mail, Lightbulb, Inbox } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { useAuth } from "@/lib/auth-context";

type ModerationStatus = "pending" | "approved" | "rejected";
type ReviewFilter = ModerationStatus | "all";
type ContactStatus = "new" | "in_progress" | "resolved" | "closed";
type ContactFilter = ContactStatus | "all";

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

interface ContactRow {
  id: number;
  type: "removal" | "feature-request" | "general";
  name: string | null;
  email: string | null;
  metadata: Record<string, any>;
  status: ContactStatus;
  created_at: string;
  resolved_at: string | null;
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

const CONTACT_TYPE_LABELS: Record<string, { label: string; icon: typeof Mail }> = {
  removal: { label: "削除依頼", icon: Trash2 },
  "feature-request": { label: "機能追加", icon: Lightbulb },
  general: { label: "一般", icon: Mail },
};

const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  new: "新規",
  in_progress: "対応中",
  resolved: "解決済み",
  closed: "クローズ",
};

const CONTACT_STATUS_BADGE: Record<ContactStatus, "default" | "secondary" | "destructive" | "outline"> = {
  new: "destructive",
  in_progress: "outline",
  resolved: "default",
  closed: "secondary",
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
  const { user: authUser, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactFilter, setContactFilter] = useState<ContactFilter>("new");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ salons: 0, therapists: 0, reviews: 0, users: 0, pending: 0, new_contacts: 0 });
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number | string } | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [rejectingReviewId, setRejectingReviewId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("他サイトからの転載の疑い");
  const [rejectCustomText, setRejectCustomText] = useState<string>("");

  useEffect(() => {
    if (authLoading) return;
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
      setContacts((data.contacts as ContactRow[]) || []);
      setLoading(false);
    }

    fetchData();
  }, [authUser, authLoading]);

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

  const handleReject = async () => {
    if (!rejectingReviewId) return;
    const reviewId = rejectingReviewId;
    const finalReason = rejectCustomText
      ? `${rejectReason}: ${rejectCustomText}`
      : rejectReason;
    setActionLoading(reviewId);
    setRejectingReviewId(null);
    const result = await adminAction("reject_review", { review_id: reviewId, reason: finalReason });
    if (result.ok) {
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, moderation_status: "rejected" as ModerationStatus } : r))
      );
      setStats((prev) => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
    } else {
      console.error("Reject failed:", result.error);
    }
    setActionLoading(null);
    setRejectReason("他サイトからの転載の疑い");
    setRejectCustomText("");
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
    } else if (type === "contact") {
      await handleDeleteContact();
      return;
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

  const handleContactStatus = async (contactId: number, status: ContactStatus) => {
    setActionLoading(`contact-${contactId}`);
    const result = await adminAction("update_contact_status", { contact_id: contactId, status });
    if (result.ok) {
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, status } : c))
      );
      if (status !== "new") {
        setStats((prev) => ({ ...prev, new_contacts: Math.max(0, prev.new_contacts - 1) }));
      }
    }
    setActionLoading(null);
  };

  const handleDeleteContact = async () => {
    if (!deleteTarget || deleteTarget.type !== "contact") return;
    const contactId = deleteTarget.id as number;
    const result = await adminAction("delete_contact", { contact_id: contactId });
    if (result.ok) {
      const deleted = contacts.find((c) => c.id === contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      if (deleted?.status === "new") {
        setStats((prev) => ({ ...prev, new_contacts: Math.max(0, prev.new_contacts - 1) }));
      }
    }
    setDeleteTarget(null);
  };

  const filteredContacts = contactFilter === "all"
    ? contacts
    : contacts.filter((c) => c.status === contactFilter);

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
            { label: "店舗", value: stats.salons, icon: "🏪" },
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
            <TabsTrigger value="contacts" className="gap-1">
              <Inbox className="h-4 w-4" />
              お問い合わせ
              {stats.new_contacts > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {stats.new_contacts}
                </Badge>
              )}
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
                            onClick={() => setRejectingReviewId(r.id)}
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

          {/* Contacts tab */}
          <TabsContent value="contacts" className="mt-4">
            <div className="flex gap-2 mb-4">
              {(["new", "in_progress", "resolved", "closed", "all"] as ContactFilter[]).map((f) => (
                <Button
                  key={f}
                  variant={contactFilter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setContactFilter(f)}
                  className={contactFilter !== f ? "bg-transparent" : ""}
                >
                  {f === "all" ? "全て" : CONTACT_STATUS_LABELS[f as ContactStatus]}
                  {f === "new" && stats.new_contacts > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                      {stats.new_contacts}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredContacts.length === 0 && !loading && (
                <p className="text-center text-muted-foreground py-8">お問い合わせがありません</p>
              )}
              {filteredContacts.map((c) => {
                const typeInfo = CONTACT_TYPE_LABELS[c.type] || { label: c.type, icon: Mail };
                const TypeIcon = typeInfo.icon;
                return (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{typeInfo.label}</span>
                          <Badge variant={CONTACT_STATUS_BADGE[c.status]}>
                            {CONTACT_STATUS_LABELS[c.status]}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {c.created_at && new Date(c.created_at).toLocaleString("ja-JP")}
                        </span>
                      </div>

                      <div className="text-sm space-y-1 mb-3">
                        {c.name && <p><span className="font-medium">名前:</span> {c.name}</p>}
                        {c.email && <p><span className="font-medium">メール:</span> <a href={`mailto:${c.email}`} className="text-primary underline">{c.email}</a></p>}
                      </div>

                      {/* Metadata fields */}
                      <div className="text-sm space-y-1 border-l-2 border-muted pl-3 mb-3">
                        {c.type === "removal" && (
                          <>
                            {c.metadata.relationship && <p><span className="font-medium text-xs">関係:</span> <span className="text-muted-foreground">{c.metadata.relationship === "therapist" ? "セラピスト本人" : c.metadata.relationship === "salon_owner" ? "サロン運営者" : "その他"}</span></p>}
                            {c.metadata.target_name && <p><span className="font-medium text-xs">対象:</span> <span className="text-muted-foreground">{c.metadata.target_name}</span></p>}
                            {c.metadata.target_url && <p><span className="font-medium text-xs">URL:</span> <a href={c.metadata.target_url} className="text-primary underline text-muted-foreground" target="_blank" rel="noopener noreferrer">{c.metadata.target_url}</a></p>}
                            {c.metadata.reason && <p><span className="font-medium text-xs">理由:</span> <span className="text-muted-foreground">{c.metadata.reason === "privacy" ? "プライバシー" : c.metadata.reason === "retired" ? "引退" : c.metadata.reason === "incorrect" ? "情報誤り" : c.metadata.reason}</span></p>}
                          </>
                        )}
                        {c.type === "feature-request" && (
                          <>
                            {c.metadata.category && <p><span className="font-medium text-xs">カテゴリ:</span> <span className="text-muted-foreground">{{ new_feature: "新機能の追加", improvement: "既存機能の改善", usability: "使いにくい点の報告", bug: "不具合の報告", other: "その他" }[c.metadata.category] || c.metadata.category}</span></p>}
                            {c.metadata.title && <p><span className="font-medium text-xs">タイトル:</span> <span className="text-muted-foreground">{c.metadata.title}</span></p>}
                          </>
                        )}
                        {c.type === "general" && c.metadata.subject && (
                          <p><span className="font-medium text-xs">件名:</span> <span className="text-muted-foreground">{c.metadata.subject}</span></p>
                        )}
                        {c.metadata.body && <p><span className="font-medium text-xs">内容:</span> <span className="text-muted-foreground whitespace-pre-wrap">{c.metadata.body}</span></p>}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t flex-wrap">
                        {c.status === "new" && (
                          <Button
                            variant="default"
                            size="sm"
                            disabled={actionLoading === `contact-${c.id}`}
                            onClick={() => handleContactStatus(c.id, "in_progress")}
                            className="gap-1"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            対応中にする
                          </Button>
                        )}
                        {(c.status === "new" || c.status === "in_progress") && (
                          <Button
                            variant="default"
                            size="sm"
                            disabled={actionLoading === `contact-${c.id}`}
                            onClick={() => handleContactStatus(c.id, "resolved")}
                            className="gap-1 bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            解決済み
                          </Button>
                        )}
                        <div className="flex-1" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget({ type: "contact", id: c.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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
              {deleteTarget?.type === "contact" && "このお問い合わせを削除します。この操作は取り消せません。"}
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

      {/* Rejection reason dialog */}
      <Dialog
        open={!!rejectingReviewId}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingReviewId(null);
            setRejectReason("他サイトからの転載の疑い");
            setRejectCustomText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>却下理由を選択</DialogTitle>
            <DialogDescription>
              口コミを却下する理由を選択してください。
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={rejectReason} onValueChange={setRejectReason} className="gap-3">
            {["他サイトからの転載の疑い", "オリジナリティ不足", "規約違反"].map((option) => (
              <div key={option} className="flex items-center gap-2">
                <RadioGroupItem value={option} id={`reason-${option}`} />
                <Label htmlFor={`reason-${option}`} className="cursor-pointer">{option}</Label>
              </div>
            ))}
          </RadioGroup>
          <div className="space-y-2">
            <Label htmlFor="reject-custom-text">補足（任意）</Label>
            <Textarea
              id="reject-custom-text"
              placeholder="補足コメントがあれば入力..."
              value={rejectCustomText}
              onChange={(e) => setRejectCustomText(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingReviewId(null)} className="bg-transparent">
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              却下する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
