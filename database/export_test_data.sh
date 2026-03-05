#!/bin/bash
# テスト用データエクスポート
# 対象: 7サロン x 10セラピスト + 口コミ + マスタ全件

set -euo pipefail

DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
OUT="/tmp/test_export.sql"

echo "-- テスト用データ (generated $(date))" > "$OUT"
echo "" >> "$OUT"

echo "=== マスタテーブル ==="
for table in prefectures areas looks_types body_types cup_types service_levels; do
  echo "  $table..."
  pg_dump "$DB" --data-only --no-owner --no-acl --inserts --on-conflict-do-nothing -t "$table" >> "$OUT"
done

echo "=== サロン 7件 ==="
psql "$DB" --no-align -t -c "
SELECT 'INSERT INTO salons SELECT * FROM json_populate_record(null::salons, ''' || row_to_json(s)::text || ''') ON CONFLICT DO NOTHING;'
FROM salons s WHERE id IN (143, 131, 649, 6152, 6175, 7413, 7458);
" >> "$OUT"

echo "=== salon_areas ==="
psql "$DB" --no-align -t -c "
SELECT 'INSERT INTO salon_areas (salon_id, area_id, display_order) VALUES (' || salon_id || ',' || area_id || ',' || COALESCE(display_order::text,'0') || ') ON CONFLICT DO NOTHING;'
FROM salon_areas WHERE salon_id IN (143, 131, 649, 6152, 6175, 7413, 7458);
" >> "$OUT"

echo "=== セラピスト 70人 ==="
psql "$DB" --no-align -t -c "
WITH ranked AS (
  SELECT t.id, t.salon_id,
    ROW_NUMBER() OVER (
      PARTITION BY t.salon_id
      ORDER BY (SELECT count(*) FROM reviews r WHERE r.therapist_id = t.id) DESC, t.id
    ) as rn
  FROM therapists t
  WHERE t.salon_id IN (143, 131, 649, 6152, 6175, 7413, 7458)
    AND t.status = 'active'
)
SELECT 'INSERT INTO therapists SELECT * FROM json_populate_record(null::therapists, ''' || replace(row_to_json(t)::text, '''', '''''') || ''') ON CONFLICT DO NOTHING;'
FROM therapists t
JOIN ranked r ON r.id = t.id
WHERE r.rn <= 10;
" >> "$OUT"

echo "=== 口コミ ==="
psql "$DB" --no-align -t -c "
WITH ranked AS (
  SELECT t.id,
    ROW_NUMBER() OVER (
      PARTITION BY t.salon_id
      ORDER BY (SELECT count(*) FROM reviews r WHERE r.therapist_id = t.id) DESC, t.id
    ) as rn
  FROM therapists t
  WHERE t.salon_id IN (143, 131, 649, 6152, 6175, 7413, 7458)
    AND t.status = 'active'
),
target_ids AS (SELECT id FROM ranked WHERE rn <= 10)
SELECT 'INSERT INTO reviews SELECT * FROM json_populate_record(null::reviews, ''' || replace(row_to_json(r)::text, '''', '''''') || ''') ON CONFLICT DO NOTHING;'
FROM reviews r
WHERE r.therapist_id IN (SELECT id FROM target_ids);
" >> "$OUT"

echo ""
echo "=== 完了 ==="
wc -l "$OUT"
du -h "$OUT"
echo "出力: $OUT"
