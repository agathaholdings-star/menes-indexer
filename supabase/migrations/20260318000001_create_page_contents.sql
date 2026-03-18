-- SEOコンテンツ格納テーブル
-- ポリモーフィック関連: page_type + entity_id で各テーブルを参照
CREATE TABLE page_contents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  page_type text NOT NULL,           -- 'prefecture' | 'area' | 'salon'
  entity_id bigint NOT NULL,         -- 各テーブルのID
  content_key text NOT NULL,         -- 'guide' | 'faq' | 'highlights' | 'area_info' | 'salon_overview' | 'price_table'
  title text,                        -- セクションの見出し
  body text NOT NULL,                -- コンテンツ本文（HTML）
  generated_by text,                 -- 'claude-sonnet-4-5' etc
  prompt_version text,               -- プロンプトバージョン管理用
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(page_type, entity_id, content_key)
);

-- クエリ最適化用インデックス
CREATE INDEX idx_page_contents_lookup
  ON page_contents(page_type, entity_id);

-- RLS: 公開読み取り可、書き込みはservice_roleのみ
ALTER TABLE page_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_contents_public_read"
  ON page_contents FOR SELECT
  USING (true);
