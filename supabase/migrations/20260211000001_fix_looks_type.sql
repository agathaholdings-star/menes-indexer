-- ============================================================
-- looks_type CHECK制約を UI の値に合わせて修正
-- 旧: idol, gal, seiso, amateur, model, oneesan
-- 新: idol, gal, seiso, model, imouto, yoen
-- ============================================================

ALTER TABLE reviews DROP CONSTRAINT chk_looks_type;
ALTER TABLE reviews ADD CONSTRAINT chk_looks_type
  CHECK (looks_type IN ('idol','gal','seiso','model','imouto','yoen'));
