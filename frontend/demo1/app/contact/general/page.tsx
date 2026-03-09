"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Mail, Send, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default function GeneralContactPage() {
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
          type: "general",
          name: data.get("name"),
          email: data.get("email"),
          subject: data.get("subject"),
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
              お問い合わせを受け付けました。2〜3営業日以内にご返信いたします。
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
          <span className="text-foreground">一般お問い合わせ</span>
        </nav>

        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                一般お問い合わせ
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                サービスに関するご質問やご連絡はこちらからお送りください。
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
                  <label htmlFor="subject" className="block text-sm font-medium mb-1">
                    件名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="subject"
                    name="subject"
                    type="text"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="お問い合わせの件名"
                  />
                </div>

                <div>
                  <label htmlFor="body" className="block text-sm font-medium mb-1">
                    お問い合わせ内容 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="body"
                    name="body"
                    rows={6}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                    placeholder="お問い合わせ内容をご記入ください"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={sending}>
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "送信中..." : "送信する"}
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
