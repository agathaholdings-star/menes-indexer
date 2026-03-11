-- ============================================================
-- salons.avg_score 追加 + salon_review_stats VIEW を廃止
-- 非正規化カラム(review_count, therapist_count, avg_score)に統一
-- ============================================================

-- 1. avg_score カラム追加
ALTER TABLE salons ADD COLUMN IF NOT EXISTS avg_score numeric(5,1) NOT NULL DEFAULT 0;

-- 2. バックフィル
UPDATE salons s SET avg_score = COALESCE(sub.avg, 0)
FROM (
  SELECT
    t.salon_id,
    AVG(r.score)::numeric(5,1) AS avg
  FROM reviews r
  JOIN therapists t ON r.therapist_id = t.id
  WHERE r.moderation_status = 'approved' AND r.score IS NOT NULL
  GROUP BY t.salon_id
) sub
WHERE s.id = sub.salon_id;

-- 3. 既存トリガーを拡張: review_count + avg_score を同時更新
CREATE OR REPLACE FUNCTION update_salon_review_count()
RETURNS TRIGGER AS $$
DECLARE
  v_salon_id int8;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT salon_id INTO v_salon_id FROM therapists WHERE id = OLD.therapist_id;
  ELSE
    SELECT salon_id INTO v_salon_id FROM therapists WHERE id = NEW.therapist_id;
  END IF;

  IF v_salon_id IS NOT NULL THEN
    UPDATE salons SET
      review_count = COALESCE(sub.cnt, 0),
      avg_score = COALESCE(sub.avg, 0)
    FROM (
      SELECT
        COUNT(*)::int AS cnt,
        AVG(r.score)::numeric(5,1) AS avg
      FROM reviews r
      JOIN therapists t ON r.therapist_id = t.id
      WHERE t.salon_id = v_salon_id
        AND r.moderation_status = 'approved'
        AND r.score IS NOT NULL
    ) sub
    WHERE id = v_salon_id;
  END IF;

  -- UPDATE時に therapist_id 変更 → 旧サロンも更新
  IF TG_OP = 'UPDATE' AND OLD.therapist_id IS DISTINCT FROM NEW.therapist_id THEN
    DECLARE v_old_salon_id int8;
    BEGIN
      SELECT salon_id INTO v_old_salon_id FROM therapists WHERE id = OLD.therapist_id;
      IF v_old_salon_id IS NOT NULL AND v_old_salon_id IS DISTINCT FROM v_salon_id THEN
        UPDATE salons SET
          review_count = COALESCE(sub.cnt, 0),
          avg_score = COALESCE(sub.avg, 0)
        FROM (
          SELECT
            COUNT(*)::int AS cnt,
            AVG(r.score)::numeric(5,1) AS avg
          FROM reviews r
          JOIN therapists t ON r.therapist_id = t.id
          WHERE t.salon_id = v_old_salon_id
            AND r.moderation_status = 'approved'
            AND r.score IS NOT NULL
        ) sub
        WHERE id = v_old_salon_id;
      END IF;
    END;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. RPC: get_ranked_salons_by_area を salons カラム直接参照に書き換え
CREATE OR REPLACE FUNCTION get_ranked_salons_by_area(
  p_area_id bigint,
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  salon_id bigint,
  review_count int,
  avg_score numeric,
  bayesian_score numeric,
  therapist_count int,
  ranking_score numeric,
  latest_review_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_global_avg numeric;
  v_C int := 5;
BEGIN
  SELECT COALESCE(AVG(score), 74)::numeric INTO v_global_avg
  FROM reviews
  WHERE moderation_status = 'approved' AND score IS NOT NULL;

  RETURN QUERY
  SELECT
    sa.salon_id,
    COALESCE(s.review_count, 0)::int,
    COALESCE(s.avg_score, 0)::numeric,
    CASE
      WHEN COALESCE(s.review_count, 0) = 0 THEN 0
      ELSE ((v_C * v_global_avg + COALESCE(s.avg_score, 0) * s.review_count) / (v_C + s.review_count))::numeric(5,1)
    END AS bayesian_score,
    COALESCE(s.therapist_count, 0)::int,
    CASE
      WHEN COALESCE(s.review_count, 0) = 0 THEN 0
      ELSE (
        ((v_C * v_global_avg + COALESCE(s.avg_score, 0) * s.review_count) / (v_C + s.review_count)) * 0.45
        + (LEAST(s.review_count, 30)::numeric / 30 * 100) * 0.35
        + (LEAST(COALESCE(s.therapist_count, 0), 50)::numeric / 50 * 100) * 0.10
        + (CASE
            WHEN lr.latest_at >= now() - interval '7 days' THEN 100
            WHEN lr.latest_at >= now() - interval '30 days' THEN 70
            WHEN lr.latest_at >= now() - interval '90 days' THEN 40
            ELSE 10
          END) * 0.10
      )::numeric(5,1)
    END AS ranking_score,
    lr.latest_at
  FROM salon_areas sa
  JOIN salons s ON s.id = sa.salon_id
  LEFT JOIN LATERAL (
    SELECT MAX(r.created_at) AS latest_at
    FROM reviews r
    JOIN therapists t ON r.therapist_id = t.id
    WHERE t.salon_id = sa.salon_id AND r.moderation_status = 'approved'
  ) lr ON true
  WHERE sa.area_id = p_area_id
    AND s.published_at IS NOT NULL
  ORDER BY
    ranking_score DESC,
    COALESCE(s.review_count, 0) DESC,
    sa.display_order ASC
  LIMIT p_limit;
END;
$$;

-- 5. RPC: get_salon_review_stats_batch を salons カラム直接参照に書き換え
CREATE OR REPLACE FUNCTION get_salon_review_stats_batch(
  p_salon_ids bigint[]
)
RETURNS TABLE (
  salon_id bigint,
  review_count int,
  avg_score numeric,
  therapist_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id AS salon_id,
    COALESCE(s.review_count, 0)::int,
    COALESCE(s.avg_score, 0)::numeric,
    COALESCE(s.therapist_count, 0)::int
  FROM salons s
  WHERE s.id = ANY(p_salon_ids) AND s.is_active = true AND s.published_at IS NOT NULL;
$$;

-- 6. VIEW 廃止
DROP VIEW IF EXISTS salon_review_stats;
