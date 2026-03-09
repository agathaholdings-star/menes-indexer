"use client";

import Link from "next/link";
import {
  Check,
  PenSquare,
  Eye,
  Sparkles,
  Flame,
  Gem,
  ChevronRight,
  TrendingUp,
  Crown,
  ShieldCheck,
  ImageIcon,
  EyeOff,
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
      "はい、クレジットの有効期限は付与から7日間です。期限内にご利用ください。期限が切れても、新たに口コミを投稿すればクレジットが再付与されます。",
  },
  {
    question: "スクショ付き投稿のボーナスとは？",
    answer:
      "予約時に届くSMS（ショートメッセージ）のスクリーンショットを口コミと一緒に送信すると、来店証明としてボーナス5クレジットが追加されます（合計10クレジット）。画像は運営のみが確認し、安全に保管されます。個人情報が気になる方はモザイク加工してからの送信もOKです。",
  },
  {
    question: "SKRフィルターとは？",
    answer:
      "口コミを2件投稿すると解放される検索フィルターです。SKR対応のセラピストを絞り込めます。",
  },
  {
    question: "HRフィルターとは？",
    answer:
      "口コミを3件投稿すると解放される検索フィルターです。HR対応のセラピストを絞り込めます。",
  },
  {
    question: "機能解放は永久ですか？",
    answer:
      "はい。投稿数に応じた機能解放（SKR・HRフィルター）は永久です。一度解放されれば、クレジットが切れても引き続き使えます。",
  },
];

const tiers = [
  {
    reviews: 1,
    title: "1件投稿",
    description: "口コミ閲覧が解放",
    badge: null,
    highlight: true,
    credits: "5クレジット",
    creditsWithScreenshot: "10クレジット",
    features: [
      { label: "口コミ全文の閲覧", icon: Eye, included: true },
      { label: "エリア・店舗検索", icon: null, included: true },
      { label: "セラピスト一覧", icon: null, included: true },
      { label: "お気に入り登録", icon: null, included: true },
      { label: "SKRフィルター", icon: Flame, included: false },
      { label: "HRフィルター", icon: Gem, included: false },
    ],
  },
  {
    reviews: 2,
    title: "2件投稿",
    description: "SKRフィルター解放",
    badge: null,
    highlight: false,
    credits: "累計10クレジット",
    creditsWithScreenshot: "累計20クレジット",
    features: [
      { label: "口コミ全文の閲覧", icon: Eye, included: true },
      { label: "エリア・店舗検索", icon: null, included: true },
      { label: "セラピスト一覧", icon: null, included: true },
      { label: "お気に入り登録", icon: null, included: true },
      { label: "SKRフィルター", icon: Flame, included: true, highlight: true },
      { label: "HRフィルター", icon: Gem, included: false },
    ],
  },
  {
    reviews: 3,
    title: "3件投稿",
    description: "全機能解放",
    badge: null,
    highlight: false,
    credits: "累計15クレジット",
    creditsWithScreenshot: "累計30クレジット",
    features: [
      { label: "口コミ全文の閲覧", icon: Eye, included: true },
      { label: "エリア・店舗検索", icon: null, included: true },
      { label: "セラピスト一覧", icon: null, included: true },
      { label: "お気に入り登録", icon: null, included: true },
      { label: "SKRフィルター", icon: Flame, included: true, highlight: true },
      { label: "HRフィルター", icon: Gem, included: true, highlight: true },
    ],
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
            口コミを書くほど、できることが増える
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            すべて無料。口コミの投稿数に応じて機能が解放されます。
          </p>
        </div>

        {/* 3カラムの投稿数ベース表示 */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16 items-start">
          {tiers.map((tier) => (
            <Card
              key={tier.reviews}
              className={`relative ${
                tier.highlight
                  ? "border-primary shadow-xl md:scale-105 md:-my-4 z-10"
                  : ""
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1 bg-primary">
                    <Crown className="h-3 w-3" />
                    {tier.badge}
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-4 pt-8">
                <CardTitle className="text-xl">{tier.title}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">¥0</span>
                  <span className="text-muted-foreground"> / 永久</span>
                </div>
              </CardHeader>
              <CardContent>
                {/* クレジット付与 */}
                <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm space-y-1">
                  <p className="flex items-center gap-1">
                    <PenSquare className="h-3.5 w-3.5 text-primary" />
                    テキストのみ: <span className="font-medium">{tier.credits}</span>
                  </p>
                  <p className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    スクショ付き: <span className="font-medium text-amber-700">{tier.creditsWithScreenshot}</span>
                  </p>
                </div>

                {/* 機能リスト */}
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      {feature.included ? (
                        <Check
                          className={`h-5 w-5 flex-shrink-0 ${
                            feature.highlight ? "text-amber-500" : "text-primary"
                          }`}
                        />
                      ) : (
                        <span className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-muted" />
                      )}
                      <span
                        className={`flex items-center gap-1.5 ${
                          feature.highlight
                            ? "text-amber-700 font-medium"
                            : !feature.included
                            ? "text-muted-foreground"
                            : ""
                        }`}
                      >
                        {feature.icon && (
                          <feature.icon
                            className={`h-4 w-4 ${
                              feature.included
                                ? feature.icon === Flame
                                  ? "text-orange-500"
                                  : "text-purple-500"
                                : "text-muted-foreground"
                            }`}
                          />
                        )}
                        {feature.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link href="/review">
                  <Button
                    className={`w-full ${
                      tier.highlight
                        ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                        : ""
                    }`}
                    variant={tier.highlight ? "default" : "outline"}
                  >
                    口コミを投稿する
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* クレジット仕組み説明 */}
        <div className="max-w-3xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">仕組み</h2>
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
                  "セラピストページから口コミを投稿すると、承認後に5クレジットが付与されます。",
                highlight: false,
              },
              {
                icon: Sparkles,
                title: "スクショ添付でボーナス（+5クレジット）",
                description:
                  "予約時のSMS（ショートメッセージ）のスクリーンショットを添付すると、来店証明としてボーナス5クレジットが追加されます（合計10クレジット）。",
                highlight: true,
              },
              {
                icon: Eye,
                title: "口コミを閲覧",
                description:
                  "1クレジットで1セラピストの口コミを全件閲覧可能。気になるセラピストに使いましょう。",
                highlight: false,
              },
              {
                icon: TrendingUp,
                title: "投稿するほど機能解放",
                description:
                  "2件目でSKRフィルター、3件目でHRフィルターが永久に解放。書くほどサイトが便利になります。",
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

        {/* スクショ付き投稿の安全性説明 */}
        <div className="max-w-3xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">スクショ付き投稿について</h2>
            <p className="text-muted-foreground">
              予約時のSMSスクリーンショットで来店を証明すると、ボーナスクレジットが付与されます。
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg border">
              <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium mb-1">予約SMSのスクリーンショットを添付</h3>
                <p className="text-sm text-muted-foreground">
                  予約時に届くショートメッセージ（SMS）のスクリーンショットを口コミと一緒に送信してください。実際に来店したことの証明になります。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-lg border border-green-200/50 bg-green-50/30">
              <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-green-100 text-green-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium mb-1">個人情報は安全に保管されます</h3>
                <p className="text-sm text-muted-foreground">
                  送信された画像はセキュリティが確保された環境で安全に保管され、運営スタッフのみが確認します。外部に個人情報が漏れることはありません。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-lg border">
              <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                <EyeOff className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium mb-1">個人情報の加工もOK</h3>
                <p className="text-sm text-muted-foreground">
                  ご心配な方は、電話番号や名前など個人情報の部分をモザイクで消すか、見えないように加工してから送信いただいても問題ありません。
                </p>
              </div>
            </div>
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
            まずは1件、口コミを書いてみよう
          </h2>
          <p className="text-muted-foreground mb-6">
            口コミを投稿するだけでクレジットを獲得。気になるセラピストの口コミを無料で閲覧できます。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/review">
              <Button size="lg" className="gap-2">
                <PenSquare className="h-4 w-4" />
                口コミを投稿する
              </Button>
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
