#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
サロン診断CLIツール

サロンのスクレイピング状態を診断し、問題特定・再スクレイピングを支援する。

サブコマンド:
  diagnose      サロンのスクレイピング状態を診断
  test-extract  キャッシュHTMLで名前抽出テスト
  rescrape      特定サロンの再スクレイピング
  list-failed   失敗サロン一覧表示（理由別フィルタ）
  list-patterns CMSパターン一覧

Usage:
  python salon_diagnose.py diagnose 1234
  python salon_diagnose.py diagnose --url https://example.com/
  python salon_diagnose.py test-extract 1234
  python salon_diagnose.py rescrape 1234
  python salon_diagnose.py rescrape --zero-therapists --limit 10
  python salon_diagnose.py list-failed
  python salon_diagnose.py list-failed --reason domain_dead
  python salon_diagnose.py list-patterns

前提:
  - supabase start 済み (127.0.0.1:54322)
"""

import argparse
import json
import logging
import os
import sys
import time

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

sys.path.insert(0, os.path.dirname(__file__))
from fetch_utils import fetch_page, fetch_page_with_status, HEADERS
from html_cache_utils import HtmlCache
from name_extractor import extract_name, get_candidates

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

DB_DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

_cache = HtmlCache()


def get_conn():
    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = True
    return conn


# =============================================================================
# diagnose: サロンの状態診断
# =============================================================================

def cmd_diagnose(args):
    """サロンのスクレイピング状態を診断"""
    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if args.url:
        cur.execute("SELECT * FROM salons WHERE official_url = %s", (args.url,))
    else:
        cur.execute("SELECT * FROM salons WHERE id = %s", (args.salon_id,))

    salon = cur.fetchone()
    if not salon:
        print("サロンが見つかりません")
        return

    salon_id = salon["id"]
    print(f"\n{'='*60}")
    print(f" サロン診断: {salon['display_name'] or salon['name']}")
    print(f"{'='*60}")
    print(f"  ID:            {salon_id}")
    print(f"  name:          {salon['name']}")
    print(f"  display_name:  {salon['display_name']}")
    print(f"  official_url:  {salon['official_url']}")
    print(f"  is_active:     {salon['is_active']}")

    # scrape_cache
    cur.execute("SELECT * FROM salon_scrape_cache WHERE salon_id = %s", (salon_id,))
    cache = cur.fetchone()
    if cache:
        print(f"\n  --- Scrape Cache ---")
        print(f"  list_url:       {cache['therapist_list_url']}")
        print(f"  method:         {cache['extraction_method']}")
        print(f"  therapist_count: {cache['last_therapist_count']}")
        print(f"  fail_streak:    {cache['fail_streak']}")
        print(f"  fail_reason:    {cache.get('fail_reason', '-')}")
        print(f"  name_selector:  {cache.get('name_css_selector', '-')}")
        print(f"  last_scraped:   {cache['last_scraped_at']}")
    else:
        print(f"\n  --- Scrape Cache ---")
        print(f"  (なし)")

    # therapists count
    cur.execute("SELECT count(*) AS cnt FROM therapists WHERE salon_id = %s", (salon_id,))
    t_count = cur.fetchone()["cnt"]
    print(f"\n  --- Therapists ---")
    print(f"  DB登録数:      {t_count}名")

    if t_count > 0 and args.show_therapists:
        cur.execute("""
            SELECT id, name, source_url FROM therapists
            WHERE salon_id = %s ORDER BY id LIMIT 10
        """, (salon_id,))
        for t in cur.fetchall():
            print(f"    [{t['id']}] {t['name']} — {t['source_url']}")

    # ライブチェック
    if args.live:
        url = salon["official_url"]
        print(f"\n  --- ライブチェック ---")
        html, status = fetch_page_with_status(url)
        print(f"  status_code:   {status}")
        if html:
            print(f"  html_length:   {len(html)}")
            # HTMLキャッシュ
            cached = _cache.exists("salon", salon_id)
            print(f"  html_cached:   {cached}")
        else:
            print(f"  (取得失敗)")

    # scrape_log
    cur.execute("""
        SELECT step, method, success, detail, created_at
        FROM scrape_log WHERE salon_id = %s
        ORDER BY created_at DESC LIMIT 5
    """, (salon_id,))
    logs = cur.fetchall()
    if logs:
        print(f"\n  --- Scrape Log (最新5件) ---")
        for l in logs:
            ok = "OK" if l["success"] else "NG"
            print(f"    [{l['created_at']}] {l['step']}/{l['method']}: {ok} — {l['detail']}")

    print(f"{'='*60}")
    conn.close()


# =============================================================================
# test-extract: 名前抽出テスト
# =============================================================================

def cmd_test_extract(args):
    """キャッシュHTMLで名前抽出テスト"""
    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT t.id, t.name, t.source_url, t.salon_id,
               s.name AS salon_name, s.display_name AS salon_display
        FROM therapists t
        JOIN salons s ON s.id = t.salon_id
        WHERE t.salon_id = %s AND t.source_url IS NOT NULL
        ORDER BY t.id LIMIT %s
    """, (args.salon_id, args.limit))
    rows = cur.fetchall()

    if not rows:
        print("対象セラピストなし")
        return

    print(f"\n{'='*70}")
    print(f" 名前抽出テスト: salon_id={args.salon_id} ({len(rows)}名)")
    print(f"{'='*70}")

    for row in rows:
        tid = row["id"]
        html = _cache.load("therapist", tid)
        if not html:
            html = fetch_page(row["source_url"])
            if html:
                _cache.save("therapist", tid, html)
            else:
                print(f"  [{tid}] fetch失敗")
                continue
            time.sleep(0.3)

        result = extract_name(
            html,
            salon_name=row["salon_name"] or "",
            salon_display=row["salon_display"] or "",
            url=row["source_url"],
            use_llm=args.use_llm,
        )

        if result:
            status = "OK" if result["name"] == row["name"] else "DIFF"
            print(f"  [{tid}] DB: {row['name']:<15} → 抽出: {result['name']:<15} "
                  f"({result['source']}) [{status}]")
        else:
            print(f"  [{tid}] DB: {row['name']:<15} → 抽出失敗")

        if args.show_candidates:
            candidates = get_candidates(
                html,
                salon_name=row["salon_name"] or "",
                salon_display=row["salon_display"] or "",
            )
            for c in candidates:
                valid = "V" if c["valid"] else "x"
                print(f"          {valid} {c['source']:<25}: {c['text']}")

    conn.close()


# =============================================================================
# rescrape: 再スクレイピング
# =============================================================================

def cmd_rescrape(args):
    """特定サロンの再スクレイピング"""
    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if args.zero_therapists:
        cur.execute("""
            SELECT s.id, s.name, s.display_name, s.official_url
            FROM salons s
            WHERE s.official_url IS NOT NULL AND s.is_active = true
              AND NOT EXISTS (SELECT 1 FROM therapists t WHERE t.salon_id = s.id)
            ORDER BY s.id LIMIT %s
        """, (args.limit,))
        salons = cur.fetchall()
    elif args.salon_id:
        cur.execute("SELECT id, name, display_name, official_url FROM salons WHERE id = %s",
                    (args.salon_id,))
        salons = cur.fetchall()
    else:
        print("--salon-id or --zero-therapists が必要")
        return

    if not salons:
        print("対象なし")
        return

    print(f"再スクレイピング対象: {len(salons)}件")

    from smart_scraper import SmartScraper
    from batch_therapist_data import insert_therapist
    from pattern_validator import PatternValidator

    validator = PatternValidator()
    scraper = SmartScraper(db_conn=conn)

    total_inserted = 0
    write_cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    for salon in salons:
        salon_id = salon["id"]
        salon_name = salon["display_name"] or salon["name"]
        url = salon["official_url"]

        therapists = scraper.scrape_salon(salon_id, url, salon_name, max_therapists=0)

        inserted = 0
        for data in therapists:
            if validator.validate_therapist(data):
                if not args.dry_run:
                    t_id = insert_therapist(write_cur, salon_id, data)
                    if t_id:
                        inserted += 1
                else:
                    inserted += 1

        total_inserted += inserted
        log.info(f"  {salon_name}: {inserted}/{len(therapists)}名投入")

        if not args.dry_run:
            conn.commit()

        time.sleep(0.5)

    write_cur.close()
    conn.close()

    mode = "DRY-RUN" if args.dry_run else "LIVE"
    log.info(f"\n完了 ({mode}): {total_inserted}名投入")


# =============================================================================
# list-failed: 失敗サロン一覧
# =============================================================================

def cmd_list_failed(args):
    """失敗サロン一覧表示"""
    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if args.reason:
        cur.execute("""
            SELECT s.id, s.display_name, s.official_url, c.fail_reason, c.fail_streak
            FROM salons s
            LEFT JOIN salon_scrape_cache c ON c.salon_id = s.id
            WHERE s.official_url IS NOT NULL AND s.is_active = true
              AND NOT EXISTS (SELECT 1 FROM therapists t WHERE t.salon_id = s.id)
              AND c.fail_reason = %s
            ORDER BY s.id LIMIT %s
        """, (args.reason, args.limit))
    else:
        cur.execute("""
            SELECT s.id, s.display_name, s.official_url,
                   COALESCE(c.fail_reason, 'unclassified') AS fail_reason,
                   COALESCE(c.fail_streak, 0) AS fail_streak
            FROM salons s
            LEFT JOIN salon_scrape_cache c ON c.salon_id = s.id
            WHERE s.official_url IS NOT NULL AND s.is_active = true
              AND NOT EXISTS (SELECT 1 FROM therapists t WHERE t.salon_id = s.id)
            ORDER BY c.fail_reason, s.id LIMIT %s
        """, (args.limit,))

    rows = cur.fetchall()
    if not rows:
        print("対象なし")
        return

    # サマリー
    from collections import Counter
    reasons = Counter(r["fail_reason"] for r in rows)

    print(f"\n{'='*60}")
    print(f" 失敗サロン一覧 ({len(rows)}件)")
    print(f"{'='*60}")
    for reason, count in reasons.most_common():
        print(f"  {reason:<25} {count:>5}件")
    print(f"{'='*60}")

    if args.verbose:
        print(f"\n{'ID':>6} | {'サロン名':<20} | {'理由':<20} | URL")
        print(f"{'-'*6}-+-{'-'*20}-+-{'-'*20}-+-{'-'*40}")
        for r in rows:
            name = (r["display_name"] or "-")[:20]
            print(f"{r['id']:>6} | {name:<20} | {r['fail_reason']:<20} | {r['official_url']}")

    conn.close()


# =============================================================================
# list-patterns: CMSパターン一覧
# =============================================================================

def cmd_list_patterns(args):
    """CMSパターン一覧"""
    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT id, cms_name, confidence, success_count, fail_count, version,
               created_at, updated_at
        FROM cms_patterns
        ORDER BY confidence DESC
    """)
    rows = cur.fetchall()

    if not rows:
        print("CMSパターンなし")
        return

    print(f"\n{'='*80}")
    print(f" CMSパターン一覧 ({len(rows)}件)")
    print(f"{'='*80}")
    print(f"{'ID':>4} | {'CMS名':<30} | {'信頼度':>6} | {'成功':>5} | {'失敗':>5} | {'ver':>3}")
    print(f"{'-'*4}-+-{'-'*30}-+-{'-'*6}-+-{'-'*5}-+-{'-'*5}-+-{'-'*3}")
    for r in rows:
        print(f"{r['id']:>4} | {r['cms_name']:<30} | {r['confidence']:>6.2f} | "
              f"{r['success_count']:>5} | {r['fail_count']:>5} | {r['version']:>3}")

    # 利用サロン数
    cur.execute("""
        SELECT cms_pattern_id, count(*) AS cnt
        FROM salon_scrape_cache
        WHERE cms_pattern_id IS NOT NULL
        GROUP BY cms_pattern_id
    """)
    usage = {r["cms_pattern_id"]: r["cnt"] for r in cur.fetchall()}
    if usage:
        print(f"\n  利用サロン数:")
        for pid, cnt in sorted(usage.items()):
            print(f"    pattern_id={pid}: {cnt}サロン")

    print(f"{'='*80}")
    conn.close()


# =============================================================================
# メイン
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="サロン診断CLIツール")
    subparsers = parser.add_subparsers(dest="command", help="サブコマンド")

    # diagnose
    p_diag = subparsers.add_parser("diagnose", help="サロンの状態診断")
    p_diag.add_argument("salon_id", type=int, nargs="?", help="サロンID")
    p_diag.add_argument("--url", type=str, help="公式URLで検索")
    p_diag.add_argument("--live", action="store_true", help="ライブHTTPチェックも実行")
    p_diag.add_argument("--show-therapists", action="store_true", help="セラピスト一覧も表示")

    # test-extract
    p_test = subparsers.add_parser("test-extract", help="名前抽出テスト")
    p_test.add_argument("salon_id", type=int, help="サロンID")
    p_test.add_argument("--limit", type=int, default=10, help="テスト件数")
    p_test.add_argument("--use-llm", action="store_true", help="LLMフォールバックも使う")
    p_test.add_argument("--show-candidates", action="store_true", help="全候補テキストを表示")

    # rescrape
    p_re = subparsers.add_parser("rescrape", help="再スクレイピング")
    p_re.add_argument("salon_id", type=int, nargs="?", help="サロンID")
    p_re.add_argument("--zero-therapists", action="store_true",
                      help="セラピスト0名のサロン一括")
    p_re.add_argument("--limit", type=int, default=10, help="処理上限")
    p_re.add_argument("--dry-run", action="store_true", help="DB投入せず確認のみ")

    # list-failed
    p_fail = subparsers.add_parser("list-failed", help="失敗サロン一覧")
    p_fail.add_argument("--reason", type=str, help="理由でフィルタ")
    p_fail.add_argument("--limit", type=int, default=100, help="表示上限")
    p_fail.add_argument("--verbose", "-v", action="store_true", help="詳細表示")

    # list-patterns
    subparsers.add_parser("list-patterns", help="CMSパターン一覧")

    args = parser.parse_args()

    if args.command == "diagnose":
        cmd_diagnose(args)
    elif args.command == "test-extract":
        cmd_test_extract(args)
    elif args.command == "rescrape":
        cmd_rescrape(args)
    elif args.command == "list-failed":
        cmd_list_failed(args)
    elif args.command == "list-patterns":
        cmd_list_patterns(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
