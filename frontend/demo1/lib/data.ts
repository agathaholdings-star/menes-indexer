// タイプ定義
export const therapistTypes = [
  { id: "idol", label: "王道アイドル系", icon: "Sparkles", description: "愛嬌抜群" },
  { id: "seiso", label: "清楚なお姉さん系", icon: "Heart", description: "癒やし" },
  { id: "gal", label: "イマドキなギャル系", icon: "Zap", description: "ノリが良い" },
  { id: "model", label: "モデル・美女系", icon: "Crown", description: "高嶺の花" },
  { id: "imouto", label: "元気なフレッシュ系", icon: "Smile", description: "明るい" },
  { id: "yoen", label: "大人のお姉さん系", icon: "Flame", description: "落ち着いた雰囲気" },
] as const;

export type TherapistType = typeof therapistTypes[number];

export const bodyTypes = [
  { id: "slender", label: "スレンダー" },
  { id: "normal", label: "普通" },
  { id: "glamour", label: "グラマー（巨乳）" },
  { id: "chubby", label: "ぽっちゃり" },
] as const;

export type BodyType = typeof bodyTypes[number];

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
  userName?: string;
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
  standard_1: {
    label: "スタンダード会員",
    color: "bg-primary text-primary-foreground",
    canViewReviewBody: true,
    canViewScores: true,
    canUseDiscoverySearch: true,
    canUseTherapistAnalysis: false,
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

