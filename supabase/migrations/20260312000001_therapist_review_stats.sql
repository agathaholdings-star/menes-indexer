-- ============================================================
-- therapists に review_count, avg_score を追加
-- フロントが参照しているがカラム未存在のバグ修正 + パフォーマンス改善
-- ============================================================

-- 1. カラム追加
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS review_count int NOT NULL DEFAULT 0;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS avg_score numeric(5,1) NOT NULL DEFAULT 0;

-- 2. 既存データのバックフィル
UPDATE therapists t SET
  review_count = COALESCE(sub.cnt, 0),
  avg_score = COALESCE(sub.avg, 0)
FROM (
  SELECT
    therapist_id,
    COUNT(*)::int AS cnt,
    AVG(score)::numeric(5,1) AS avg
  FROM reviews
  WHERE moderation_status = 'approved' AND score IS NOT NULL
  GROUP BY therapist_id
) sub
WHERE t.id = sub.therapist_id;

-- 3. トリガー関数: reviews 変更時に therapists の集計を更新
CREATE OR REPLACE FUNCTION update_therapist_review_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_therapist_id int8;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_therapist_id := OLD.therapist_id;
  ELSE
    v_therapist_id := NEW.therapist_id;
  END IF;

  UPDATE therapists SET
    review_count = COALESCE(sub.cnt, 0),
    avg_score = COALESCE(sub.avg, 0)
  FROM (
    SELECT
      COUNT(*)::int AS cnt,
      AVG(score)::numeric(5,1) AS avg
    FROM reviews
    WHERE therapist_id = v_therapist_id
      AND moderation_status = 'approved'
      AND score IS NOT NULL
  ) sub
  WHERE id = v_therapist_id;

  -- UPDATE時に therapist_id が変わった場合、旧セラピストも更新
  IF TG_OP = 'UPDATE' AND OLD.therapist_id IS DISTINCT FROM NEW.therapist_id THEN
    UPDATE therapists SET
      review_count = COALESCE(sub.cnt, 0),
      avg_score = COALESCE(sub.avg, 0)
    FROM (
      SELECT
        COUNT(*)::int AS cnt,
        AVG(score)::numeric(5,1) AS avg
      FROM reviews
      WHERE therapist_id = OLD.therapist_id
        AND moderation_status = 'approved'
        AND score IS NOT NULL
    ) sub
    WHERE id = OLD.therapist_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_therapist_review_stats ON reviews;
CREATE TRIGGER trg_update_therapist_review_stats
  AFTER INSERT OR UPDATE OF moderation_status, therapist_id OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_therapist_review_stats();

-- 4. インデックス: review_count でのソート高速化
CREATE INDEX IF NOT EXISTS idx_therapists_review_count
  ON therapists(review_count DESC) WHERE review_count > 0;
