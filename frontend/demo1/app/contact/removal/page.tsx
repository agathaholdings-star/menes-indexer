"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Trash2, Send, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default function RemovalRequestPage() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "removal",
          name: data.get("name"),
          email: data.get("email"),
          relationship: data.get("relationship"),
          target_url: data.get("target_url"),
          target_name: data.get("target_name"),
          reason: data.get("reason"),
          body: data.get("body"),
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError("送信に失敗しました。時間をおいて再度お試しください。");
      }
    } catch {
      setError("通信エラーが発生しました。ネットワーク接続を確認してください。");
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-6">
          <div className="max-w-2xl mx-auto text-center py-16">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">送信完了</h1>
            <p className="text-muted-foreground mb-6">
              削除依頼を受け付けました。内容を確認の上、2〜3営業日以内にご連絡いたします。
            </p>
            <Link href="/">
              <Button variant="outline">トップページに戻る</Button>
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
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition-colors">ホーム</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/contact" className="hover:text-foreground transition-colors">お問い合わせ</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">掲載削除依頼</span>
        </nav>

        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                掲載削除依頼
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                ご自身の掲載情報の取り下げを希望される方は、以下のフォームにご記入ください。
                ご本人確認のため、いくつかの情報をお伺いします。
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    お名前 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="山田 太郎"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    メールアドレス <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="example@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="relationship" className="block text-sm font-medium mb-1">
                    ご関係 <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="relationship"
                    name="relationship"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">選択してください</option>
                    <option value="therapist">掲載されているセラピスト本人</option>
                    <option value="salon_owner">サロン運営者・責任者</option>
                    <option value="other">その他の関係者</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="target_name" className="block text-sm font-medium mb-1">
                    削除を希望するページの名前 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="target_name"
                    name="target_name"
                    type="text"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="セラピスト名またはサロン名"
                  />
                </div>

                <div>
                  <label htmlFor="target_url" className="block text-sm font-medium mb-1">
                    該当ページのURL（わかれば）
                  </label>
                  <input
                    id="target_url"
                    name="target_url"
                    type="url"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="https://menes-skr.com/therapist/..."
                  />
                </div>

                <div>
                  <label htmlFor="reason" className="block text-sm font-medium mb-1">
                    削除理由 <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="reason"
                    name="reason"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">選択してください</option>
                    <option value="privacy">プライバシーの保護</option>
                    <option value="retired">業界を引退した</option>
                    <option value="incorrect">掲載情報が誤っている</option>
                    <option value="other">その他</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="body" className="block text-sm font-medium mb-1">
                    補足事項
                  </label>
                  <textarea
                    id="body"
                    name="body"
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                    placeholder="その他お伝えしたいことがあればご記入ください"
                  />
                </div>

                <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
                  <p>・ご本人確認のため、追加の情報をお伺いする場合があります。</p>
                  <p>・確認完了後、速やかに該当ページの削除を行います。</p>
                  <p>・通常2〜3営業日以内に対応いたします。</p>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={sending}>
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "送信中..." : "削除依頼を送信"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
