"use client";

import Link from "next/link";
import { Check, X, Crown, Sparkles, Eye, Bell, Ban, MessageSquare, Filter, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

const plans = [
  {
    id: "free",
    name: "無料会員",
    description: "口コミ投稿で閲覧可能",
    price: 0,
    priceNote: null,
    features: [
      { label: "口コミ投稿", included: true },
      { label: "口コミ閲覧（投稿後24時間限定）", included: true },
      { label: "セラピスト検索", included: true },
      { label: "お気に入り登録（5件まで）", included: true },
      { label: "口コミ無制限閲覧", included: false },
      { label: "広告非表示", included: false },
      { label: "SKR/HRフィルター", included: false },
    ],
    cta: "無料で始める",
    popular: false,
    tier: "free",
  },
  {
    id: "standard",
    name: "スタンダード会員",
    description: "全ての口コミが読み放題",
    price: 4980,
    priceNote: "投稿で翌月¥1,000割引 → 実質¥3,980〜",
    features: [
      { label: "口コミ投稿", included: true },
      { label: "口コミ無制限閲覧", included: true },
      { label: "セラピスト検索", included: true },
      { label: "お気に入り登録（無制限）", included: true },
      { label: "広告非表示", included: true },
      { label: "新着口コミ通知", included: true },
      { label: "SKR/HRフィルター（VIP限定）", included: false },
    ],
    cta: "スタンダードに登録",
    popular: true,
    tier: "standard",
  },
  {
    id: "vip",
    name: "VIP会員",
    description: "本当に知りたい情報にアクセス",
    price: 14980,
    priceNote: "最上位プランの全機能を解放",
    features: [
      { label: "スタンダードの全機能", included: true },
      { label: "SKR/HRフィルター", included: true, highlight: true },
      { label: "サービスレベルで絞り込み", included: true, highlight: true },
      { label: "VIP専用掲示板", included: true },
      { label: "優先サポート", included: true },
    ],
    cta: "VIPに登録",
    popular: false,
    tier: "vip",
  },
];

const faqs = [
  {
    question: "無料会員でも口コミは見れますか？",
    answer: "はい、口コミを1件投稿すると24時間すべての口コミが閲覧可能になります。投稿を続けることで継続的に閲覧できます。",
  },
  {
    question: "SKR/HRフィルターとは何ですか？",
    answer: "VIP会員限定の機能で、サービスレベル（SKR/HR）でセラピストを絞り込むことができます。本当に知りたい情報にアクセスできます。",
  },
  {
    question: "スタンダード会員の割引はどうやって適用されますか？",
    answer: "月に1件以上口コミを投稿すると、翌月の月額から¥1,000割引されます。毎月投稿を続けることで実質¥3,980でご利用いただけます。",
  },
  {
    question: "解約はいつでもできますか？",
    answer: "はい、いつでも解約可能です。解約後も契約期間終了までは全機能をご利用いただけます。",
  },
  {
    question: "支払い方法は何がありますか？",
    answer: "クレジットカード（VISA、Mastercard、JCB、AMEX）に対応しています。",
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
            あなたに合ったプランを選ぼう
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            無料会員でも口コミ投稿で閲覧可能。もっと便利に使いたい方は有料プランがおすすめです。
          </p>
        </div>

        {/* 3カラムのプラン表示 */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16 items-start">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative ${
                plan.popular 
                  ? "border-primary shadow-xl md:scale-105 md:-my-4 z-10" 
                  : plan.tier === "vip"
                  ? "border-amber-400/50 bg-gradient-to-b from-amber-50/50 to-background"
                  : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1 bg-primary">
                    <Crown className="h-3 w-3" />
                    人気
                  </Badge>
                </div>
              )}
              {plan.tier === "vip" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1 bg-gradient-to-r from-amber-500 to-yellow-500 border-0 text-white">
                    <Sparkles className="h-3 w-3" />
                    VIP
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-4 pt-8">
                <CardTitle className={`text-xl ${plan.tier === "vip" ? "text-amber-700" : ""}`}>
                  {plan.name}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className={`text-4xl font-bold ${plan.tier === "vip" ? "text-amber-600" : ""}`}>
                    ¥{plan.price.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">/月</span>
                  {plan.priceNote && (
                    <p className={`text-xs mt-2 ${plan.tier === "vip" ? "text-amber-600" : "text-primary"}`}>
                      {plan.priceNote}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      {feature.included ? (
                        <Check className={`h-5 w-5 flex-shrink-0 ${
                          feature.highlight ? "text-amber-500" : "text-primary"
                        }`} />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
                      )}
                      <span className={
                        feature.included 
                          ? feature.highlight 
                            ? "text-amber-700 font-medium" 
                            : "" 
                          : "text-muted-foreground/70"
                      }>
                        {feature.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className={`w-full ${
                    plan.tier === "vip" 
                      ? "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white border-0" 
                      : plan.popular 
                      ? "" 
                      : ""
                  }`}
                  variant={plan.popular ? "default" : plan.tier === "vip" ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 特典セクション */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">有料会員の特典</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Eye, title: "口コミ読み放題", description: "すべての口コミを無制限で閲覧", forVip: false },
              { icon: Ban, title: "広告非表示", description: "快適なブラウジング体験", forVip: false },
              { icon: Bell, title: "新着通知", description: "お気に入りの更新をお知らせ", forVip: false },
              { icon: Filter, title: "SKR/HRフィルター", description: "サービスレベルで絞り込み", forVip: true },
            ].map((benefit, index) => (
              <Card key={index} className={benefit.forVip ? "border-amber-400/50" : ""}>
                <CardContent className="p-6 text-center">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    benefit.forVip ? "bg-amber-100" : "bg-primary/10"
                  }`}>
                    <benefit.icon className={`h-6 w-6 ${benefit.forVip ? "text-amber-600" : "text-primary"}`} />
                  </div>
                  <h3 className="font-bold mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  {benefit.forVip && (
                    <Badge variant="outline" className="mt-2 text-amber-600 border-amber-400">
                      VIP限定
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">よくある質問</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* CTA */}
        <div className="text-center mt-16 p-8 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">まずは無料で始めよう</h2>
          <p className="text-muted-foreground mb-6">
            口コミを投稿するだけで24時間すべての口コミが閲覧可能。気に入ったら有料プランへ。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg">無料で会員登録</Button>
            </Link>
            <Link href="/">
              <Button size="lg" variant="outline">サイトを見てみる</Button>
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
