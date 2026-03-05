"use client";

import Link from "next/link";
import {
  Check,
  X,
  Crown,
  Sparkles,
  Eye,
  PenSquare,
  Lock,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

const faqs = [
  {
    question: "クレジットとは何ですか？",
    answer:
      "クレジットは口コミを閲覧するための通貨です。1クレジットで1人のセラピストの口コミを全件閲覧できます。口コミを投稿すると無料でクレジットが付与されます。",
  },
  {
    question: "クレジットの有効期限はありますか？",
    answer:
      "はい、クレジットの有効期限は付与から7日間です。期限内にご利用ください。",
  },
  {
    question: "スクショ付き投稿のボーナスとは？",
    answer:
      "口コミ投稿時にスクリーンショットを添付すると、通常5クレジットに加えてボーナス5クレジット（合計10クレジット）が付与されます。",
  },
  {
    question: "単品購入の「永久アンロック」とは？",
    answer:
      "一度購入すれば、そのセラピストの口コミはアカウントが存在する限りいつでも閲覧可能です。クレジットの有効期限はありません。",
  },
  {
    question: "支払い方法は何がありますか？",
    answer:
      "クレジットカード（VISA、Mastercard、JCB、AMEX、Diners）に対応しています。",
  },
  {
    question: "Standard/VIPプランはいつ利用できますか？",
    answer:
      "現在開発中です。リリース時にお知らせいたします。まずは無料の口コミ投稿か単品購入をご利用ください。",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <Badge className="mb-4">料金プラン</Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
            口コミ投稿で無料閲覧、または単品購入
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            口コミを書いてクレジットを獲得するか、気になるセラピストを単品購入で永久アンロック。
          </p>
        </div>

        {/* 4カラムのプラン表示 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-16 items-start">
          {/* Free Plan - highlighted */}
          <Card className="border-primary shadow-xl md:scale-105 md:-my-4 z-10 lg:col-span-1">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="gap-1 bg-primary">
                <Crown className="h-3 w-3" />
                おすすめ
              </Badge>
            </div>
            <CardHeader className="text-center pb-4 pt-8">
              <CardTitle className="text-xl">無料会員</CardTitle>
              <CardDescription>口コミ投稿で無料閲覧</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">¥0</span>
                <span className="text-muted-foreground">/月</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {[
                  {
                    label: "1投稿 = 5クレジット",
                    included: true,
                    highlight: true,
                  },
                  {
                    label: "スクショ付きで+5ボーナス",
                    included: true,
                    highlight: true,
                  },
                  {
                    label: "1クレジット = 1セラピストの口コミ全部閲覧",
                    included: true,
                  },
                  {
                    label: "クレジット有効期限: 7日間",
                    included: true,
                  },
                  { label: "エリア・店舗検索", included: true },
                  { label: "セラピスト一覧", included: true },
                  { label: "お気に入り登録（5件まで）", included: true },
                ].map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check
                      className={`h-5 w-5 flex-shrink-0 ${
                        feature.highlight ? "text-amber-500" : "text-primary"
                      }`}
                    />
                    <span
                      className={
                        feature.highlight ? "text-amber-700 font-medium" : ""
                      }
                    >
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button className="w-full">無料登録して口コミを書く</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Single Purchase */}
          <Card>
            <CardHeader className="text-center pb-4 pt-8">
              <CardTitle className="text-xl">単品購入</CardTitle>
              <CardDescription>
                口コミを書かずに閲覧したい方向け
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">¥1,000</span>
                <span className="text-muted-foreground">
                  /1セラピスト
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {[
                  {
                    label: "永久アンロック",
                    included: true,
                    highlight: true,
                  },
                  {
                    label: "対象セラピストの口コミ全件閲覧",
                    included: true,
                  },
                  { label: "有効期限なし", included: true },
                  {
                    label: "セラピストページから購入可能",
                    included: true,
                  },
                ].map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check
                      className={`h-5 w-5 flex-shrink-0 ${
                        feature.highlight ? "text-amber-500" : "text-primary"
                      }`}
                    />
                    <span
                      className={
                        feature.highlight ? "text-amber-700 font-medium" : ""
                      }
                    >
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant="outline" disabled>
                <CreditCard className="h-4 w-4 mr-2" />
                ログインして購入
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                セラピストページから購入できます
              </p>
            </CardContent>
          </Card>

          {/* Standard - greyed out */}
          <Card className="opacity-60 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge
                variant="secondary"
                className="gap-1 bg-muted text-muted-foreground"
              >
                <Lock className="h-3 w-3" />
                開発中
              </Badge>
            </div>
            <CardHeader className="text-center pb-4 pt-8">
              <CardTitle className="text-xl">スタンダード</CardTitle>
              <CardDescription>
                全セラピストの口コミ無制限閲覧
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">¥4,980</span>
                <span className="text-muted-foreground">/月</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {[
                  { label: "口コミ全文読み放題", included: true },
                  { label: "お気に入り登録（無制限）", included: true },
                  { label: "発見検索", included: true },
                  { label: "セラピスト分析", included: true },
                ].map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant="outline" disabled>
                準備中
              </Button>
            </CardContent>
          </Card>

          {/* VIP - greyed out */}
          <Card className="opacity-60 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge
                variant="secondary"
                className="gap-1 bg-muted text-muted-foreground"
              >
                <Lock className="h-3 w-3" />
                開発中
              </Badge>
            </div>
            <CardHeader className="text-center pb-4 pt-8">
              <CardTitle className="text-xl">VIP</CardTitle>
              <CardDescription>
                Standard全機能 + 発見検索 + 優先サポート
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">¥14,980</span>
                <span className="text-muted-foreground">/月</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {[
                  { label: "スタンダードの全機能", included: true },
                  { label: "SKR/HRフィルター", included: true },
                  { label: "全フィルター使い放題", included: true },
                  { label: "優先サポート", included: true },
                ].map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant="outline" disabled>
                準備中
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* クレジット仕組み説明 */}
        <div className="max-w-3xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">
              クレジットの仕組み
            </h2>
            <p className="text-muted-foreground">
              口コミを投稿してクレジットを獲得。クレジットでセラピストの口コミを閲覧できます。
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                icon: PenSquare,
                title: "口コミを投稿",
                description:
                  "セラピストページから口コミを投稿すると、5クレジットが即時付与されます。",
                highlight: false,
              },
              {
                icon: Sparkles,
                title: "スクショ添付でボーナス",
                description:
                  "口コミにスクリーンショットを添付すると、ボーナス5クレジットが追加で付与されます（合計10クレジット）。",
                highlight: true,
              },
              {
                icon: Eye,
                title: "口コミを閲覧",
                description:
                  "1クレジットで1セラピストの口コミを全件閲覧可能。気になるセラピストに使いましょう。",
                highlight: false,
              },
            ].map((step, index) => (
              <div
                key={index}
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  step.highlight ? "border-amber-400/50 bg-amber-50/50" : ""
                }`}
              >
                <div
                  className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                    step.highlight
                      ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            よくある質問
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* CTA */}
        <div className="text-center mt-16 p-8 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">
            まずは無料で始めよう
          </h2>
          <p className="text-muted-foreground mb-6">
            口コミを投稿するだけでクレジットを獲得。気になるセラピストの口コミを無料で閲覧できます。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg">無料で会員登録</Button>
            </Link>
            <Link href="/">
              <Button size="lg" variant="outline">
                サイトを見てみる
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
