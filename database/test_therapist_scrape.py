#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
セラピストスクレイピング テスト
Supabase shops テーブルのサロンURLからセラピスト情報を取得 → therapists テーブルに投入

使い方:
  # デフォルト3件テスト（各サロン最大5名）
  python database/test_therapist_scrape.py

  # 特定のshop_idを指定
  python database/test_therapist_scrape.py --ids 157 159 162

  # 件数と人数を指定
  python database/test_therapist_scrape.py --limit 5 --max-therapists 3

  # ドライラン（スクレイピングのみ、DB投入なし）
  python database/test_therapist_scrape.py --dry-run
"""

import os
import sys
import json
import argparse
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# TherapistScraper を import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'therapist-scraper'))
from therapist_scraper import TherapistScraper

DB_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


def get_target_shops(cur, shop_ids=None, limit=3):
    """対象サロンを取得"""
    if shop_ids:
        cur.execute(
            "SELECT id, name, display_name, official_url FROM salons "
            "WHERE id = ANY(%s) AND official_url IS NOT NULL ORDER BY id",
            (shop_ids,)
        )
    else:
        cur.execute(
            "SELECT id, name, display_name, official_url FROM salons "
            "WHERE official_url IS NOT NULL ORDER BY id LIMIT %s",
            (limit,)
        )
    return cur.fetchall()


def insert_therapist(cur, salon_id, t):
    """セラピスト1名をINSERT。成功時therapist_id、失敗時None"""
    t_name = t.get('name')
    if not t_name:
        return None

    bust_val = t.get('bust')
    if bust_val is not None:
        bust_val = str(bust_val)

    image_urls = t.get('image_urls') or []
    if isinstance(image_urls, str):
        try:
            image_urls = json.loads(image_urls)
        except json.JSONDecodeError:
            image_urls = [image_urls]

    try:
        cur.execute("""
            INSERT INTO therapists (
                salon_id, name, age, height,
                bust, waist, hip, image_urls,
                profile_text, source_url, status, last_scraped_at
            ) VALUES (
                %(salon_id)s, %(name)s, %(age)s, %(height)s,
                %(bust)s, %(waist)s, %(hip)s, %(image_urls)s::jsonb,
                %(profile_text)s, %(source_url)s, 'active', now()
            )
            ON CONFLICT (salon_id, slug) DO NOTHING
            RETURNING id
        """, {
            'salon_id': salon_id,
            'name': t_name,
            'age': t.get('age'),
            'height': t.get('height'),
            'bust': bust_val,
            'waist': t.get('waist'),
            'hip': t.get('hip'),
            'image_urls': json.dumps(image_urls, ensure_ascii=False),
            'profile_text': t.get('profile_text'),
            'source_url': t.get('source_url'),
        })
        row = cur.fetchone()
        if not row:
            return None
        t_id = row['id']
        cur.execute("UPDATE therapists SET slug = %s WHERE id = %s", (str(t_id), t_id))
        return t_id
    except Exception as e:
        print(f"      DB error: {e}")
        cur.connection.rollback()
        return None


def main():
    parser = argparse.ArgumentParser(description='セラピストスクレイピング テスト')
    parser.add_argument('--ids', type=int, nargs='+', help='対象shop_id（複数指定可）')
    parser.add_argument('--limit', type=int, default=3, help='テスト対象サロン数（デフォルト3）')
    parser.add_argument('--max-therapists', type=int, default=5, help='サロンあたり最大取得人数（デフォルト5）')
    parser.add_argument('--dry-run', action='store_true', help='スクレイピングのみ、DB投入しない')
    args = parser.parse_args()

    # DB接続
    print("=" * 60)
    print(" セラピストスクレイピング テスト")
    print("=" * 60)

    try:
        conn = psycopg2.connect(DB_DSN)
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        print("[DB] ローカルSupabase接続OK")
    except Exception as e:
        print(f"[DB] 接続失敗: {e}")
        print("  → supabase start を実行してください")
        sys.exit(1)

    # 対象サロン取得
    shops = get_target_shops(cur, args.ids, args.limit)
    if not shops:
        print("対象サロンが0件です")
        conn.close()
        return

    print(f"\n対象サロン: {len(shops)}件")
    for s in shops:
        print(f"  [{s['id']}] {s['display_name']} - {s['official_url']}")

    if args.dry_run:
        print("\n[DRY-RUN] DB投入なし\n")

    # スクレイピング実行
    scraper = TherapistScraper()
    results = {}  # shop_id -> list of therapist data

    for shop in shops:
        salon_id = shop['id']
        therapists = scraper.scrape_salon(
            shop['official_url'],
            shop['display_name'],
            max_therapists=args.max_therapists,
        )
        results[salon_id] = therapists

        if not therapists:
            print(f"  → セラピスト取得なし\n")
            continue

        # DB投入
        if not args.dry_run:
            inserted = 0
            for t in therapists:
                t_id = insert_therapist(cur, salon_id, t)
                if t_id:
                    inserted += 1
                    print(f"      ✓ {t.get('name')} → therapist_id={t_id}")
                else:
                    print(f"      ✗ {t.get('name', '?')} INSERT失敗")
            conn.commit()
            print(f"  → DB投入: {inserted}/{len(therapists)}名\n")

    # サマリ
    print("=" * 60)
    print(" テスト結果サマリ")
    print("=" * 60)
    total_scraped = 0
    for shop in shops:
        sid = shop['id']
        ts = results.get(sid, [])
        total_scraped += len(ts)
        status = f"{len(ts)}名取得" if ts else "取得なし"
        print(f"  [{sid}] {shop['display_name']}: {status}")

    print(f"\n  合計: {total_scraped}名スクレイピング")

    if not args.dry_run:
        cur.execute("SELECT count(*) AS cnt FROM therapists")
        print(f"  therapists テーブル: {cur.fetchone()['cnt']}件")

        # 投入済みデータプレビュー
        cur.execute("""
            SELECT t.name, t.age, t.height, t.bust, t.waist, t.hip,
                   s.display_name AS shop_name
            FROM therapists t
            JOIN salons s ON s.id = t.salon_id
            ORDER BY t.created_at DESC LIMIT 15
        """)
        rows = cur.fetchall()
        if rows:
            print(f"\n  直近の投入データ:")
            for r in rows:
                age = f"{r['age']}歳" if r['age'] else '?歳'
                h = f"{r['height']}cm" if r['height'] else '?cm'
                sizes = f"B{r['bust'] or '?'}/W{r['waist'] or '?'}/H{r['hip'] or '?'}"
                print(f"    {r['name']} ({age}, {h}, {sizes}) @ {r['shop_name']}")

    conn.close()
    print("\n完了!")


if __name__ == '__main__':
    main()
