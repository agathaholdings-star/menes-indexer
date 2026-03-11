-- ============================================================
-- 段階公開用: salons.published_at カラム追加
-- NULL = 未公開、日時あり = 公開済み
-- フロントは published_at IS NOT NULL のサロン+紐づくセラピスト+口コミのみ表示
-- ============================================================

ALTER TABLE salons ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- 既存の本番データ（is_active=true）は公開済みとする
UPDATE salons SET published_at = created_at WHERE is_active = true AND published_at IS NULL;

-- インデックス: 公開済みサロンのフィルタ高速化
CREATE INDEX IF NOT EXISTS idx_salons_published
  ON salons(published_at) WHERE published_at IS NOT NULL;
