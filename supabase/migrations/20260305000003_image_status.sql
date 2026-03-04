-- 画像取得状態を記録するカラム追加
--
-- 再チェック不要にするため、なぜ画像がないかの理由を保持する。
-- batch_download_images.py が処理時に自動更新。

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS image_status text;

-- 既存データを分類
-- 1. Storage済み → 'ok'（ローカルは127.0.0.1、本番はsupabase.co）
UPDATE therapists SET image_status = 'ok'
WHERE image_urls IS NOT NULL
  AND image_urls != '[]'::jsonb
  AND image_urls::text LIKE '%storage/v1%';

-- 2. 画像なし（元サイトに掲載なし）→ 'source_missing'
UPDATE therapists SET image_status = 'source_missing'
WHERE image_urls IS NULL OR image_urls = '[]'::jsonb;

-- 3. 外部URLのまま（DL試行済み・取得失敗）→ 'fetch_failed'
UPDATE therapists SET image_status = 'fetch_failed'
WHERE image_status IS NULL
  AND image_urls IS NOT NULL
  AND image_urls != '[]'::jsonb;

COMMENT ON COLUMN therapists.image_status IS
  'ok=Storage済み / source_missing=元サイトに画像なし / fetch_failed=DL試行失敗 / pending=未処理';
