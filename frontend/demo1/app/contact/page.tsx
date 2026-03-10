import { type Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Trash2, Lightbulb, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "メンエスSKRへのお問い合わせ窓口一覧。掲載削除依頼、機能追加リクエスト、一般的なお問い合わせはこちらから。",
  alternates: { canonical: "/contact" },
};

const contactCategories = [
  {
    title: "掲載削除依頼",
    description: "ご自身の掲載情報の取り下げを希望される方はこちらからご連絡ください。セラピストご本人様、サロン関係者様からの削除依頼を受け付けております。",
    href: "/contact/removal",
    icon: Trash2,
    priority: "優先対応",
    priorityColor: "bg-red-100 text-red-700",
  },
  {
    title: "機能追加リクエスト",
    description: "「こんな機能がほしい」「ここが使いにくい」などのご意見・ご要望をお寄せください。サイト改善の参考にさせていただきます。",
    href: "/contact/feature-request",
    icon: Lightbulb,
    priority: "歓迎",
    priorityColor: "bg-amber-100 text-amber-700",
  },
  {
    title: "一般お問い合わせ",
    description: "上記以外のご質問やご連絡はこちらから。サービスに関する一般的なお問い合わせを受け付けております。",
    href: "/contact/general",
    icon: Mail,
    priority: null,
    priorityColor: "",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-6">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition-colors">ホーム</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">お問い合わせ</span>
        </nav>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">お問い合わせ</h1>
          <p className="text-muted-foreground mb-8">
            ご用件に合った窓口をお選びください。
          </p>

          <div className="space-y-4">
            {contactCategories.map((cat) => (
              <Link key={cat.href} href={cat.href} className="block group">
                <Card className="transition-colors hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <cat.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      {cat.title}
                      {cat.priority && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.priorityColor}`}>
                          {cat.priority}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{cat.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-8 text-center">
            すべてのお問い合わせは通常2〜3営業日以内にご返信いたします。
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
