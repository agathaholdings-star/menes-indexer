-- ============================================================
-- 不要カラム削除: name_raw, bust_raw, blood_type
-- name_raw/bust_raw: 旧データクレンジング時の退避用（新Haikuスクレイパーでは不要）
-- blood_type: 利用価値なし
-- ============================================================

ALTER TABLE therapists DROP COLUMN IF EXISTS name_raw;
ALTER TABLE therapists DROP COLUMN IF EXISTS bust_raw;
ALTER TABLE therapists DROP COLUMN IF EXISTS blood_type;
