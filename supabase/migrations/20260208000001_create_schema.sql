-- ============================================================
-- メンエスインデクサ 本番DBスキーマ
-- 全8テーブル: prefectures, areas, shops, shop_areas,
--              therapists, reviews, profiles, user_rewards
-- ============================================================

-- ============================================================
-- 1. prefectures（都道府県マスタ: 47件）
-- ============================================================
CREATE TABLE prefectures (
    id              int8 PRIMARY KEY,           -- JISコード（1:北海道〜47:沖縄）
    name            text NOT NULL,              -- '東京都'
    slug            text NOT NULL UNIQUE,       -- 'tokyo'
    region          text,                       -- '関東' / '関西' 等
    display_order   int                         -- 人気順（東京=1, 大阪=2...）
);

-- ============================================================
-- 2. areas（エリアマスタ: 826件）
-- ============================================================
CREATE TABLE areas (
    id              int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    prefecture_id   int8 NOT NULL REFERENCES prefectures(id),
    name            text NOT NULL,              -- '恵比寿'
    slug            text NOT NULL UNIQUE,       -- 'ebisu' ※重複時は prefecture-slug 付与
    seo_keyword     text,                       -- '恵比寿 メンズエステ'
    seo_title       text,                       -- SEOタイトル（AI生成 or テンプレ）
    seo_description text,                       -- AI生成 300-500文字
    meta_description text,                      -- AI生成 120-160文字
    search_volume   int,                        -- DataForSEO検索ボリューム
    source_type     text,                       -- 'parent' / 'station' / 'city'
    data_source_url text,                       -- esthe-rankingの元URL
    parent_group    text,                       -- 親グループ名（近隣エリア表示用）
    nearby_areas    text,                       -- パイプ区切り近隣エリア
    salon_count     int DEFAULT 0,              -- キャッシュ用
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_areas_prefecture ON areas(prefecture_id);
CREATE INDEX idx_areas_slug ON areas(slug);

-- ============================================================
-- 3. shops（サロン: ~5,289件）
-- ============================================================
CREATE TABLE shops (
    id              int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    source_id       uuid,                       -- 外部ID（esthe-ranking等）
    name            text NOT NULL,              -- 'Vicca+plus.'（生の店名）
    name_kana       text,                       -- 'ヴィッカプラス'（SEO/検索用カナ）
    slug            text UNIQUE,                -- 'vicca-plus'（URL用）
    seo_title       text,                       -- '{name_kana} 口コミ | メンエスインデクサ'
    salon_overview  text,                       -- AI生成 400-600文字
    business_type   text,                       -- '店舗' / '出張' / '店舗＆出張'
    access          text,                       -- '恵比寿駅東口徒歩5分'
    business_hours  text,                       -- '09:30～翌05:00'
    base_price      int,                        -- 最安コース料金（円）
    base_duration   int,                        -- 最安コース時間（分）
    phone           text,                       -- '080-9711-4911'
    official_url    text,                       -- 公式サイトURL
    domain          text,                       -- 'viccaplus.net'
    description     text,                       -- 公式サイトから取得した説明文
    service_tags    text[],                     -- ARRAY['アロマ','リンパ','完全個室']
    image_url       text,                       -- サロンメイン画像
    search_volume   int,                        -- サロン名カナの検索ボリューム
    source          text,                       -- 'esthe-ranking' / 'me' / 'manual'
    is_active       bool DEFAULT true,          -- 営業中/閉店
    last_scraped_at timestamptz,                -- 最終スクレイピング日時
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_shops_slug ON shops(slug);
CREATE INDEX idx_shops_name_kana ON shops(name_kana);
CREATE INDEX idx_shops_domain ON shops(domain);

-- ============================================================
-- 4. shop_areas（サロン↔エリア中間テーブル）
-- ============================================================
CREATE TABLE shop_areas (
    shop_id         int8 NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    area_id         int8 NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    is_primary      bool DEFAULT false,         -- メインエリアか
    display_order   int DEFAULT 0,              -- エリア内での表示順
    PRIMARY KEY (shop_id, area_id)
);

CREATE INDEX idx_shop_areas_area ON shop_areas(area_id);

-- ============================================================
-- 5. therapists（セラピスト: ~160K件）
-- ============================================================
CREATE TABLE therapists (
    id              int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    shop_id         int8 NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name            text NOT NULL,              -- '天宮るな'
    slug            text,                       -- 'amemiya-runa'
    age             int,                        -- 23
    height          int,                        -- 166 (cm)
    bust            text,                       -- '83(D)' or '83'
    waist           int,                        -- 55
    hip             int,                        -- 82
    cup             text,                       -- 'D'
    image_urls      jsonb,                      -- ["url1", "url2"]
    profile_text    text,                       -- 紹介文
    source_url      text,                       -- セラピスト個別ページURL
    status          text DEFAULT 'active',      -- 'active' / 'retired' / 'transferred'
    stats           jsonb,                      -- 口コミ集計（type_scores, parameter_averages等）
    last_scraped_at timestamptz,                -- 最終スクレイピング日時
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    UNIQUE (shop_id, slug)
);

CREATE INDEX idx_therapists_shop ON therapists(shop_id);
CREATE INDEX idx_therapists_status ON therapists(status);

-- ============================================================
-- 6. profiles（ユーザープロフィール）
-- ============================================================
CREATE TABLE profiles (
    id                      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname                text,
    membership_type         text DEFAULT 'free',  -- 'free' | 'standard' | 'vip'
    view_permission_until   timestamptz,          -- 無料投稿後+3日
    monthly_review_count    int DEFAULT 0,
    monthly_review_reset_at timestamptz,
    total_review_count      int DEFAULT 0,
    payment_provider        text,                 -- 'stripe' | null
    payment_customer_id     text,
    created_at              timestamptz DEFAULT now()
);

-- ============================================================
-- 7. reviews（口コミ）
-- ============================================================
CREATE TABLE reviews (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    therapist_id            int8 NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    shop_id                 int8 NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    looks_type              text,                 -- idol/gal/seiso/amateur/model/oneesan
    body_type               text,                 -- slender/normal/glamour/chubby
    service_level           text,                 -- kenzen/skr/hr
    param_conversation      int,                  -- 1-5
    param_distance          int,                  -- 1-5
    param_technique         int,                  -- 1-5
    param_personality       int,                  -- 1-5
    score                   int,                  -- 0-100
    comment_first_impression text,                -- Q1: 第一印象（50-100字）
    comment_service         text,                 -- Q2: サービス（100-150字）
    comment_advice          text,                 -- Q3: アドバイス（50-100字）
    comment_service_detail  text,                 -- Q4: 具体的内容（50-150字）※閲覧制限
    is_verified             bool DEFAULT false,
    created_at              timestamptz DEFAULT now(),

    -- 制約
    CONSTRAINT chk_looks_type CHECK (looks_type IN ('idol','gal','seiso','amateur','model','oneesan')),
    CONSTRAINT chk_body_type CHECK (body_type IN ('slender','normal','glamour','chubby')),
    CONSTRAINT chk_service_level CHECK (service_level IN ('kenzen','skr','hr')),
    CONSTRAINT chk_score CHECK (score >= 0 AND score <= 100),
    CONSTRAINT chk_param_conversation CHECK (param_conversation IS NULL OR (param_conversation >= 1 AND param_conversation <= 5)),
    CONSTRAINT chk_param_distance CHECK (param_distance IS NULL OR (param_distance >= 1 AND param_distance <= 5)),
    CONSTRAINT chk_param_technique CHECK (param_technique IS NULL OR (param_technique >= 1 AND param_technique <= 5)),
    CONSTRAINT chk_param_personality CHECK (param_personality IS NULL OR (param_personality >= 1 AND param_personality <= 5))
);

CREATE INDEX idx_reviews_therapist ON reviews(therapist_id);
CREATE INDEX idx_reviews_shop ON reviews(shop_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);

-- ============================================================
-- 8. user_rewards（割引管理）
-- ============================================================
CREATE TABLE user_rewards (
    id              int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_month    date NOT NULL,              -- YYYY-MM-01
    review_count    int DEFAULT 0,
    discount_amount int DEFAULT 0,
    status          text DEFAULT 'pending',     -- 'pending' | 'applied'
    UNIQUE (user_id, target_month)
);

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_areas_updated_at
    BEFORE UPDATE ON areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shops_updated_at
    BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_therapists_updated_at
    BEFORE UPDATE ON therapists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS（Row Level Security）基本ポリシー
-- ============================================================

-- マスタ系: 全員読み取り可
ALTER TABLE prefectures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefectures_read" ON prefectures FOR SELECT USING (true);

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas_read" ON areas FOR SELECT USING (true);

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shops_read" ON shops FOR SELECT USING (true);

ALTER TABLE shop_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop_areas_read" ON shop_areas FOR SELECT USING (true);

ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "therapists_read" ON therapists FOR SELECT USING (true);

-- profiles: 本人のみ読み書き
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_own" ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- reviews: 全員読み取り可、投稿は認証ユーザーのみ
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_read" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_auth" ON reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_delete_own" ON reviews
    FOR DELETE USING (auth.uid() = user_id);

-- user_rewards: 本人のみ読み取り
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_rewards_read_own" ON user_rewards
    FOR SELECT USING (auth.uid() = user_id);
