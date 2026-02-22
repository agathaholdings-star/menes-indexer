"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ChevronRight, MessageCircle, Eye, ThumbsUp, Flag, Reply, Send, Lock, Crown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { type User, getEffectiveTier, tierPermissions } from "@/lib/data";

const categoryLabels: Record<string, string> = {
  question: "質問",
  info: "情報共有",
  review: "体験談",
  other: "雑談",
};

interface DBThread {
  id: number;
  title: string;
  body: string;
  category: string;
  is_vip_only: boolean;
  view_count: number;
  reply_count: number;
  created_at: string;
  user_id: string;
  profiles: { nickname: string | null } | null;
}

interface DBPost {
  id: number;
  body: string;
  likes: number;
  created_at: string;
  user_id: string;
  profiles: { nickname: string | null } | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BBSThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user: authUser } = useAuth();
  const [thread, setThread] = useState<DBThread | null>(null);
  const [posts, setPosts] = useState<DBPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<Set<number>>(new Set());
  const [localLikeCounts, setLocalLikeCounts] = useState<Record<number, number>>({});

  // 通報
  const [reportTarget, setReportTarget] = useState<{ type: string; id: number } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  // ティアチェック用
  const [membershipType, setMembershipType] = useState<string>("free");
  const [monthlyReviewCount, setMonthlyReviewCount] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
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
  }, [authUser]);

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

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    // スレッド取得
    supabase
      .from("bbs_threads")
      .select("id, title, body, category, is_vip_only, view_count, reply_count, created_at, user_id, profiles(nickname)")
      .eq("id", Number(id))
      .single()
      .then(({ data }) => {
        setThread(data as unknown as DBThread);

        // view_count を +1（fire and forget）
        if (data) {
          supabase
            .from("bbs_threads")
            .update({ view_count: (data.view_count || 0) + 1 })
            .eq("id", Number(id))
            .then(() => {});
        }
      });

    // レス取得
    supabase
      .from("bbs_posts")
      .select("id, body, likes, created_at, user_id, profiles(nickname)")
      .eq("thread_id", Number(id))
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setPosts((data as unknown as DBPost[]) || []);
        setLoading(false);
      });
  }, [id]);

  // ユーザーのいいね済みpost IDを取得
  useEffect(() => {
    if (!authUser) return;
    const supabase = createSupabaseBrowser();
    supabase
      .from("bbs_post_likes")
      .select("post_id")
      .eq("user_id", authUser.id)
      .then(({ data }) => {
        if (data) {
          setLikedPostIds(new Set(data.map((d) => d.post_id)));
        }
      });
  }, [authUser]);

  // posts変更時にlocalLikeCountsを初期化
  useEffect(() => {
    const counts: Record<number, number> = {};
    for (const p of posts) {
      counts[p.id] = p.likes;
    }
    setLocalLikeCounts(counts);
  }, [posts]);

  const handleToggleLike = async (postId: number) => {
    if (!authUser) return;
    const supabase = createSupabaseBrowser();
    const isLiked = likedPostIds.has(postId);

    // オプティミスティック更新
    if (isLiked) {
      setLikedPostIds((prev) => { const next = new Set(prev); next.delete(postId); return next; });
      setLocalLikeCounts((prev) => ({ ...prev, [postId]: Math.max((prev[postId] || 0) - 1, 0) }));
      await supabase.from("bbs_post_likes").delete().eq("user_id", authUser.id).eq("post_id", postId);
    } else {
      setLikedPostIds((prev) => new Set(prev).add(postId));
      setLocalLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
      await supabase.from("bbs_post_likes").insert({ user_id: authUser.id, post_id: postId });
    }
  };

  const handleReport = async () => {
    if (!reportTarget || !reportReason || !authUser) return;
    setReportSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: reportTarget.type,
          target_id: reportTarget.id,
          reason: reportReason,
          detail: reportDetail || undefined,
        }),
      });
      if (res.ok) {
        setReportDone(true);
        setTimeout(() => {
          setReportTarget(null);
          setReportReason("");
          setReportDetail("");
          setReportDone(false);
        }, 2000);
      }
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !authUser) return;
    setIsSubmitting(true);
    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase
      .from("bbs_posts")
      .insert({
        thread_id: Number(id),
        user_id: authUser.id,
        body: replyContent.trim(),
      })
      .select("id, body, likes, created_at, user_id, profiles(nickname)")
      .single();

    if (!error && data) {
      setPosts((prev) => [...prev, data as unknown as DBPost]);
      setReplyContent("");
      // reply_countはトリガーで自動更新される
    }
    setIsSubmitting(false);
  };

  // ティアゲート: スタンダード以上のみ
  if (!profileLoading && !permissions.canUseBBS) {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-2/3" />
              <div className="h-32 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">スレッドが見つかりません</p>
          <Link href="/bbs"><Button className="mt-4">掲示板に戻る</Button></Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // VIPスレッドに非VIPユーザーがアクセスした場合のゲート
  if (thread.is_vip_only && !permissions.canUseVIPBBS) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-amber-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <Crown className="h-10 w-10 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold mb-3">VIP限定スレッド</h1>
            <p className="text-muted-foreground mb-6">
              このスレッドはVIP会員限定です。VIPにアップグレードしてアクセスしましょう。
            </p>
            <Link href="/pricing">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-white hover:from-amber-600 hover:to-yellow-500">
                <Crown className="h-4 w-4" />
                VIPにアップグレード
              </Button>
            </Link>
            <div className="mt-4">
              <Link href="/bbs" className="text-sm text-muted-foreground hover:underline">掲示板に戻る</Link>
            </div>
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
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/" className="hover:text-foreground transition-colors">ホーム</Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/bbs" className="hover:text-foreground transition-colors">掲示板</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground truncate max-w-[200px]">{thread.title}</span>
          </nav>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                {thread.is_vip_only && (
                  <Badge className="gap-1 text-xs bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-0">
                    <Crown className="h-3 w-3" />
                    VIP
                  </Badge>
                )}
                <Badge variant="outline">{categoryLabels[thread.category] || thread.category}</Badge>
              </div>
              <CardTitle className="text-xl">{thread.title}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                <span>{thread.profiles?.nickname || "名無しさん"}</span>
                <span>{formatDate(thread.created_at)}</span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  {thread.reply_count + posts.length - (thread.reply_count)}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {thread.view_count}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{thread.body}</p>
            </CardContent>
          </Card>

          <div className="mb-6">
            <h2 className="text-lg font-bold mb-4">返信 ({posts.length}件)</h2>
            {posts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                <p>まだ返信がありません。最初の返信を投稿しましょう。</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post, index) => {
                  const isOP = post.user_id === thread.user_id;
                  return (
                    <Card key={post.id} className={isOP ? "border-primary/30 bg-primary/5" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-sm bg-muted">
                              {(post.profiles?.nickname || "名")[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium">{post.profiles?.nickname || "名無しさん"}</span>
                              {isOP && (
                                <Badge variant="secondary" className="text-xs">スレ主</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">{formatDate(post.created_at)}</span>
                              <span className="text-xs text-muted-foreground">#{index + 1}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap mb-3">{post.body}</p>
                            <div className="flex items-center gap-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-8 gap-1 ${likedPostIds.has(post.id) ? "text-primary" : "text-muted-foreground"}`}
                                onClick={() => handleToggleLike(post.id)}
                                disabled={!authUser}
                              >
                                <ThumbsUp className={`h-4 w-4 ${likedPostIds.has(post.id) ? "fill-current" : ""}`} />
                                <span>{localLikeCounts[post.id] ?? post.likes}</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-muted-foreground"
                                onClick={() => setReportTarget({ type: "bbs_post", id: post.id })}
                                disabled={!authUser}
                              >
                                <Flag className="h-4 w-4" />
                                報告
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">返信を投稿</CardTitle>
            </CardHeader>
            <CardContent>
              {authUser ? (
                <>
                  <Textarea
                    placeholder="返信内容を入力してください..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={4}
                    className="mb-4"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      投稿は利用規約に同意したものとみなされます
                    </p>
                    <Button onClick={handleSubmitReply} disabled={!replyContent.trim() || isSubmitting} className="gap-2">
                      <Send className="h-4 w-4" />
                      {isSubmitting ? "投稿中..." : "投稿する"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-2">返信するにはログインが必要です</p>
                  <Link href="/login"><Button>ログイン</Button></Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <SiteFooter />

      {/* 通報ダイアログ */}
      <Dialog open={!!reportTarget} onOpenChange={(open) => { if (!open) { setReportTarget(null); setReportReason(""); setReportDetail(""); setReportDone(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              投稿を報告
            </DialogTitle>
          </DialogHeader>
          {reportDone ? (
            <div className="text-center py-6">
              <p className="text-sm font-medium text-green-600">報告を受け付けました。ご協力ありがとうございます。</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">報告理由</Label>
                <div className="mt-2 space-y-2">
                  {[
                    { value: "spam", label: "スパム・宣伝" },
                    { value: "harassment", label: "誹謗中傷・嫌がらせ" },
                    { value: "illegal", label: "違法な内容" },
                    { value: "personal_info", label: "個人情報の掲載" },
                    { value: "other", label: "その他" },
                  ].map((r) => (
                    <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="report_reason"
                        value={r.value}
                        checked={reportReason === r.value}
                        onChange={() => setReportReason(r.value)}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="text-sm">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">詳細（任意）</Label>
                <Textarea
                  value={reportDetail}
                  onChange={(e) => setReportDetail(e.target.value)}
                  placeholder="具体的な内容を記入してください"
                  rows={3}
                  className="mt-1"
                />
              </div>
              <Button
                className="w-full"
                variant="destructive"
                onClick={handleReport}
                disabled={!reportReason || reportSubmitting}
              >
                {reportSubmitting ? "送信中..." : "報告する"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
