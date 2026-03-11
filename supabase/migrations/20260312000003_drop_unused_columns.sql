-- ============================================================
-- B1投入前の不要カラム削除
-- フロントエンド・スクレイパー全コードベース調査済み
-- ============================================================

-- salons: 全件NULL・未使用
ALTER TABLE salons DROP COLUMN IF EXISTS seo_title;

-- salons: 旧スクレイパーの内部ID。フロント未使用
ALTER TABLE salons DROP COLUMN IF EXISTS source_id;

-- salons: フロント未使用（official_url で十分）
ALTER TABLE salons DROP COLUMN IF EXISTS domain;

-- therapists: 画像Storage移行完了（2026-03-11）後は不要
ALTER TABLE therapists DROP COLUMN IF EXISTS image_status;

-- areas: スクレイピング元URL。運用不要
ALTER TABLE areas DROP COLUMN IF EXISTS data_source_url;
