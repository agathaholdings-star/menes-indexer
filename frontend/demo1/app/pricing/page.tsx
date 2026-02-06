"use client";

import Link from "next/link";
import { Check, X, Crown, Sparkles, Eye, Bell, Ban, MessageSquare, Filter, Search, BarChart3, PenSquare } from "lucide-react";
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
    description: "口コミ投稿で3日間アクセス",
    price: 0,
    priceNote: null,
    features: [
      { label: "エリア・店舗検索", included: true },
      { label: "セラピスト一覧", included: true },
      { label: "口コミ投稿", included: true },
      { label: "投稿後3日間口コミ閲覧", included: true },
      { label: "お気に入り登録（5件まで）", included: true },
      { label: "口コミ読み放題", included: false },
      { label: "発見検索", included: false },
      { label: "SKR/HRフィルター", included: false },
    ],
    cta: "無料で始める",
    popular: false,
    tier: "free",
  },
  {
    id: "standard",
    name: "スタンダード会員",
    description: "口コミ読み放題 + 投稿で機能解放",
    price: 4980,
    priceNote: "投稿するほど使える機能が増える",
    features: [
      { label: "口コミ全文読み放題（MEと同等）", included: true },
      { label: "お気に入り登録（無制限）", included: true },
      { label: "月1本投稿 → 発見検索が使える", included: true, highlight: true },
      { label: "月2本投稿 → セラピスト分析 + 掲示板", included: true, highlight: true },
      { label: "月3本投稿 → VIP相当の全機能解放", included: true, highlight: true },
    ],
    cta: "スタンダードに登録",
    popular: true,
    tier: "standard",
  },
  {
    id: "vip",
    name: "VIP会員",
    description: "投稿不要で全機能使い放題",
    price: 14980,
    priceNote: "投稿なしで全機能を利用可能",
    features: [
      { label: "スタンダードの全機能", included: true },
      { label: "SKR/HRフィルター・リスト", included: true, highlight: true },
      { label: "全フィルター使い放題", included: true, highlight: true },
      { label: "VIP専用掲示板", included: true, highlight: true },
      { label: "セラピスト分析", included: true, highlight: true },
      { label: "投稿不要", included: true },
    ],
    cta: "VIPに登録",
    popular: false,
    tier: "vip",
  },
];

const unlockStages = [
  {
    posts: "0本",
    features: "口コミ全文読み放題",
    description: "MEと同等の機能。同価格で乗り換えハードルゼロ。",
  },
  {
    posts: "1本",
    features: "+ 発見検索",
    description: "タイプ x エリア x スコアで検索。MEにない独自機能。約90秒で投稿完了。",
  },
  {
    posts: "2本",
    features: "+ セラピスト分析 + 掲示板・DM",
    description: "レーダーチャート等の詳細分析。コミュニティ機能も解放。",
  },
  {
    posts: "3本",
    features: "VIP相当の全機能",
    description: "SKR/HRフィルター、全リスト、VIP掲示板まで全て解放。",
  },
];

const faqs = [
  {
    question: "無料会員でも口コミは見れますか？",
    answer: "はい、口コミを1件投稿すると3日間すべての口コミ本文とスコアが閲覧可能になります。投稿を続けることで継続的に閲覧できます。",
  },
  {
    question: "スタンダード会員の投稿で解放される機能とは？",
    answer: "料金は月額¥4,980で固定です。0本投稿でも口コミ読み放題（MEと同等）。月1本投稿で発見検索、月2本でセラピスト分析+掲示板、月3本でVIP相当の全機能が解放されます。毎月リセットされます。",
  },
  {
    question: "SKR/HRフィルターとは何ですか？",
    answer: "サービスレベル（SKR/HR）でセラピストを絞り込める機能です。Standard会員は月3本投稿、またはVIP会員で利用可能です。",
  },
  {
    question: "解約はいつでもできますか？",
    answer: "はい、いつでも解約可能です。解約後も契約期間終了までは全機能をご利用いただけます。",
  },
  {
    question: "支払い方法は何がありますか？",
    answer: "クレジットカード（VISA、Mastercard、JCB、AMEX、Diners）に対応しています。",
  },
  {
    question: "投稿による機能解放は毎月リセットされますか？",
    answer: "はい、毎月1日にリセットされます。ただし料金は固定（¥4,980）のまま変わりません。投稿数に応じて使える機能が増える仕組みです。",
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
            無料会員でも口コミ投稿で3日間閲覧可能。スタンダード会員は投稿するほど使える機能が増えます。
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

        {/* Standard会員の投稿で段階的に機能が解放される説明 */}
        <div className="max-w-3xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">スタンダード会員の投稿で機能解放</h2>
            <p className="text-muted-foreground">
              料金は¥4,980固定。投稿するほど使える機能が増えます。毎月リセット。
            </p>
          </div>
          <div className="space-y-4">
            {unlockStages.map((stage, index) => (
              <div
                key={index}
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  index === 3 ? "border-amber-400/50 bg-amber-50/50" : ""
                }`}
              >
                <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  index === 3
                    ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white"
                    : "bg-primary/10 text-primary"
                }`}>
                  {stage.posts.replace("本", "")}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-muted-foreground">月{stage.posts}投稿</span>
                    <span className="font-medium">{stage.features}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{stage.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 特典セクション */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">主要機能</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Eye, title: "口コミ読み放題", description: "すべての口コミを無制限で閲覧", note: "Standard(0本)〜" },
              { icon: Search, title: "発見検索", description: "タイプxエリアxスコアで探索", note: "Standard(1本)〜" },
              { icon: BarChart3, title: "セラピスト分析", description: "レーダーチャートで詳細分析", note: "Standard(2本)〜" },
              { icon: Filter, title: "SKR/HRフィルター", description: "サービスレベルで絞り込み", note: "Standard(3本)〜 or VIP" },
            ].map((benefit, index) => (
              <Card key={index}>
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary/10">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-bold mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{benefit.description}</p>
                  <Badge variant="outline" className="text-xs">
                    {benefit.note}
                  </Badge>
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
            口コミを投稿するだけで3日間すべての口コミが閲覧可能。気に入ったら有料プランへ。
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
