-- ============================================================
-- サロンランキング: VIEW + RPC + インデックス
-- エリアページをランキング形式にするための集計基盤
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 部分インデックス（approved + score NOT NULL の口コミ検索を高速化）
-- ============================================================

CREATE INDEX idx_reviews_salon_approved
  ON reviews(salon_id, score)
  WHERE moderation_status = 'approved' AND score IS NOT NULL;

-- ============================================================
-- 2. VIEW: salon_review_stats（サロン別の口コミ集計）
-- ============================================================

CREATE OR REPLACE VIEW salon_review_stats AS
SELECT
  s.id AS salon_id,
  COALESCE(r.review_count, 0)::int AS review_count,
  COALESCE(r.avg_score, 0)::numeric(5,1) AS avg_score,
  COALESCE(r.sum_score, 0)::bigint AS sum_score,
  r.latest_review_at,
  COALESCE(t.therapist_count, 0)::int AS therapist_count
FROM salons s
LEFT JOIN (
  SELECT
    salon_id,
    COUNT(*)::int AS review_count,
    AVG(score)::numeric(5,1) AS avg_score,
    SUM(score)::bigint AS sum_score,
    MAX(created_at) AS latest_review_at
  FROM reviews
  WHERE moderation_status = 'approved' AND score IS NOT NULL
  GROUP BY salon_id
) r ON r.salon_id = s.id
LEFT JOIN (
  SELECT
    salon_id,
    COUNT(*)::int AS therapist_count
  FROM therapists
  WHERE status = 'active'
  GROUP BY salon_id
) t ON t.salon_id = s.id
WHERE s.is_active = true;

-- ============================================================
-- 3. RPC: get_ranked_salons_by_area
--    エリア内サロンをランキングスコア順で返す
-- ============================================================

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
  v_C int := 5;  -- 信頼閾値: 5件以上で自力スコアに収束
BEGIN
  -- 全体平均スコアを算出
  SELECT COALESCE(AVG(score), 74)::numeric INTO v_global_avg
  FROM reviews
  WHERE moderation_status = 'approved' AND score IS NOT NULL;

  RETURN QUERY
  SELECT
    sa.salon_id,
    COALESCE(sv.review_count, 0)::int,
    COALESCE(sv.avg_score, 0)::numeric,
    -- Bayesian平均: (C*M + Σscores) / (C + n)
    CASE
      WHEN COALESCE(sv.review_count, 0) = 0 THEN 0
      ELSE ((v_C * v_global_avg + COALESCE(sv.sum_score, 0)) / (v_C + sv.review_count))::numeric(5,1)
    END AS bayesian_score,
    COALESCE(sv.therapist_count, 0)::int,
    -- 総合ランキングスコア
    CASE
      WHEN COALESCE(sv.review_count, 0) = 0 THEN 0
      ELSE (
        -- 品質 45%
        ((v_C * v_global_avg + COALESCE(sv.sum_score, 0)) / (v_C + sv.review_count)) * 0.45
        -- 人気度 35% (30件で飽和)
        + (LEAST(sv.review_count, 30)::numeric / 30 * 100) * 0.35
        -- サロン規模 10% (50名で飽和)
        + (LEAST(COALESCE(sv.therapist_count, 0), 50)::numeric / 50 * 100) * 0.10
        -- 新しさ 10%
        + (CASE
            WHEN sv.latest_review_at >= now() - interval '7 days' THEN 100
            WHEN sv.latest_review_at >= now() - interval '30 days' THEN 70
            WHEN sv.latest_review_at >= now() - interval '90 days' THEN 40
            ELSE 10
          END) * 0.10
      )::numeric(5,1)
    END AS ranking_score,
    sv.latest_review_at
  FROM salon_areas sa
  LEFT JOIN salon_review_stats sv ON sv.salon_id = sa.salon_id
  WHERE sa.area_id = p_area_id
  ORDER BY
    ranking_score DESC,
    COALESCE(sv.review_count, 0) DESC,
    sa.display_order ASC
  LIMIT p_limit;
END;
$$;

-- ============================================================
-- 4. RPC: get_salon_review_stats_batch
--    指定サロンIDの口コミ統計をバッチ取得
-- ============================================================

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
    sv.salon_id,
    sv.review_count,
    sv.avg_score,
    sv.therapist_count
  FROM salon_review_stats sv
  WHERE sv.salon_id = ANY(p_salon_ids);
$$;

COMMIT;
