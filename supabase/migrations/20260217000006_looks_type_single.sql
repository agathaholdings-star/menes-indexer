-- ============================================================
-- looks_type を複数選択(int[])→単一選択(int FK)に変更
-- フィルター精度向上のため「強いて1つ」方式に統一
-- ============================================================

BEGIN;

ALTER TABLE reviews DROP COLUMN looks_type_ids;
ALTER TABLE reviews ADD COLUMN looks_type_id int REFERENCES looks_types(id);

COMMIT;
