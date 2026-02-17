#!/usr/bin/env python3
"""
Step 3: Indexer DBに口コミ投入

rewritten_reviews.json を読み込み、ローカルPGのreviewsテーブルにINSERT。

Usage:
  python database/seed_reviews/step3_insert_reviews.py              # 全件投入
  python database/seed_reviews/step3_insert_reviews.py --dry-run    # 確認のみ
  python database/seed_reviews/step3_insert_reviews.py --limit 100  # テスト
"""

import argparse
import json
import os
import random
import sys
from datetime import datetime, timedelta, timezone

import psycopg2

sys.path.insert(0, os.path.dirname(__file__))
from common import DATA_DIR, connect_indexer

# ---------------------------------------------------------------------------
# 定数
# ---------------------------------------------------------------------------
INPUT_PATH = os.path.join(DATA_DIR, "rewritten_reviews.json")
BATCH_SIZE = 500

# 有効な値の範囲
VALID_LOOKS_TYPE_IDS = set(range(1, 9))    # 1-8
VALID_BODY_TYPE_IDS = set(range(1, 5))     # 1-4
VALID_CUP_TYPE_IDS = set(range(1, 5))      # 1-4
VALID_SERVICE_LEVEL_IDS = set(range(1, 4)) # 1-3

INSERT_SQL = """
INSERT INTO reviews (
    user_id, therapist_id, salon_id,
    looks_type_id, body_type_id, cup_type_id, service_level_id,
    param_conversation, param_distance, param_technique, param_personality,
    score,
    comment_reason, comment_first_impression, comment_style,
    comment_service, comment_service_detail,
    comment_cost, cost_total, comment_revisit, comment_advice,
    is_seed, is_verified, moderation_status, created_at
) VALUES (
    NULL, %s, %s,
    %s, %s, %s, %s,
    %s, %s, %s, %s,
    %s,
    %s, %s, %s,
    %s, %s,
    %s, %s, %s, %s,
    true, false, 'approved', %s
)
"""


# ---------------------------------------------------------------------------
# 日付ジッター
# ---------------------------------------------------------------------------
def jitter_date(date_str: str | None) -> datetime:
    """元の日付から±1〜30日ずらした日時を返す。未来日はクランプ。"""
    now = datetime.now(timezone.utc)

    if date_str:
        try:
            # "2024/11/10" or "2024-11-10" 形式
            date_str = date_str.replace("/", "-")
            base = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            base = now - timedelta(days=random.randint(30, 365))
    else:
        base = now - timedelta(days=random.randint(30, 365))

    offset_days = random.randint(-30, 30)
    result = base + timedelta(days=offset_days)

    # 未来日はクランプ（昨日まで）
    yesterday = now - timedelta(days=1)
    if result > yesterday:
        result = yesterday - timedelta(days=random.randint(1, 30))

    return result


# ---------------------------------------------------------------------------
# バリデーション
# ---------------------------------------------------------------------------
def clamp(val, lo, hi):
    """int値を範囲内にクランプ。Noneはそのまま返す。"""
    if val is None:
        return None
    try:
        val = int(val)
    except (TypeError, ValueError):
        return None
    return max(lo, min(hi, val))


def validate_id(val, valid_set):
    """マスタIDの妥当性チェック。範囲外はNone。"""
    if val is None:
        return None
    try:
        val = int(val)
    except (TypeError, ValueError):
        return None
    return val if val in valid_set else None


def pick_earliest_date(reviews_raw_from_input: list[dict] | None) -> str | None:
    """raw_matched_therapistsにある口コミの中から最も古い日付を返す"""
    # rewritten_reviews.jsonにはreviews_rawが含まれていないので、
    # created_atはランダムジッターで生成する
    return None


# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Step 3: DB投入")
    parser.add_argument("--dry-run", action="store_true", help="確認のみ（INSERT実行しない）")
    parser.add_argument("--limit", type=int, default=None, help="投入件数制限")
    args = parser.parse_args()

    print("=" * 60)
    print("Step 3: reviews テーブルにseed口コミ投入")
    if args.dry_run:
        print("  *** DRY RUN ***")
    print("=" * 60)

    # 入力読み込み
    if not os.path.exists(INPUT_PATH):
        print(f"エラー: {INPUT_PATH} が見つかりません。Step 2を先に実行してください。")
        sys.exit(1)

    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    reviews = data["reviews"]
    if args.limit:
        reviews = reviews[: args.limit]

    print(f"\n投入対象: {len(reviews):,}件")

    # rawデータも読み込み（日付取得用）
    raw_path = os.path.join(DATA_DIR, "raw_matched_therapists.json")
    date_map = {}  # therapist_id → earliest review date
    if os.path.exists(raw_path):
        with open(raw_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        for m in raw.get("matches", []):
            tid = m["indexer_therapist_id"]
            dates = [r.get("date") for r in m.get("reviews_raw", []) if r.get("date")]
            if dates:
                # 最も古い日付を使用
                dates.sort()
                date_map[tid] = dates[0]

    # DB接続
    conn = connect_indexer()
    cur = conn.cursor()

    # 既存seed口コミの重複チェック
    cur.execute("SELECT therapist_id FROM reviews WHERE is_seed = true")
    existing_seed_tids = {row[0] for row in cur.fetchall()}
    if existing_seed_tids:
        print(f"  既存seed口コミ: {len(existing_seed_tids)}件 → スキップ")

    inserted = 0
    skipped = 0
    errors = 0

    for i, review in enumerate(reviews):
        tid = review.get("indexer_therapist_id")
        sid = review.get("indexer_salon_id")

        if not tid or not sid:
            errors += 1
            continue

        # 重複スキップ
        if tid in existing_seed_tids:
            skipped += 1
            continue

        # バリデーション
        looks_type_id = validate_id(review.get("looks_type_id"), VALID_LOOKS_TYPE_IDS)
        body_type_id = validate_id(review.get("body_type_id"), VALID_BODY_TYPE_IDS)
        cup_type_id = validate_id(review.get("cup_type_id"), VALID_CUP_TYPE_IDS)
        service_level_id = validate_id(review.get("service_level_id"), VALID_SERVICE_LEVEL_IDS)

        score = clamp(review.get("score"), 0, 100)
        param_conv = clamp(review.get("param_conversation"), 1, 5)
        param_dist = clamp(review.get("param_distance"), 1, 5)
        param_tech = clamp(review.get("param_technique"), 1, 5)
        param_pers = clamp(review.get("param_personality"), 1, 5)
        cost_total = review.get("cost_total")
        if cost_total is not None:
            try:
                cost_total = int(cost_total)
            except (TypeError, ValueError):
                cost_total = None

        # 日付ジッター
        base_date = date_map.get(tid)
        created_at = jitter_date(base_date)

        params = (
            tid, sid,
            looks_type_id, body_type_id, cup_type_id, service_level_id,
            param_conv, param_dist, param_tech, param_pers,
            score,
            review.get("comment_reason"),
            review.get("comment_first_impression"),
            review.get("comment_style"),
            review.get("comment_service"),
            review.get("comment_service_detail"),
            review.get("comment_cost"),
            cost_total,
            review.get("comment_revisit"),
            review.get("comment_advice"),
            created_at,
        )

        if not args.dry_run:
            try:
                cur.execute(INSERT_SQL, params)
                inserted += 1
            except Exception as e:
                errors += 1
                if errors <= 5:
                    print(f"  ERROR (tid={tid}): {e}")
                conn.rollback()
                continue
        else:
            inserted += 1

        # バッチコミット
        if not args.dry_run and inserted % BATCH_SIZE == 0:
            conn.commit()
            print(f"  COMMIT: {inserted:,}件完了")

    # 最終コミット
    if not args.dry_run:
        conn.commit()

    cur.close()
    conn.close()

    # 結果表示
    print("\n" + "=" * 60)
    print("結果")
    print("=" * 60)
    print(f"  投入: {inserted:,}件")
    print(f"  スキップ（重複）: {skipped:,}件")
    print(f"  エラー: {errors:,}件")

    if args.dry_run:
        print("\n  *** DRY RUN: 実際のINSERTは実行されていません ***")
    else:
        print("\n検証クエリ:")
        print("  SELECT count(*) FROM reviews WHERE is_seed = true;")
        print("  SELECT looks_type_id, count(*) FROM reviews WHERE is_seed GROUP BY 1 ORDER BY 1;")
        print("  SELECT avg(score) FROM reviews WHERE is_seed;")


if __name__ == "__main__":
    main()
