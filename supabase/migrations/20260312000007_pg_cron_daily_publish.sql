-- ============================================================
-- pg_cron: 毎日1000ページずつサロンを段階公開
-- UTC 0:00 (JST 9:00) に実行
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 日次公開関数
CREATE OR REPLACE FUNCTION publish_salons_batch(p_target_pages int DEFAULT 1000)
RETURNS TABLE (published_salons int, published_pages bigint, remaining_salons bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_published_count int;
  v_published_pages bigint;
  v_remaining bigint;
BEGIN
  WITH candidates AS (
    SELECT
      s.id,
      1 + COALESCE(t.cnt, 0) AS page_count,
      SUM(1 + COALESCE(t.cnt, 0)) OVER (ORDER BY s.id) AS running_total
    FROM salons s
    LEFT JOIN (
      SELECT salon_id, COUNT(*) AS cnt
      FROM therapists WHERE status = 'active'
      GROUP BY salon_id
    ) t ON t.salon_id = s.id
    WHERE s.published_at IS NULL AND s.is_active = true
    ORDER BY s.id
  ),
  to_publish AS (
    SELECT id, page_count, running_total
    FROM candidates
    WHERE running_total <= p_target_pages
       OR id = (SELECT id FROM candidates ORDER BY id LIMIT 1)
  ),
  updated AS (
    UPDATE salons SET published_at = now()
    FROM to_publish
    WHERE salons.id = to_publish.id
    RETURNING salons.id
  )
  SELECT COUNT(*)::int, COALESCE(SUM(tp.page_count), 0)::bigint
  INTO v_published_count, v_published_pages
  FROM updated u
  JOIN (SELECT id, page_count FROM candidates WHERE running_total <= p_target_pages OR id = (SELECT id FROM candidates ORDER BY id LIMIT 1)) tp ON tp.id = u.id;

  SELECT COUNT(*) INTO v_remaining
  FROM salons WHERE published_at IS NULL AND is_active = true;

  RAISE NOTICE 'Published % salons (~% pages). Remaining: %', v_published_count, v_published_pages, v_remaining;

  RETURN QUERY SELECT v_published_count, v_published_pages, v_remaining;
END;
$$;

-- 毎日 UTC 0:00 (JST 9:00) に実行
SELECT cron.schedule(
  'daily-publish-salons',
  '0 0 * * *',
  'SELECT * FROM publish_salons_batch(1000);'
);
