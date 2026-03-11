#!/bin/bash
# =============================================================
# 段階公開スクリプト: 未公開サロンをID順に指定件数だけ公開
# Usage: ./publish_salons.sh [件数] [DB接続文字列]
# Example: ./publish_salons.sh 1000
# =============================================================

BATCH_SIZE="${1:-1000}"
DB_URL="${2:-$SUPABASE_DB_URL}"

if [ -z "$DB_URL" ]; then
  echo "Error: DB_URL not set. Pass as 2nd arg or set SUPABASE_DB_URL env var"
  exit 1
fi

echo "Publishing next $BATCH_SIZE salons (ID order)..."

RESULT=$(psql "$DB_URL" -t -A -c "
  WITH to_publish AS (
    SELECT id FROM salons
    WHERE published_at IS NULL AND is_active = true
    ORDER BY id
    LIMIT $BATCH_SIZE
  )
  UPDATE salons SET published_at = now()
  FROM to_publish
  WHERE salons.id = to_publish.id
  RETURNING salons.id;
")

PUBLISHED_COUNT=$(echo "$RESULT" | grep -c '^[0-9]')
echo "Published: $PUBLISHED_COUNT salons"

# 残り件数
REMAINING=$(psql "$DB_URL" -t -A -c "
  SELECT COUNT(*) FROM salons WHERE published_at IS NULL AND is_active = true;
")
echo "Remaining: $REMAINING unpublished salons"
