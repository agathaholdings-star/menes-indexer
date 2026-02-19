-- ============================================================
-- therapists に blood_type カラム追加
-- Haiku一括抽出で血液型も取得するため
-- ============================================================

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS blood_type text;
