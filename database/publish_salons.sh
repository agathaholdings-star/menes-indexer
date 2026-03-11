#!/bin/bash
# =============================================================
# 段階公開スクリプト: 合計ページ数（サロン+セラピスト）で制御
# サロンID順に公開。1サロン公開 = サロンページ + 在籍セラピストページ
# Usage: ./publish_salons.sh [目標ページ数] [DB接続文字列]
# Example: ./publish_salons.sh 1000
# =============================================================

TARGET_PAGES="${1:-1000}"
DB_URL="${2:-$SUPABASE_DB_URL}"

if [ -z "$DB_URL" ]; then
  echo "Error: DB_URL not set. Pass as 2nd arg or set SUPABASE_DB_URL env var"
  exit 1
fi

echo "Target: ~$TARGET_PAGES pages (salon + therapist pages)"

RESULT=$(psql "$DB_URL" -t -A -c "
  WITH candidates AS (
    SELECT
      s.id,
      1 + COALESCE(t.cnt, 0) AS page_count,
      SUM(1 + COALESCE(t.cnt, 0)) OVER (ORDER BY s.id) AS running_total
    FROM salons s
    LEFT JOIN (
      SELECT salon_id, COUNT(*) AS cnt
      FROM therapists
      WHERE status = 'active'
      GROUP BY salon_id
    ) t ON t.salon_id = s.id
    WHERE s.published_at IS NULL AND s.is_active = true
    ORDER BY s.id
  ),
  to_publish AS (
    SELECT id, page_count, running_total
    FROM candidates
    WHERE running_total <= $TARGET_PAGES
       OR id = (SELECT id FROM candidates ORDER BY id LIMIT 1)  -- 最低1サロン
  )
  UPDATE salons SET published_at = now()
  FROM to_publish
  WHERE salons.id = to_publish.id
  RETURNING salons.id;
")

PUBLISHED_COUNT=$(echo "$RESULT" | grep -c '^[0-9]')

# 公開されたページ数の実績
ACTUAL_PAGES=$(psql "$DB_URL" -t -A -c "
  SELECT COALESCE(SUM(1 + COALESCE(t.cnt, 0)), 0)
  FROM salons s
  LEFT JOIN (
    SELECT salon_id, COUNT(*) AS cnt
    FROM therapists WHERE status = 'active'
    GROUP BY salon_id
  ) t ON t.salon_id = s.id
  WHERE s.id IN ($(echo "$RESULT" | tr '\n' ',' | sed 's/,$//' ))
")

# 残り
REMAINING=$(psql "$DB_URL" -t -A -c "
  SELECT COUNT(*) FROM salons WHERE published_at IS NULL AND is_active = true;
")
REMAINING_PAGES=$(psql "$DB_URL" -t -A -c "
  SELECT COALESCE(SUM(1 + COALESCE(t.cnt, 0)), 0)
  FROM salons s
  LEFT JOIN (
    SELECT salon_id, COUNT(*) AS cnt
    FROM therapists WHERE status = 'active'
    GROUP BY salon_id
  ) t ON t.salon_id = s.id
  WHERE s.published_at IS NULL AND s.is_active = true;
")

echo "---"
echo "Published: $PUBLISHED_COUNT salons (~${ACTUAL_PAGES} pages)"
echo "Remaining: $REMAINING salons (~${REMAINING_PAGES} pages)"
