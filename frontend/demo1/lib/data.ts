// タイプ定義
export const therapistTypes = [
  { id: "idol", label: "王道アイドル系", icon: "Sparkles", description: "愛嬌抜群" },
  { id: "seiso", label: "清楚なお姉さん系", icon: "Heart", description: "癒やし" },
  { id: "gal", label: "イマドキなギャル系", icon: "Zap", description: "ノリが良い" },
  { id: "model", label: "モデル・美女系", icon: "Crown", description: "高嶺の花" },
  { id: "imouto", label: "元気なフレッシュ系", icon: "Smile", description: "明るい" },
  { id: "yoen", label: "大人のお姉さん系", icon: "Flame", description: "落ち着いた雰囲気" },
] as const;

export const bodyTypes = [
  { id: "slender", label: "スレンダー" },
  { id: "normal", label: "普通" },
  { id: "glamour", label: "グラマー（巨乳）" },
  { id: "chubby", label: "ぽっちゃり" },
] as const;

export const serviceTypes = [
  { id: "kenzen", label: "健全", icon: "Leaf", description: "マッサージ重視" },
  { id: "skr", label: "SKR", icon: "Sparkles", description: "きのこ" },
  { id: "hr", label: "HR", icon: "Flame", description: "ハート" },
] as const;

export const parameterLabels = [
  { id: "conversation", label: "会話", leftLabel: "聞き上手", rightLabel: "話し上手" },
  { id: "distance", label: "距離感", leftLabel: "まったり癒やし", rightLabel: "ドキドキ密着" },
  { id: "technique", label: "施術", leftLabel: "リラックス重視", rightLabel: "ガッツリほぐし" },
  { id: "personality", label: "性格", leftLabel: "おっとりM気質", rightLabel: "ちょっとS気質" },
] as const;

export const appealTags = {
  looks: ["#もちもち肌", "#スレンダー", "#スタイル抜群", "#美脚", "#黒髪", "#派手髪"],
  personality: ["#アニメ好き", "#お酒好き", "#話し上手", "#マッサージ上手", "#丁寧"],
} as const;

export const areasData = {
  関東: {
    東京: ["渋谷", "新宿", "池袋", "六本木", "銀座", "五反田", "上野", "秋葉原", "品川", "恵比寿"],
    神奈川: ["横浜", "川崎", "武蔵小杉", "関内"],
    埼玉: ["大宮", "川口", "浦和"],
    千葉: ["千葉", "船橋", "柏"],
  },
  関西: {
    大阪: ["梅田", "難波", "心斎橋", "天王寺", "日本橋"],
    京都: ["河原町", "祇園", "四条"],
    兵庫: ["三宮", "神戸", "西宮"],
  },
  東海: {
    愛知: ["栄", "名駅", "金山", "今池"],
    静岡: ["静岡", "浜松"],
  },
  九州: {
    福岡: ["中洲", "天神", "博多"],
    熊本: ["熊本市内"],
  },
} as const;

// 配列形式のエリアデータ（検索などで使用）
export const areas = [
  { id: "tokyo", name: "東京", region: "関東", districts: ["渋谷", "新宿", "池袋", "六本木", "銀座", "五反田", "上野", "秋葉原"] },
  { id: "kanagawa", name: "神奈川", region: "関東", districts: ["横浜", "川崎", "武蔵小杉", "関内"] },
  { id: "saitama", name: "埼玉", region: "関東", districts: ["大宮", "川口", "浦和"] },
  { id: "chiba", name: "千葉", region: "関東", districts: ["千葉", "船橋", "柏"] },
  { id: "osaka", name: "大阪", region: "関西", districts: ["梅田", "難波", "心斎橋", "天王寺", "日本橋"] },
  { id: "kyoto", name: "京都", region: "関西", districts: ["河原町", "祇園", "四条"] },
  { id: "hyogo", name: "兵庫", region: "関西", districts: ["三宮", "神戸", "西宮"] },
  { id: "aichi", name: "愛知", region: "東海", districts: ["栄", "名駅", "金山", "今池"] },
  { id: "fukuoka", name: "福岡", region: "九州", districts: ["中洲", "天神", "博多"] },
] as const;

// インターフェース定義
export interface Shop {
  id: string;
  name: string;
  area: string;
  district: string;
  access: string;
  hours: string;
  priceRange: string;
  genres: string[];
  description: string;
  therapistCount: number;
  reviewCount: number;
  averageScore: number;
  rating: number;
  thumbnail: string;
  images: string[];
  courses: { name: string; duration: string; price: string }[];
}

export interface Therapist {
  id: string;
  name: string;
  age: number;
  shopId: string;
  shopName: string;
  area: string;
  district: string;
  images: string[];
  profile: {
    height: number;
    bust: string;
    waist: number;
    hip: number;
    cup: string;
  };
  comment: string;
  schedule: { [day: string]: string };
  tags: string[];
  typeId: string;
  primaryType: string;
  types: { type: string; percentage: number }[];
  bodyType: string;
  parameters: {
    conversation: number;
    distance: number;
    technique: number;
    personality: number;
  };
  reviewCount: number;
  averageScore: number;
  rating: number;
}

export interface Review {
  id: string;
  therapistId: string;
  therapistName: string;
  shopName: string;
  score: number;
  typeId: string;
  bodyType: string;
  serviceType: string;
  parameters: {
    conversation: number;
    distance: number;
    technique: number;
    personality: number;
  };
  tags: string[];
  q1FirstImpression: string;
  q2Service: string;
  q3Notes: string;
  createdAt: string;
  userId: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  memberType: "free" | "standard" | "vip";
  viewingExpiry?: string;
  monthlyReviewCount: number;
  monthlyReviewResetAt?: string;
  totalReviewCount: number;
  registeredAt: string;
  favorites: string[];
}

// 有効ティア型定義
export type EffectiveTier = "free" | "free_active" | "standard_0" | "standard_1" | "standard_2" | "vip";

// 機能解放ロジック
export function getEffectiveTier(user: User): EffectiveTier {
  if (user.memberType === "vip") {
    return "vip";
  }

  if (user.memberType === "standard") {
    const count = user.monthlyReviewCount;
    if (count >= 3) return "vip"; // VIP相当
    if (count >= 2) return "standard_2"; // 分析+掲示板
    if (count >= 1) return "standard_1"; // 発見検索
    return "standard_0"; // 読み放題のみ
  }

  // 無料会員
  if (user.viewingExpiry && new Date(user.viewingExpiry) > new Date()) {
    return "free_active"; // 3日間アクセス中
  }
  return "free";
}

// ティアごとの機能マトリクス
export const tierPermissions: Record<EffectiveTier, {
  label: string;
  color: string;
  canViewReviewBody: boolean;
  canViewScores: boolean;
  canUseDiscoverySearch: boolean;
  canUseTherapistAnalysis: boolean;
  canUseBBS: boolean;
  canUseDM: boolean;
  canUseSKRFilter: boolean;
  canUseHRFilter: boolean;
  canUseSKRList: boolean;
  canUseHRList: boolean;
  canUseAllFilters: boolean;
  canUseVIPBBS: boolean;
  favoriteLimit: number;
}> = {
  free: {
    label: "無料会員",
    color: "bg-muted text-muted-foreground",
    canViewReviewBody: false,
    canViewScores: false,
    canUseDiscoverySearch: false,
    canUseTherapistAnalysis: false,
    canUseBBS: false,
    canUseDM: false,
    canUseSKRFilter: false,
    canUseHRFilter: false,
    canUseSKRList: false,
    canUseHRList: false,
    canUseAllFilters: false,
    canUseVIPBBS: false,
    favoriteLimit: 5,
  },
  free_active: {
    label: "無料会員（閲覧中）",
    color: "bg-green-100 text-green-800",
    canViewReviewBody: true,
    canViewScores: true,
    canUseDiscoverySearch: false,
    canUseTherapistAnalysis: false,
    canUseBBS: false,
    canUseDM: false,
    canUseSKRFilter: false,
    canUseHRFilter: false,
    canUseSKRList: false,
    canUseHRList: false,
    canUseAllFilters: false,
    canUseVIPBBS: false,
    favoriteLimit: 5,
  },
  standard_0: {
    label: "スタンダード会員",
    color: "bg-primary text-primary-foreground",
    canViewReviewBody: true,
    canViewScores: true,
    canUseDiscoverySearch: false,
    canUseTherapistAnalysis: false,
    canUseBBS: false,
    canUseDM: false,
    canUseSKRFilter: false,
    canUseHRFilter: false,
    canUseSKRList: false,
    canUseHRList: false,
    canUseAllFilters: false,
    canUseVIPBBS: false,
    favoriteLimit: 999,
  },
  standard_1: {
    label: "スタンダード会員",
    color: "bg-primary text-primary-foreground",
    canViewReviewBody: true,
    canViewScores: true,
    canUseDiscoverySearch: true,
    canUseTherapistAnalysis: false,
    canUseBBS: false,
    canUseDM: false,
    canUseSKRFilter: false,
    canUseHRFilter: false,
    canUseSKRList: false,
    canUseHRList: false,
    canUseAllFilters: false,
    canUseVIPBBS: false,
    favoriteLimit: 999,
  },
  standard_2: {
    label: "スタンダード会員",
    color: "bg-primary text-primary-foreground",
    canViewReviewBody: true,
    canViewScores: true,
    canUseDiscoverySearch: true,
    canUseTherapistAnalysis: true,
    canUseBBS: true,
    canUseDM: true,
    canUseSKRFilter: false,
    canUseHRFilter: false,
    canUseSKRList: false,
    canUseHRList: false,
    canUseAllFilters: false,
    canUseVIPBBS: false,
    favoriteLimit: 999,
  },
  vip: {
    label: "VIP会員",
    color: "bg-gradient-to-r from-amber-500 to-amber-400 text-white",
    canViewReviewBody: true,
    canViewScores: true,
    canUseDiscoverySearch: true,
    canUseTherapistAnalysis: true,
    canUseBBS: true,
    canUseDM: true,
    canUseSKRFilter: true,
    canUseHRFilter: true,
    canUseSKRList: true,
    canUseHRList: true,
    canUseAllFilters: true,
    canUseVIPBBS: true,
    favoriteLimit: 999,
  },
};

// モックデータ
export const mockShops: Shop[] = [
  {
    id: "shop1",
    name: "アロマモア",
    area: "東京",
    district: "渋谷",
    access: "渋谷駅徒歩5分",
    hours: "12:00〜翌3:00",
    priceRange: "60分 ¥15,000〜",
    genres: ["日本人", "アロマ", "リンパ"],
    description: "渋谷エリアNo.1の人気店。厳選されたセラピストによる極上の癒しをお届けします。",
    therapistCount: 25,
    reviewCount: 342,
    averageScore: 85,
    rating: 4.5,
    thumbnail: "https://images.unsplash.com/photo-1540555700478-4be289fbec6c?w=200&h=200&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1540555700478-4be289fbec6c?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=400&fit=crop",
    ],
    courses: [
      { name: "スタンダードコース", duration: "60分", price: "¥15,000" },
      { name: "スタンダードコース", duration: "90分", price: "¥22,000" },
      { name: "プレミアムコース", duration: "120分", price: "¥30,000" },
    ],
  },
  {
    id: "shop2",
    name: "Premium Salon 新宿",
    area: "東京",
    district: "新宿",
    access: "新宿駅徒歩3分",
    hours: "11:00〜翌2:00",
    priceRange: "60分 ¥18,000〜",
    genres: ["日本人", "高級", "完全個室"],
    description: "新宿の隠れ家的高級サロン。ワンランク上の癒しを体験できます。",
    therapistCount: 18,
    reviewCount: 256,
    averageScore: 88,
    rating: 4.7,
    thumbnail: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=200&h=200&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=800&h=400&fit=crop",
    ],
    courses: [
      { name: "ベーシックコース", duration: "60分", price: "¥18,000" },
      { name: "スペシャルコース", duration: "90分", price: "¥26,000" },
    ],
  },
  {
    id: "shop3",
    name: "Healing Room 池袋",
    area: "東京",
    district: "池袋",
    access: "池袋駅徒歩4分",
    hours: "10:00〜24:00",
    priceRange: "60分 ¥12,000〜",
    genres: ["日本人", "アロマ", "リーズナブル"],
    description: "コスパ抜群の人気店。初めての方にもおすすめです。",
    therapistCount: 32,
    reviewCount: 478,
    averageScore: 82,
    rating: 4.3,
    thumbnail: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=200&h=200&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&h=400&fit=crop",
    ],
    courses: [
      { name: "お試しコース", duration: "45分", price: "¥10,000" },
      { name: "スタンダードコース", duration: "60分", price: "¥12,000" },
      { name: "ロングコース", duration: "90分", price: "¥18,000" },
    ],
  },
];

export const mockTherapists: Therapist[] = [
  {
    id: "1",
    name: "田中まりあ",
    age: 24,
    shopId: "shop1",
    shopName: "アロマモア",
    area: "東京",
    district: "渋谷",
    images: [
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=500&fit=crop",
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=500&fit=crop",
      "https://images.unsplash.com/photo-1526510747491-27d6c46fa63d?w=400&h=500&fit=crop",
    ],
    profile: { height: 160, bust: "86(D)", waist: 58, hip: 85, cup: "D" },
    comment: "癒しの時間をお届けします♪ 会話も施術も全力で楽しみましょう！",
    schedule: { 月: "12:00-20:00", 火: "休", 水: "14:00-22:00", 木: "12:00-20:00", 金: "14:00-22:00", 土: "10:00-18:00", 日: "10:00-18:00" },
    tags: ["#ギャル系", "#グラマー", "#ドキドキ", "#会話上手"],
    typeId: "gal",
    primaryType: "gal",
    types: [{ type: "ギャル系", percentage: 80 }, { type: "アイドル系", percentage: 20 }],
    bodyType: "glamour",
    parameters: { conversation: 5, distance: 4, technique: 4, personality: 5 },
    reviewCount: 48,
    averageScore: 87,
    rating: 4.4,
  },
  {
    id: "2",
    name: "佐藤みさき",
    age: 26,
    shopId: "shop2",
    shopName: "Premium Salon 新宿",
    area: "東京",
    district: "新宿",
    images: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop",
    ],
    profile: { height: 165, bust: "82(C)", waist: 56, hip: 84, cup: "C" },
    comment: "丁寧な施術を心がけています。お疲れの身体を癒させてください。",
    schedule: { 月: "11:00-19:00", 火: "11:00-19:00", 水: "休", 木: "13:00-21:00", 金: "13:00-21:00", 土: "休", 日: "11:00-19:00" },
    tags: ["#清楚系", "#モデル級", "#技術派", "#美脚"],
    typeId: "seiso",
    primaryType: "seiso",
    types: [{ type: "清楚系", percentage: 60 }, { type: "モデル系", percentage: 40 }],
    bodyType: "slender",
    parameters: { conversation: 4, distance: 3, technique: 5, personality: 3 },
    reviewCount: 35,
    averageScore: 91,
    rating: 4.6,
  },
  {
    id: "3",
    name: "鈴木ゆい",
    age: 22,
    shopId: "shop3",
    shopName: "Healing Room 池袋",
    area: "東京",
    district: "池袋",
    images: [
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=500&fit=crop",
    ],
    profile: { height: 155, bust: "80(B)", waist: 54, hip: 82, cup: "B" },
    comment: "元気いっぱいに癒します！お話するの大好きです♪",
    schedule: { 月: "10:00-18:00", 火: "10:00-18:00", 水: "10:00-18:00", 木: "休", 金: "12:00-20:00", 土: "12:00-20:00", 日: "休" },
    tags: ["#アイドル系", "#愛嬌抜群", "#癒し系", "#もちもち肌"],
    typeId: "idol",
    primaryType: "idol",
    types: [{ type: "アイドル系", percentage: 70 }, { type: "フレッシュ系", percentage: 30 }],
    bodyType: "normal",
    parameters: { conversation: 5, distance: 3, technique: 3, personality: 4 },
    reviewCount: 62,
    averageScore: 84,
    rating: 4.2,
  },
  {
    id: "4",
    name: "高橋れいな",
    age: 28,
    shopId: "shop1",
    shopName: "アロマモア",
    area: "東京",
    district: "渋谷",
    images: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop",
    ],
    profile: { height: 168, bust: "88(E)", waist: 60, hip: 88, cup: "E" },
    comment: "大人の癒しをお届けします。非日常の時間を一緒に過ごしましょう。",
    schedule: { 月: "18:00-翌2:00", 火: "18:00-翌2:00", 水: "休", 木: "18:00-翌2:00", 金: "18:00-翌3:00", 土: "18:00-翌3:00", 日: "休" },
    tags: ["#大人系", "#大人", "#テクニシャン", "#巨乳"],
    typeId: "yoen",
    primaryType: "yoen",
    types: [{ type: "大人系", percentage: 90 }, { type: "モデル系", percentage: 10 }],
    bodyType: "glamour",
    parameters: { conversation: 4, distance: 5, technique: 5, personality: 4 },
    reviewCount: 28,
    averageScore: 93,
    rating: 4.8,
  },
  {
    id: "5",
    name: "山本ここあ",
    age: 21,
    shopId: "shop3",
    shopName: "Healing Room 池袋",
    area: "東京",
    district: "池袋",
    images: [
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=500&fit=crop",
    ],
    profile: { height: 152, bust: "78(A)", waist: 52, hip: 80, cup: "A" },
    comment: "元気いっぱいに癒します♪ リラックスしてもらえると嬉しいです！",
    schedule: { 月: "休", 火: "14:00-22:00", 水: "14:00-22:00", 木: "14:00-22:00", 金: "休", 土: "10:00-18:00", 日: "10:00-18:00" },
    tags: ["#フレッシュ系", "#甘え上手", "#ふわふわ", "#黒髪"],
    typeId: "imouto",
    primaryType: "imouto",
    types: [{ type: "フレッシュ系", percentage: 85 }, { type: "アイドル系", percentage: 15 }],
    bodyType: "slender",
    parameters: { conversation: 4, distance: 4, technique: 3, personality: 5 },
    reviewCount: 41,
    averageScore: 86,
    rating: 4.3,
  },
  {
    id: "6",
    name: "伊藤あやか",
    age: 25,
    shopId: "shop2",
    shopName: "Premium Salon 新宿",
    area: "東京",
    district: "新宿",
    images: [
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=500&fit=crop",
    ],
    profile: { height: 170, bust: "84(C)", waist: 58, hip: 86, cup: "C" },
    comment: "モデル経験あり。美しさと癒しをお届けします。",
    schedule: { 月: "13:00-21:00", 火: "休", 水: "13:00-21:00", 木: "13:00-21:00", 金: "15:00-23:00", 土: "15:00-23:00", 日: "休" },
    tags: ["#モデル系", "#美女", "#高身長", "#美脚"],
    typeId: "model",
    primaryType: "model",
    types: [{ type: "モデル系", percentage: 95 }, { type: "清楚系", percentage: 5 }],
    bodyType: "slender",
    parameters: { conversation: 3, distance: 3, technique: 4, personality: 3 },
    reviewCount: 23,
    averageScore: 89,
    rating: 4.5,
  },
];

export const mockReviews: Review[] = [
  {
    id: "r1",
    therapistId: "1",
    therapistName: "田中まりあ",
    shopName: "アロマモア",
    score: 90,
    typeId: "gal",
    bodyType: "glamour",
    serviceType: "skr",
    parameters: { conversation: 5, distance: 4, technique: 4, personality: 5 },
    tags: ["#ギャル系", "#グラマー", "#会話上手"],
    q1FirstImpression: "写真より可愛くてびっくり！明るい笑顔で出迎えてくれました。",
    q2Service: "会話がとても楽しく、施術も丁寧。時間があっという間に過ぎました。技術もしっかりしていてコリがほぐれました。",
    q3Notes: "人気なので予約は早めがおすすめ。土日は特に取りにくいです。",
    createdAt: "2024-01-15",
    userId: "user1",
  },
  {
    id: "r2",
    therapistId: "1",
    therapistName: "田中まりあ",
    shopName: "アロマモア",
    score: 85,
    typeId: "gal",
    bodyType: "glamour",
    serviceType: "kenzen",
    parameters: { conversation: 5, distance: 4, technique: 3, personality: 5 },
    tags: ["#ギャル系", "#会話上手", "#彼氏感"],
    q1FirstImpression: "元気で明るい子。写真通りでした。",
    q2Service: "とにかく会話が楽しい。施術より会話メインになってしまった。",
    q3Notes: "マッサージ重視の人には向かないかも。",
    createdAt: "2024-01-10",
    userId: "user2",
  },
  {
    id: "r3",
    therapistId: "2",
    therapistName: "佐藤みさき",
    shopName: "Premium Salon 新宿",
    score: 95,
    typeId: "seiso",
    bodyType: "slender",
    serviceType: "kenzen",
    parameters: { conversation: 4, distance: 3, technique: 5, personality: 3 },
    tags: ["#清楚系", "#技術派", "#モデル級"],
    q1FirstImpression: "上品で美しい方。緊張しました。",
    q2Service: "施術がとにかく上手い。本格的なマッサージで身体が軽くなりました。",
    q3Notes: "静かに癒されたい人向け。ワイワイしたい人には不向き。",
    createdAt: "2024-01-12",
    userId: "user3",
  },
  {
    id: "r4",
    therapistId: "3",
    therapistName: "鈴木ゆい",
    shopName: "Healing Room 池袋",
    score: 88,
    typeId: "idol",
    bodyType: "normal",
    serviceType: "kenzen",
    parameters: { conversation: 5, distance: 4, technique: 3, personality: 4 },
    tags: ["#アイドル系", "#愛嬌抜群", "#癒し系"],
    q1FirstImpression: "可愛すぎる！アイドルみたい。",
    q2Service: "とにかく癒される。笑顔が最高で元気をもらえました。",
    q3Notes: "技術はまだ発展途上かも。でもそれを補う魅力がある。",
    createdAt: "2024-01-08",
    userId: "user1",
  },
  {
    id: "r5",
    therapistId: "4",
    therapistName: "高橋れいな",
    shopName: "アロマモア",
    score: 96,
    typeId: "yoen",
    bodyType: "glamour",
    serviceType: "hr",
    parameters: { conversation: 4, distance: 5, technique: 5, personality: 4 },
    tags: ["#大人系", "#テクニシャン", "#大人"],
    q1FirstImpression: "色気がすごい。大人の魅力。",
    q2Service: "経験豊富なのがわかる。全てにおいて完璧でした。",
    q3Notes: "VIP価格だが、それだけの価値はある。",
    createdAt: "2024-01-05",
    userId: "user4",
  },
];

// ヘルパー関数
export function getTherapistById(id: string): Therapist | undefined {
  return mockTherapists.find((t) => t.id === id);
}

export function getShopById(id: string): Shop | undefined {
  return mockShops.find((s) => s.id === id);
}

export function getReviewsByTherapistId(therapistId: string): Review[] {
  return mockReviews.filter((r) => r.therapistId === therapistId);
}

export function getTherapistsByShopId(shopId: string): Therapist[] {
  return mockTherapists.filter((t) => t.shopId === shopId);
}

export function getTherapistsByType(typeId: string): Therapist[] {
  return mockTherapists.filter((t) => t.typeId === typeId);
}

export function getTherapistsByArea(area: string, district?: string): Therapist[] {
  return mockTherapists.filter((t) => {
    if (district) {
      return t.area === area && t.district === district;
    }
    return t.area === area;
  });
}

export function getSimilarTherapists(therapist: Therapist, limit = 5): Therapist[] {
  return mockTherapists
    .filter((t) => t.id !== therapist.id)
    .sort((a, b) => {
      // 同じタイプを優先
      const aTypeMatch = a.typeId === therapist.typeId ? 10 : 0;
      const bTypeMatch = b.typeId === therapist.typeId ? 10 : 0;
      // 同じスタイルを優先
      const aBodyMatch = a.bodyType === therapist.bodyType ? 5 : 0;
      const bBodyMatch = b.bodyType === therapist.bodyType ? 5 : 0;
      return (bTypeMatch + bBodyMatch) - (aTypeMatch + aBodyMatch);
    })
    .slice(0, limit);
}

// エイリアス（後方互換性のため）
export const therapists = mockTherapists;
export const shops = mockShops;
export const reviews = mockReviews;
