-- ============================================================
-- reviews 設問拡張: 3問→8問（Q0〜Q7）
-- 新規カラム5つ追加
-- ============================================================

BEGIN;

-- Q0: きっかけ（50-100字）
ALTER TABLE reviews ADD COLUMN comment_reason text;

-- Q2: スタイル（50-100字）
ALTER TABLE reviews ADD COLUMN comment_style text;

-- Q5: トータル金額（円）
ALTER TABLE reviews ADD COLUMN cost_total int;

-- Q5: 金額テキスト（50-100字）
ALTER TABLE reviews ADD COLUMN comment_cost text;

-- Q6: 再訪するか（50-100字）
ALTER TABLE reviews ADD COLUMN comment_revisit text;

COMMIT;
