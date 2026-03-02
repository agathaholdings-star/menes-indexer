-- =============================================================
-- 本番デプロイ前DB整理
-- - 不要テーブル9個削除（BBS/DM/スクレイパー/user_rewards）
-- - 関連トリガー・関数の削除
-- - shops→salons命名残骸の修正
-- - 冗長インデックス削除 + 不足インデックス追加
-- =============================================================

-- -------------------------------------------------------------
-- 1. トリガー削除（テーブルDROP前に明示的に落とす）
-- -------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_bbs_post_like_increment ON bbs_post_likes;
DROP TRIGGER IF EXISTS trg_bbs_post_like_decrement ON bbs_post_likes;
DROP TRIGGER IF EXISTS trg_notify_bbs_reply ON bbs_posts;
DROP TRIGGER IF EXISTS trg_bbs_post_count ON bbs_posts;
DROP TRIGGER IF EXISTS trg_bbs_threads_updated_at ON bbs_threads;
DROP TRIGGER IF EXISTS trg_notify_dm ON messages;
DROP TRIGGER IF EXISTS trg_shop_scrape_cache_updated_at ON salon_scrape_cache;
DROP TRIGGER IF EXISTS trg_cms_patterns_updated_at ON cms_patterns;

-- -------------------------------------------------------------
-- 2. 関数削除（BBS/DM依存の5関数）
-- -------------------------------------------------------------
DROP FUNCTION IF EXISTS bbs_post_like_increment();
DROP FUNCTION IF EXISTS bbs_post_like_decrement();
DROP FUNCTION IF EXISTS notify_bbs_reply();
DROP FUNCTION IF EXISTS notify_dm();
DROP FUNCTION IF EXISTS update_thread_reply_count();

-- -------------------------------------------------------------
-- 3. テーブル削除（9テーブル、依存順にCASCADE）
-- -------------------------------------------------------------
DROP TABLE IF EXISTS bbs_post_likes CASCADE;
DROP TABLE IF EXISTS bbs_posts CASCADE;
DROP TABLE IF EXISTS bbs_threads CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS salon_scrape_cache CASCADE;
DROP TABLE IF EXISTS scrape_log CASCADE;
DROP TABLE IF EXISTS cms_patterns CASCADE;
DROP TABLE IF EXISTS user_rewards CASCADE;

-- -------------------------------------------------------------
-- 4. reports制約修正（BBS/DM関連の値を除去）
-- -------------------------------------------------------------
ALTER TABLE reports DROP CONSTRAINT IF EXISTS chk_report_target_type;
ALTER TABLE reports ADD CONSTRAINT chk_report_target_type
  CHECK (target_type IN ('review', 'user'));

-- -------------------------------------------------------------
-- 5. 命名修正（shops→salons残骸）
-- -------------------------------------------------------------

-- PK / UNIQUE制約
ALTER TABLE salons RENAME CONSTRAINT shops_pkey TO salons_pkey;
ALTER TABLE salons RENAME CONSTRAINT shops_slug_key TO salons_slug_key;
ALTER TABLE salon_areas RENAME CONSTRAINT shop_areas_pkey TO salon_areas_pkey;

-- FK制約
ALTER TABLE reviews RENAME CONSTRAINT reviews_shop_id_fkey TO reviews_salon_id_fkey;
ALTER TABLE salon_areas RENAME CONSTRAINT shop_areas_shop_id_fkey TO salon_areas_salon_id_fkey;
ALTER TABLE salon_areas RENAME CONSTRAINT shop_areas_area_id_fkey TO salon_areas_area_id_fkey;
ALTER TABLE therapists RENAME CONSTRAINT therapists_shop_id_fkey TO therapists_salon_id_fkey;

-- シーケンス
ALTER SEQUENCE shops_id_seq RENAME TO salons_id_seq;

-- -------------------------------------------------------------
-- 6. 冗長インデックス削除
-- -------------------------------------------------------------
DROP INDEX IF EXISTS idx_areas_slug;       -- areas_slug_key UNIQUEと重複
DROP INDEX IF EXISTS idx_salons_slug;      -- salons_slug_key(旧shops_slug_key) UNIQUEと重複
DROP INDEX IF EXISTS idx_favorites_user;   -- favorites PK(user_id, therapist_id)先頭列と重複
DROP INDEX IF EXISTS idx_therapists_salon; -- therapists UNIQUE(salon_id, slug)先頭列と重複

-- -------------------------------------------------------------
-- 7. 不足インデックス追加（フロントAPIクエリ最適化）
-- -------------------------------------------------------------

-- セラピストページ: 承認済み口コミを新しい順に取得
CREATE INDEX idx_reviews_therapist_approved
  ON reviews(therapist_id, moderation_status, created_at DESC);

-- 最新口コミAPI: 承認済みを新しい順
CREATE INDEX idx_reviews_approved_latest
  ON reviews(moderation_status, created_at DESC);

-- サロン一覧: エリア内のサロンを表示順で取得
CREATE INDEX idx_salon_areas_area_order
  ON salon_areas(area_id, display_order);
