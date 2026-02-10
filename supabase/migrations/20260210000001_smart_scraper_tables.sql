-- ============================================================
-- Smart Scraper: 自己学習型セラピストスクレイパー用テーブル
-- cms_patterns, shop_scrape_cache, scrape_log + shops拡張
-- ============================================================

-- ============================================================
-- 1. cms_patterns（CMS抽出ルール）
-- ============================================================
CREATE TABLE cms_patterns (
    id              int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    cms_name        text NOT NULL UNIQUE,                -- 'estama', 'upfu8_cms' 等
    fingerprint     jsonb NOT NULL DEFAULT '{}',         -- CMS判定用シグナル
    list_url_rules  jsonb NOT NULL DEFAULT '{}',         -- Step 2: 一覧ページURL発見ルール
    therapist_list_rules jsonb NOT NULL DEFAULT '{}',    -- Step 3: 個別URL抽出ルール
    therapist_data_rules jsonb NOT NULL DEFAULT '{}',    -- Step 4: データ抽出ルール
    confidence      float NOT NULL DEFAULT 0.0,          -- 0.0-1.0 成功率ベース
    success_count   int NOT NULL DEFAULT 0,
    fail_count      int NOT NULL DEFAULT 0,
    version         int NOT NULL DEFAULT 1,              -- ルール更新時にインクリメント
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE TRIGGER trg_cms_patterns_updated_at
    BEFORE UPDATE ON cms_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. shop_scrape_cache（サロン別スクレイピングキャッシュ）
-- ============================================================
CREATE TABLE shop_scrape_cache (
    shop_id             int8 PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
    cms_pattern_id      int8 REFERENCES cms_patterns(id) ON DELETE SET NULL,
    therapist_list_url  text,                            -- キャッシュ済み一覧URL
    extraction_method   text DEFAULT 'llm',              -- 'rule' / 'llm'
    last_therapist_count int DEFAULT 0,                  -- 前回取得人数
    fail_streak         int DEFAULT 0,                   -- 連続失敗回数
    last_scraped_at     timestamptz,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE TRIGGER trg_shop_scrape_cache_updated_at
    BEFORE UPDATE ON shop_scrape_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. scrape_log（スクレイピングログ）
-- ============================================================
CREATE TABLE scrape_log (
    id          int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    shop_id     int8 NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    step        text NOT NULL,                           -- 'find_list_url' / 'extract_urls' / 'extract_data'
    method      text NOT NULL,                           -- 'rule' / 'llm' / 'cache'
    success     bool NOT NULL DEFAULT false,
    detail      text,                                    -- エラー詳細やメモ
    html_hash   text,                                    -- SHA256 ページ変更検知用
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_scrape_log_shop ON scrape_log(shop_id);
CREATE INDEX idx_scrape_log_created ON scrape_log(created_at DESC);

-- ============================================================
-- 4. shops テーブル拡張: cms_fingerprint カラム追加
-- ============================================================
ALTER TABLE shops ADD COLUMN IF NOT EXISTS cms_fingerprint text;
