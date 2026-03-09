"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Lightbulb, Send, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default function FeatureRequestPage() {
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
          type: "feature-request",
          name: data.get("name"),
          email: data.get("email"),
          category: data.get("category"),
          title: data.get("title"),
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
              ご要望をお寄せいただきありがとうございます。今後のサイト改善に活かしてまいります。
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
          <span className="text-foreground">機能追加リクエスト</span>
        </nav>

        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                機能追加リクエスト
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                「こんな機能がほしい」「ここが使いにくい」など、ご意見・ご要望をお聞かせください。
                皆さまのフィードバックがサイト改善の原動力です。
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    ニックネーム
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="匿名でも構いません"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    メールアドレス（返信希望の場合）
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="example@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium mb-1">
                    カテゴリ <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="category"
                    name="category"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">選択してください</option>
                    <option value="new_feature">新機能の追加</option>
                    <option value="improvement">既存機能の改善</option>
                    <option value="usability">使いにくい点の報告</option>
                    <option value="bug">不具合の報告</option>
                    <option value="other">その他</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-1">
                    要望タイトル <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="例: セラピストのお気に入り機能がほしい"
                  />
                </div>

                <div>
                  <label htmlFor="body" className="block text-sm font-medium mb-1">
                    詳細 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="body"
                    name="body"
                    rows={6}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                    placeholder="どんな場面で、どんな機能があると嬉しいか、できるだけ具体的にお書きください"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={sending}>
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "送信中..." : "リクエストを送信"}
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
