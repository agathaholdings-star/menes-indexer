-- salons テーブルに review_count, therapist_count カラムを追加
-- ホームページの「人気サロン」セクション・sitemapの優先度判定に使用

ALTER TABLE salons ADD COLUMN IF NOT EXISTS review_count int DEFAULT 0;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS therapist_count int DEFAULT 0;

-- 既存データの集計
UPDATE salons s SET review_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT t.salon_id, COUNT(*) as cnt
  FROM reviews r
  JOIN therapists t ON r.therapist_id = t.id
  WHERE r.moderation_status = 'approved'
  GROUP BY t.salon_id
) sub
WHERE s.id = sub.salon_id;

UPDATE salons s SET therapist_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT salon_id, COUNT(*) as cnt
  FROM therapists
  GROUP BY salon_id
) sub
WHERE s.id = sub.salon_id;

-- review_count 自動更新トリガー
CREATE OR REPLACE FUNCTION update_salon_review_count()
RETURNS TRIGGER AS $$
DECLARE
  v_salon_id int8;
BEGIN
  -- therapist_id から salon_id を取得
  IF TG_OP = 'DELETE' THEN
    SELECT salon_id INTO v_salon_id FROM therapists WHERE id = OLD.therapist_id;
  ELSE
    SELECT salon_id INTO v_salon_id FROM therapists WHERE id = NEW.therapist_id;
  END IF;

  IF v_salon_id IS NOT NULL THEN
    UPDATE salons SET review_count = (
      SELECT COUNT(*) FROM reviews r
      JOIN therapists t ON r.therapist_id = t.id
      WHERE t.salon_id = v_salon_id AND r.moderation_status = 'approved'
    ) WHERE id = v_salon_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_salon_review_count ON reviews;
CREATE TRIGGER trg_update_salon_review_count
  AFTER INSERT OR UPDATE OF moderation_status OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_salon_review_count();

-- therapist_count 自動更新トリガー
CREATE OR REPLACE FUNCTION update_salon_therapist_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE salons SET therapist_count = (
      SELECT COUNT(*) FROM therapists WHERE salon_id = OLD.salon_id
    ) WHERE id = OLD.salon_id;
  ELSIF TG_OP = 'INSERT' THEN
    UPDATE salons SET therapist_count = (
      SELECT COUNT(*) FROM therapists WHERE salon_id = NEW.salon_id
    ) WHERE id = NEW.salon_id;
  ELSIF OLD.salon_id IS DISTINCT FROM NEW.salon_id THEN
    UPDATE salons SET therapist_count = (
      SELECT COUNT(*) FROM therapists WHERE salon_id = OLD.salon_id
    ) WHERE id = OLD.salon_id;
    UPDATE salons SET therapist_count = (
      SELECT COUNT(*) FROM therapists WHERE salon_id = NEW.salon_id
    ) WHERE id = NEW.salon_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_salon_therapist_count ON therapists;
CREATE TRIGGER trg_update_salon_therapist_count
  AFTER INSERT OR UPDATE OF salon_id OR DELETE ON therapists
  FOR EACH ROW EXECUTE FUNCTION update_salon_therapist_count();
