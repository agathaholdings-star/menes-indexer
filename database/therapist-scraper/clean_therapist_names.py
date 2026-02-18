#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
セラピスト名クレンジング & source_url重複解消

名前に混入したゴミ（年齢、NEW FACE、ローマ字括弧、キャッチコピー）を
SQLで一括除去する。元データはname_rawに退避。

Usage:
  python clean_therapist_names.py --dry-run     # 確認のみ
  python clean_therapist_names.py --execute     # 本番適用
  python clean_therapist_names.py --dedup --dry-run   # 重複確認
  python clean_therapist_names.py --dedup --execute   # 重複解消
"""

import argparse
import logging
import os
import re
import sys

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DB_DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# =============================================================================
# クレンジングパターン（この順序で適用）
# =============================================================================

PATTERNS = [
    # 1. キャッチコピー除去: ～/〜 以降を削除
    ("catchphrase", re.compile(r'[～〜].+$')),
    # 2. NEW FACE除去
    ("new_face", re.compile(r'\s*(?:NEW\s*FACE|NEWFACE|新人)\s*', re.IGNORECASE)),
    # 3. ローマ字括弧除去: (English Text)
    ("romaji_paren", re.compile(r'\s*\([A-Za-z\s]+\)\s*$')),
    # 4. 年齢括弧除去: (24歳) or (24)
    ("age_paren", re.compile(r'\s*[\(（](\d{2})歳?[\)）]\s*$')),
]


def clean_name(name: str) -> str:
    """4パターンを順に適用して名前をクレンジング"""
    result = name
    for _, pattern in PATTERNS:
        result = pattern.sub('', result)
    return result.strip()


def run_cleansing(conn, dry_run: bool):
    """名前クレンジング実行"""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # 各パターンの該当件数を計測
    pattern_counts = {}
    for label, pattern in PATTERNS:
        cur.execute("SELECT id, name FROM therapists WHERE name IS NOT NULL")
        count = 0
        for row in cur:
            if pattern.search(row['name']):
                count += 1
        pattern_counts[label] = count
        log.info(f"  {label}: {count}件")

    # 対象レコード取得（いずれかのパターンにマッチ）
    cur.execute("SELECT id, name, name_raw FROM therapists WHERE name IS NOT NULL")
    rows = cur.fetchall()

    targets = []
    for row in rows:
        cleaned = clean_name(row['name'])
        if cleaned != row['name'] and cleaned:
            targets.append({
                'id': row['id'],
                'old_name': row['name'],
                'new_name': cleaned,
                'has_name_raw': row['name_raw'] is not None,
            })

    log.info(f"\n合計変更対象: {len(targets)}件")

    if not targets:
        log.info("変更対象なし")
        return

    # サンプル表示
    log.info("\nサンプル（最大20件）:")
    for t in targets[:20]:
        log.info(f"  ID={t['id']}: 「{t['old_name']}」→「{t['new_name']}」")

    if dry_run:
        log.info("\n[DRY RUN] DB変更なし")
        return

    # 本番適用
    update_cur = conn.cursor()
    updated = 0
    for t in targets:
        # name_rawが空の場合のみ退避（既に退避済みなら上書きしない）
        if not t['has_name_raw']:
            update_cur.execute(
                "UPDATE therapists SET name_raw = name WHERE id = %s AND name_raw IS NULL",
                (t['id'],),
            )
        update_cur.execute(
            "UPDATE therapists SET name = %s WHERE id = %s",
            (t['new_name'], t['id']),
        )
        updated += 1

    conn.commit()
    update_cur.close()
    log.info(f"\n{updated}件更新完了")


def run_dedup(conn, dry_run: bool):
    """source_url重複レコード解消"""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # 重複source_url検出
    cur.execute("""
        SELECT source_url, count(*) AS cnt,
               array_agg(id ORDER BY id) AS ids
        FROM therapists
        WHERE source_url IS NOT NULL AND source_url != ''
        GROUP BY source_url
        HAVING count(*) > 1
        ORDER BY count(*) DESC
    """)
    duplicates = cur.fetchall()

    if not duplicates:
        log.info("重複なし")
        return

    total_urls = len(duplicates)
    total_records = sum(row['cnt'] for row in duplicates)
    to_delete = total_records - total_urls
    log.info(f"重複source_url: {total_urls}件 ({total_records}レコード → {total_urls}件に圧縮、{to_delete}件削除)")

    # 口コミ紐づき確認
    delete_ids = []
    for row in duplicates:
        ids = row['ids']
        # 口コミが紐づいているIDを優先保持
        cur.execute("""
            SELECT DISTINCT therapist_id
            FROM reviews
            WHERE therapist_id = ANY(%s)
        """, (ids,))
        review_ids = {r['therapist_id'] for r in cur.fetchall()}

        if review_ids:
            # 口コミありのIDを残す（複数あれば最小ID）
            keep_id = min(review_ids)
        else:
            # 口コミなし → 最小IDを残す
            keep_id = min(ids)

        for tid in ids:
            if tid != keep_id:
                delete_ids.append(tid)

    log.info(f"削除対象: {len(delete_ids)}件")

    # サンプル表示
    log.info("\nサンプル（最大10件）:")
    for row in duplicates[:10]:
        log.info(f"  {row['source_url']}: IDs={row['ids']} (keep={min(row['ids'])})")

    if dry_run:
        log.info("\n[DRY RUN] DB変更なし")
        return

    # 本番適用
    if delete_ids:
        update_cur = conn.cursor()
        # まず口コミの参照を保持IDに付け替え
        for row in duplicates:
            ids = row['ids']
            keep_id = min(ids)
            other_ids = [tid for tid in ids if tid != keep_id]
            if other_ids:
                update_cur.execute("""
                    UPDATE reviews SET therapist_id = %s
                    WHERE therapist_id = ANY(%s)
                """, (keep_id, other_ids))

        # 削除
        update_cur.execute(
            "DELETE FROM therapists WHERE id = ANY(%s)",
            (delete_ids,),
        )
        conn.commit()
        update_cur.close()
        log.info(f"\n{len(delete_ids)}件削除完了")

        # 検証
        cur.execute("""
            SELECT count(*) AS cnt
            FROM therapists
            WHERE source_url IS NOT NULL AND source_url != ''
            GROUP BY source_url
            HAVING count(*) > 1
        """)
        remaining = cur.fetchall()
        log.info(f"残り重複: {len(remaining)}件")


def main():
    parser = argparse.ArgumentParser(description="セラピスト名クレンジング & 重複解消")
    parser.add_argument("--dry-run", action="store_true", help="確認のみ（DB変更しない）")
    parser.add_argument("--execute", action="store_true", help="本番適用")
    parser.add_argument("--dedup", action="store_true", help="source_url重複解消")
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        print("--dry-run または --execute を指定してください")
        sys.exit(1)

    dry_run = args.dry_run

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False

    if args.dedup:
        log.info("=" * 60)
        log.info(" source_url重複解消")
        log.info("=" * 60)
        run_dedup(conn, dry_run)
    else:
        log.info("=" * 60)
        log.info(" セラピスト名クレンジング")
        log.info("=" * 60)
        run_cleansing(conn, dry_run)

    conn.close()


if __name__ == "__main__":
    main()
