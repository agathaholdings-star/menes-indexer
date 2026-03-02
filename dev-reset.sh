#!/bin/bash
# 開発環境リセットスクリプト
# supabase db reset + データ復元を一発で実行
# 使い方: bash dev-reset.sh

set -e

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DUMP="database/dumps/local_dev.sql.gz"

echo "=== 開発環境リセット ==="

# 1. supabase db reset（マイグレーション + seed.sql実行）
echo "[1/3] supabase db reset..."
supabase db reset --linked=false

# 2. データ復元
echo "[2/3] データ復元中... ($DUMP)"
gunzip -c "$DUMP" | psql "$DB_URL" -q 2>&1 | grep -v "already exists" || true

# 3. 確認
echo "[3/3] 確認..."
psql "$DB_URL" -c "
SELECT 'salons' as tbl, count(*) FROM salons
UNION ALL SELECT 'therapists', count(*) FROM therapists
UNION ALL SELECT 'reviews', count(*) FROM reviews
UNION ALL SELECT 'areas', count(*) FROM areas
ORDER BY 1;"

# テストアカウント確認
echo ""
echo "テストアカウント:"
psql "$DB_URL" -c "SELECT email FROM auth.users LIMIT 5;"
echo ""
echo "=== 完了 ==="
echo "ログイン: test@example.com / test1234 (VIP)"
