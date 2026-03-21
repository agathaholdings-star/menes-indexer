"use client";

import { useState } from "react";
import { ReviewCard } from "@/components/shared/review-card";
import type { Review } from "@/lib/data";

const mockReview: Review = {
  id: "mock-1",
  therapistId: "12345",
  therapistName: "一宮ゆい",
  salonName: "東京【アロマモア】恵比寿店",
  score: 82,
  typeId: "6",
  bodyType: "2",
  serviceType: "2",
  parameters: { conversation: 70, distance: 80, technique: 75, personality: 65 },
  tags: [],
  commentReason: "",
  commentFirstImpression: "写真より可愛くてびっくり！とても明るい笑顔で出迎えてくれて、初めての緊張が一気にほぐれました。雰囲気も良くて安心感がありました。",
  commentStyle: "",
  commentService: "まずシャワーを浴びてからベッドへ。足元からゆっくりとマッサージが始まり、力加減も絶妙。会話も弾んで、あっという間の90分でした。途中から密着度が増して、ドキドキ感もしっかり。施術の丁寧さと程よい距離感のバランスが最高でした。",
  commentServiceDetail: "",
  commentCost: "",
  commentRevisit: "",
  commentAdvice: "予約は早めが吉。人気セラピストなので週末は埋まりやすいです。初回は電話予約がスムーズでした。",
  createdAt: "2026-03-06T10:00:00Z",
  userId: "user-1",
  userName: "エフィ",
  realCount: 3,
  fakeCount: 0,
  viewCount: 1240,
  helpfulCount: 18,
  reviewerLevel: 2,
  verificationImagePath: null,
};

const mockImage = "https://oycayfewhqrezvhbbhzm.supabase.co/storage/v1/object/public/therapist-images/12345/1.jpg";

const styles = [
  { key: "default" as const, label: "現行 Default", desc: "青バナー+写真+スコア円。情報量が多く信頼感がある" },
  { key: "magazine" as const, label: "A: Magazine", desc: "大きな画像ヘッダー+引用風テキスト。ビジュアルインパクト重視" },
  { key: "compact" as const, label: "B: Compact", desc: "画像左+情報右の横並び。ME競合に近い。スキャンしやすい" },
  { key: "social" as const, label: "C: Social", desc: "丸アバター+チャットバブル。SNS投稿風。親しみやすい" },
];

export default function MockPage() {
  const [selected, setSelected] = useState<"default" | "magazine" | "compact" | "social">("default");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">口コミカード デザイン比較</h1>
        <p className="text-sm text-muted-foreground mb-6">同じ口コミデータを4パターンで表示。タブで切り替えて比較できます。</p>

        {/* タブ切り替え */}
        <div className="flex flex-wrap gap-2 mb-6">
          {styles.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selected === key
                  ? "bg-primary text-white shadow-md"
                  : "bg-white text-muted-foreground border hover:bg-muted/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 説明 */}
        <p className="text-sm text-muted-foreground mb-4 bg-white rounded-lg px-4 py-3 border">
          {styles.find(s => s.key === selected)?.desc}
        </p>

        {/* ブラー版 */}
        <h2 className="text-sm font-bold text-muted-foreground mb-2 mt-6">未ログイン時（ブラーあり）</h2>
        <ReviewCard
          review={mockReview}
          isBlurred={true}
          therapistImageUrl={mockImage}
          cardStyle={selected}
        />

        {/* フル表示版 */}
        <h2 className="text-sm font-bold text-muted-foreground mb-2 mt-8">ログイン時（フル表示）</h2>
        <ReviewCard
          review={mockReview}
          isBlurred={false}
          therapistImageUrl={mockImage}
          cardStyle={selected}
        />

        {/* 画像なし版 */}
        <h2 className="text-sm font-bold text-muted-foreground mb-2 mt-8">画像なし</h2>
        <ReviewCard
          review={mockReview}
          isBlurred={true}
          cardStyle={selected}
        />
      </div>
    </div>
  );
}
