#!/bin/bash
# ローカルSupabaseにダンプデータを復元するスクリプト
# 使い方: supabase db reset && bash database/dumps/restore_local.sh

set -e

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DUMP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== ローカルSupabase データ復元 ==="
echo "DB: $DB_URL"
echo "ダンプ: $DUMP_DIR"
echo ""

# FK制約を一時的に無効化
echo "[1/8] FK制約を一時無効化..."
psql "$DB_URL" -q -c "ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_therapist_id_fkey;"
psql "$DB_URL" -q -c "ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_shop_id_fkey;"
psql "$DB_URL" -q -c "ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_therapist_id_fkey;"

# テーブルクリア（seed.sqlで入るprefectures/areasは残す）
echo "[2/8] 既存データをクリア..."
psql "$DB_URL" -q -c "TRUNCATE reviews, therapists, salon_areas, salons CASCADE;"

# salons + salon_areas復元
echo "[3/8] salons + salon_areas 復元中..."
gunzip -c "$DUMP_DIR/salons_dump.sql.gz" | psql "$DB_URL" -q
SALON_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM salons;")
echo "  salons: ${SALON_COUNT// /}件"

# therapists復元（ダンプにblood_typeカラムがあるので一時追加→削除）
echo "[4/8] therapists 復元中... (時間かかります)"
psql "$DB_URL" -q -c "ALTER TABLE therapists ADD COLUMN IF NOT EXISTS blood_type text;"
if [ -f "$DUMP_DIR/therapists_with_storage_urls.sql.gz" ]; then
  echo "  Storage URL版を使用..."
  gunzip -c "$DUMP_DIR/therapists_with_storage_urls.sql.gz" | psql "$DB_URL" -q
else
  echo "  Haiku dump版を使用..."
  gunzip -c "$DUMP_DIR/therapists_haiku_dump.sql.gz" | psql "$DB_URL" -q
  if [ -f "$DUMP_DIR/therapists_vps.sql" ]; then
    echo "  VPS therapists も復元中..."
    psql "$DB_URL" -q < "$DUMP_DIR/therapists_vps.sql"
  fi
fi
psql "$DB_URL" -q -c "ALTER TABLE therapists DROP COLUMN IF EXISTS blood_type;"
THERAPIST_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM therapists;")
echo "  therapists: ${THERAPIST_COUNT// /}件"

# reviews復元
echo "[5/8] reviews 復元中..."
gunzip -c "$DUMP_DIR/reviews_dump.sql.gz" | psql "$DB_URL" -q
REVIEW_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM reviews;")
echo "  reviews: ${REVIEW_COUNT// /}件"

# FK制約を復元
echo "[6/8] FK制約を復元..."
psql "$DB_URL" -q -c "ALTER TABLE reviews ADD CONSTRAINT reviews_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES therapists(id);"
psql "$DB_URL" -q -c "ALTER TABLE reviews ADD CONSTRAINT reviews_shop_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id);"
psql "$DB_URL" -q -c "ALTER TABLE favorites ADD CONSTRAINT favorites_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES therapists(id);"

# person_id投入（移籍検知用）
PERSON_SQL="$(cd "$(dirname "$0")/.." && pwd)/populate_person_id.sql"
if [ -f "$PERSON_SQL" ]; then
  echo "[7/8] person_id 投入中..."
  psql "$DB_URL" -q -f "$PERSON_SQL"
else
  echo "[7/8] person_id スキップ（populate_person_id.sql が見つかりません）"
fi

echo ""
echo "=== 復元完了 ==="
psql "$DB_URL" -c "
SELECT 'salons' as tbl, count(*) FROM salons
UNION ALL SELECT 'salon_areas', count(*) FROM salon_areas
UNION ALL SELECT 'therapists', count(*) FROM therapists
UNION ALL SELECT 'reviews', count(*) FROM reviews
UNION ALL SELECT 'person_ids', count(DISTINCT person_id) FROM therapists WHERE person_id IS NOT NULL
ORDER BY 1;"
