"use client";

import {
  Lock, Star, ChevronRight, Crown, Eye, Flame, Sparkles, Unlock,
  Coins, ThumbsUp, Award, Heart, TrendingUp,
  User, Clock, MessageCircle, Shield, BookOpen, ArrowRight, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const mockReview = {
  therapistName: "あおい",
  therapistAge: 28,
  therapistImage: "http://127.0.0.1:54321/storage/v1/object/public/therapist-images/3059/210069/001.webp",
  salonName: "SALON BLANCA (サロンブランカ)",
  score: 75,
  typeLabel: "女優系",
  bodyLabel: "スレンダー",
  serviceLabel: "HR",
  userName: "ニコろーずさん",
  reviewerLevel: 3,
  viewCount: 342,
  helpfulCount: 18,
  realCount: 12,
  commentFirstImpression: "顔は隠されているが整った印象である。可愛い系ではなく美人系に分類される。修正は特にないと思われる。実",
  createdAt: "2026-02-15",
};

const blurredText = "会話がとても楽しく、施術も丁寧。時間があっという間に過ぎました。技術もしっかりしていてコリがほぐれました。接客態度も素晴らしく、また指名したいと思いました。";
const blurredText2 = "シャワー浴びて横になったら、足からマッサージスタート。本格的すぎて全然ドキドキしなかった。ってか足ツボが痛すぎて叫びそうになったレベル。こっちは癒されに来てるのに、ただの整体受けてる気分。";
const blurredText3 = "金額は覚えてないけど、このお店の通常料金。ただ、足ツボマッサージに高い金払った感じで全然コスパ良くなかった。同じ値段出すなら他の子選んだ方がいい。";

export default function PreviewReviewsPage() {
  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-16">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">A-3 バリエーション 3種</h1>
        <p className="text-sm text-muted-foreground">写真大 + サイドスコア / バナーにセラピスト名入り</p>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-2 text-primary">A-3a: 2行バナー（サロン名 + セラピスト名）</h2>
        <p className="text-xs text-muted-foreground mb-4">バナー上段にサロン名、下段にセラピスト名。情報が一目でわかる</p>
        <PatternA3a />
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2 text-primary">A-3b: バナー1行統合（サロン×セラピスト）</h2>
        <p className="text-xs text-muted-foreground mb-4">「サロン名 - セラピスト名」を1行で。コンパクトかつ明快</p>
        <PatternA3b />
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2 text-primary">A-3c: バナーにセラピスト名大 + サロン名小</h2>
        <p className="text-xs text-muted-foreground mb-4">セラピスト名を主役に。サロン名は補助情報として小さく</p>
        <PatternA3c />
      </section>
    </div>
  );
}

/* ============================================================
   共通パーツ: スコア円 + ぼかしエリア + 星バー
   ============================================================ */
function ScoreCircle() {
  return (
    <div className="relative w-16 h-16">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
        <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray={`${mockReview.score}, 100`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-primary leading-none">{mockReview.score}</span>
        <span className="text-[8px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function BlurredArea() {
  return (
    <div className="relative px-5">
      <div className="select-none pointer-events-none text-sm leading-relaxed space-y-3" style={{ filter: "blur(5px)" }}>
        <div><p className="font-medium text-xs text-muted-foreground mb-1">スタイル</p><p>{blurredText}</p></div>
        <div><p className="font-medium text-xs text-muted-foreground mb-1">施術の流れ</p><p>{blurredText2}</p></div>
        <div><p className="font-medium text-xs text-muted-foreground mb-1">どこまでいけた</p><p>{blurredText3}</p></div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Button className="gap-2 shadow-2xl bg-primary hover:bg-primary/90 hover:scale-105 transition-transform" size="lg">
          <Lock className="h-4 w-4" />モザイクを外すには<ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StarBar() {
  return (
    <div className="px-5 py-2 bg-blue-50/50 border-b flex items-center justify-between">
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">オススメ度</span>
        {[...Array(5)].map((_, i) => (
          <Star key={i} className={`h-4 w-4 ${i < 4 ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{mockReview.viewCount}</span>
        <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{mockReview.helpfulCount}</span>
      </div>
    </div>
  );
}

function BottomCTA() {
  return (
    <div className="p-4 border-t mt-4">
      <Button className="w-full gap-2 bg-gradient-to-r from-primary to-blue-600" size="lg">
        このセラピストの詳細を見る<ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ============================================================
   A-3a: 2行バナー（サロン名 + セラピスト名）
   ============================================================ */
function PatternA3a() {
  return (
    <Card className="overflow-hidden shadow-md">
      {/* バナー: 2行構成 */}
      <div className="bg-gradient-to-r from-primary to-blue-600 px-5 py-3">
        <h3 className="text-white font-bold text-base">{mockReview.salonName}</h3>
        <p className="text-blue-100 text-sm mt-0.5">
          <span className="text-white font-bold">{mockReview.therapistName} ({mockReview.therapistAge})</span> さんの口コミ体験レポート
        </p>
      </div>
      <CardContent className="p-0">
        <div className="p-5 flex gap-5 border-b">
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mockReview.therapistImage} alt="" className="w-28 h-28 rounded-xl object-cover shadow-md" />
            <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0 text-[10px] whitespace-nowrap">
              <Crown className="h-2.5 w-2.5 mr-0.5" />プレミアム口コミ
            </Badge>
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex gap-1 mt-1">
                {[mockReview.typeLabel, mockReview.bodyLabel, mockReview.serviceLabel].map((l) => (
                  <Badge key={l} variant="secondary" className="text-[10px]">{l}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-end justify-between mt-2">
              <div className="text-xs text-muted-foreground">
                <p>投稿者: <span className="text-primary font-medium">{mockReview.userName}</span></p>
                <p className="flex items-center gap-1 mt-0.5">
                  <Award className="h-3 w-3" />Lv.{mockReview.reviewerLevel}
                  <span className="mx-1">·</span>
                  <Clock className="h-3 w-3" />{mockReview.createdAt}
                </p>
              </div>
              <ScoreCircle />
            </div>
          </div>
        </div>

        <StarBar />

        <div className="px-5 pt-4 pb-2">
          <p className="text-sm leading-relaxed">{mockReview.commentFirstImpression}...</p>
        </div>

        <BlurredArea />
        <BottomCTA />
      </CardContent>
    </Card>
  );
}

/* ============================================================
   A-3b: バナー1行統合（サロン × セラピスト）
   ============================================================ */
function PatternA3b() {
  return (
    <Card className="overflow-hidden shadow-md">
      {/* バナー: 1行統合 */}
      <div className="bg-gradient-to-r from-primary to-blue-600 px-5 py-3 flex items-center justify-between">
        <h3 className="text-white font-bold text-sm">
          {mockReview.salonName} — {mockReview.therapistName} ({mockReview.therapistAge})
        </h3>
        <Badge className="bg-white/20 text-white border-0 text-[10px] flex-shrink-0 ml-2">
          <Flame className="h-2.5 w-2.5 mr-0.5 text-orange-300" />HOT
        </Badge>
      </div>
      <CardContent className="p-0">
        <div className="p-5 flex gap-5 border-b">
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mockReview.therapistImage} alt="" className="w-28 h-28 rounded-xl object-cover shadow-md" />
            <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0 text-[10px] whitespace-nowrap">
              <Crown className="h-2.5 w-2.5 mr-0.5" />プレミアム口コミ
            </Badge>
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <p className="text-xs text-muted-foreground">口コミ体験レポート</p>
              <div className="flex gap-1 mt-2">
                {[mockReview.typeLabel, mockReview.bodyLabel, mockReview.serviceLabel].map((l) => (
                  <Badge key={l} variant="secondary" className="text-[10px]">{l}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-end justify-between mt-2">
              <div className="text-xs text-muted-foreground">
                <p>{mockReview.userName}</p>
                <p className="flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" />{mockReview.createdAt}</p>
              </div>
              <ScoreCircle />
            </div>
          </div>
        </div>

        <StarBar />

        <div className="px-5 pt-4 pb-2">
          <p className="text-sm leading-relaxed">{mockReview.commentFirstImpression}...</p>
        </div>

        <BlurredArea />
        <BottomCTA />
      </CardContent>
    </Card>
  );
}

/* ============================================================
   A-3c: バナーにセラピスト名大 + サロン名小
   ============================================================ */
function PatternA3c() {
  return (
    <Card className="overflow-hidden shadow-md">
      {/* バナー: セラピスト名主役 */}
      <div className="bg-gradient-to-r from-primary to-blue-600 px-5 py-4">
        <p className="text-blue-200 text-xs">{mockReview.salonName}</p>
        <h3 className="text-white font-bold text-xl mt-0.5">
          {mockReview.therapistName} ({mockReview.therapistAge})
          <span className="text-blue-200 font-normal text-sm ml-2">の口コミ体験レポート</span>
        </h3>
      </div>
      <CardContent className="p-0">
        <div className="p-5 flex gap-5 border-b">
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mockReview.therapistImage} alt="" className="w-28 h-28 rounded-xl object-cover shadow-md" />
            <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0 text-[10px] whitespace-nowrap">
              <Crown className="h-2.5 w-2.5 mr-0.5" />プレミアム口コミ
            </Badge>
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex gap-1 mt-1">
                {[mockReview.typeLabel, mockReview.bodyLabel, mockReview.serviceLabel].map((l) => (
                  <Badge key={l} variant="secondary" className="text-[10px]">{l}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-end justify-between mt-2">
              <div className="text-xs text-muted-foreground">
                <p>投稿者: <span className="text-primary font-medium">{mockReview.userName}</span></p>
                <p className="flex items-center gap-1 mt-0.5">
                  <Award className="h-3 w-3" />Lv.{mockReview.reviewerLevel}
                  <span className="mx-1">·</span>
                  <Clock className="h-3 w-3" />{mockReview.createdAt}
                </p>
              </div>
              <ScoreCircle />
            </div>
          </div>
        </div>

        <StarBar />

        <div className="px-5 pt-4 pb-2">
          <p className="text-sm leading-relaxed">{mockReview.commentFirstImpression}...</p>
        </div>

        <BlurredArea />
        <BottomCTA />
      </CardContent>
    </Card>
  );
}
