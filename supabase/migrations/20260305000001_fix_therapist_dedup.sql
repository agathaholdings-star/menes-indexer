-- 壊れたUNIQUE(salon_id, slug)を削除し、3点dedupをDB制約化
--
-- 背景:
--   slugはINSERT後にid::textで上書きするため、INSERT時はNULL。
--   UNIQUE(salon_id, slug)はNULL != NULLで機能せず、重複防止になっていなかった。
--
-- 新制約:
--   UNIQUE(salon_id, COALESCE(source_url, ''), name)
--   → アプリ側3点チェック(salon_id + source_url + name)と同一ロジック
--   → single_pageでも安全（同じURL + 異なる名前 = 別レコード）
--   → ON CONFLICT ... DO UPDATE でUPSERTが一発で書ける

-- 1. 壊れた制約を削除
ALTER TABLE therapists DROP CONSTRAINT IF EXISTS therapists_salon_id_slug_key;

-- 2. 新しいUNIQUEインデックス（式インデックス）
CREATE UNIQUE INDEX IF NOT EXISTS idx_therapists_dedup
  ON therapists (salon_id, COALESCE(source_url, ''), name);
