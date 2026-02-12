-- ============================================================
-- shops → salons リネーム
-- テーブル名、FK列名、インデックス名、トリガー名を一括変更
-- ============================================================

BEGIN;

-- テーブル名
ALTER TABLE shops RENAME TO salons;
ALTER TABLE shop_areas RENAME TO salon_areas;
ALTER TABLE shop_scrape_cache RENAME TO salon_scrape_cache;

-- FK列: salon_areas
ALTER TABLE salon_areas RENAME COLUMN shop_id TO salon_id;

-- FK列: therapists
ALTER TABLE therapists RENAME COLUMN shop_id TO salon_id;

-- FK列: salon_scrape_cache
ALTER TABLE salon_scrape_cache RENAME COLUMN shop_id TO salon_id;

-- FK列: scrape_log
ALTER TABLE scrape_log RENAME COLUMN shop_id TO salon_id;

-- FK列: reviews
ALTER TABLE reviews RENAME COLUMN shop_id TO salon_id;

-- インデックス（自動リネームされないので手動）
ALTER INDEX idx_shops_slug RENAME TO idx_salons_slug;
ALTER INDEX idx_shops_display_name RENAME TO idx_salons_display_name;
ALTER INDEX idx_shops_domain RENAME TO idx_salons_domain;
ALTER INDEX idx_shop_areas_area RENAME TO idx_salon_areas_area;
ALTER INDEX idx_scrape_log_shop RENAME TO idx_scrape_log_salon;

-- therapistsのインデックス
ALTER INDEX idx_therapists_shop RENAME TO idx_therapists_salon;

-- UNIQUEキー: therapists(shop_id, slug) → (salon_id, slug)
ALTER INDEX therapists_shop_id_slug_key RENAME TO therapists_salon_id_slug_key;

-- reviews のインデックス
ALTER INDEX idx_reviews_shop RENAME TO idx_reviews_salon;

-- トリガー
ALTER TRIGGER trg_shops_updated_at ON salons RENAME TO trg_salons_updated_at;

-- RLSポリシー名（動作には影響しないが整合性のため）
ALTER POLICY "shops_read" ON salons RENAME TO "salons_read";
ALTER POLICY "shop_areas_read" ON salon_areas RENAME TO "salon_areas_read";

COMMIT;
