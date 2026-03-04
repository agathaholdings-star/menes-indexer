-- 未使用カラム削除（2回の全コードベース調査で安全性確認済み）

-- areas: 未使用SEO/メタカラム（seed INSERTにも含まれない、コード参照ゼロ）
ALTER TABLE areas DROP COLUMN IF EXISTS seo_title;
ALTER TABLE areas DROP COLUMN IF EXISTS seo_description;
ALTER TABLE areas DROP COLUMN IF EXISTS meta_description;

-- areas: seedデータありだがコードから一切参照されないカラム
ALTER TABLE areas DROP COLUMN IF EXISTS parent_group;
ALTER TABLE areas DROP COLUMN IF EXISTS nearby_areas;

-- therapists: 口コミ集計用に定義されたが未実装のまま（書き込み・読み出し・参照なし）
ALTER TABLE therapists DROP COLUMN IF EXISTS stats;

-- salons: 検索ボリューム（areas.search_volumeとは別物。こちらは未使用）
ALTER TABLE salons DROP COLUMN IF EXISTS search_volume;
