#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
失敗サロン理由分類

セラピスト未取得の2,977サロンを「なぜ取れなかったか」で分類し、
salon_scrape_cache.fail_reason に書き込む。

分類:
  domain_dead       DNS解決不可
  site_down         サーバー応答なし（timeout/connection refused）
  page_404          サイトは生きてるがページが404
  ssl_error         SSL証明書エラー（HTTP fallbackも失敗）
  no_therapist_page セラピスト一覧ページが存在しない
  no_therapist_urls 一覧ページはあるがURL抽出失敗
  empty_page        中身が空/極小
  other             上記以外

Usage:
  python classify_failures.py --dry-run       # 分類だけ表示
  python classify_failures.py                 # DB書き込み
  python classify_failures.py --limit 50      # 50件だけ

前提:
  - supabase start 済み (127.0.0.1:54322)
"""

import argparse
import logging
import os
import sys
import time
from collections import Counter

import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

sys.path.insert(0, os.path.dirname(__file__))
from fetch_utils import HEADERS

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


def get_failed_salons(cur, limit=0):
    """セラピスト未取得サロンを取得"""
    query = """
        SELECT s.id, s.name, s.display_name, s.official_url
        FROM salons s
        WHERE s.official_url IS NOT NULL
          AND s.is_active = true
          AND NOT EXISTS (
              SELECT 1 FROM therapists t WHERE t.salon_id = s.id
          )
        ORDER BY s.id
    """
    if limit > 0:
        query += f" LIMIT {limit}"
    cur.execute(query)
    return cur.fetchall()


def classify_one(url, timeout=10):
    """
    URLにアクセスして失敗理由を分類。

    Returns:
        (fail_reason, detail)
    """
    if not url:
        return "other", "no_url"

    # Step 1: HEAD でまず試す
    try:
        resp = requests.head(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        status = resp.status_code
    except requests.exceptions.SSLError:
        # HTTPS SSL error → HTTP fallback
        if url.startswith('https://'):
            http_url = 'http://' + url[len('https://'):]
            try:
                resp = requests.head(http_url, headers=HEADERS, timeout=timeout,
                                     allow_redirects=True)
                status = resp.status_code
            except requests.exceptions.ConnectionError:
                return "site_down", "http_fallback_connection_error"
            except requests.exceptions.Timeout:
                return "site_down", "http_fallback_timeout"
            except Exception as e:
                return "ssl_error", f"https_ssl_http_fail: {e}"
        else:
            return "ssl_error", "ssl_error_non_https"
    except requests.exceptions.ConnectionError as e:
        err_str = str(e).lower()
        if "name or service not known" in err_str or "nodename nor servname" in err_str:
            return "domain_dead", "dns_resolution_failed"
        if "connection refused" in err_str:
            return "site_down", "connection_refused"
        # HTTP fallback
        if url.startswith('https://'):
            http_url = 'http://' + url[len('https://'):]
            try:
                resp = requests.head(http_url, headers=HEADERS, timeout=timeout,
                                     allow_redirects=True)
                status = resp.status_code
            except Exception:
                return "site_down", f"connection_error: {e}"
        else:
            return "site_down", f"connection_error: {e}"
    except requests.exceptions.Timeout:
        return "site_down", "timeout"
    except Exception as e:
        return "other", f"head_error: {e}"

    if status == 404:
        return "page_404", f"status={status}"
    if status >= 500:
        return "site_down", f"status={status}"
    if status >= 400:
        return "page_404", f"status={status}"

    # Step 2: ステータス200だがセラピスト一覧が見つからなかったケース
    # GET で中身を確認
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        html = resp.text
        if len(html) < 500:
            return "empty_page", f"html_length={len(html)}"

        # セラピスト関連リンクがあるか簡易チェック
        html_lower = html.lower()
        has_therapist_link = any(
            kw in html_lower
            for kw in ['/cast', '/staff', '/therapist', '/girl',
                       'セラピスト', 'キャスト', 'スタッフ', '在籍']
        )
        if not has_therapist_link:
            return "no_therapist_page", "no_therapist_keywords_in_html"

        return "no_therapist_urls", "site_ok_but_extraction_failed"

    except Exception as e:
        return "other", f"get_error: {e}"


def main():
    parser = argparse.ArgumentParser(description="失敗サロン理由分類")
    parser.add_argument("--limit", type=int, default=0, help="処理件数制限（0=全件）")
    parser.add_argument("--dry-run", action="store_true", help="DB更新せず分類だけ表示")
    parser.add_argument("--workers", type=int, default=1, help="並列数（デフォルト1）")
    args = parser.parse_args()

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    rows = get_failed_salons(cur, limit=args.limit)
    log.info(f"対象: {len(rows)}件のセラピスト未取得サロン")

    if not rows:
        log.info("処理対象なし")
        conn.close()
        return

    counts = Counter()
    update_cur = conn.cursor()

    for i, row in enumerate(rows):
        salon_id = row["id"]
        salon_name = row["display_name"] or row["name"]
        url = row["official_url"]

        reason, detail = classify_one(url)
        counts[reason] += 1

        log.info(f"[{i+1}/{len(rows)}] {salon_name}: {reason} ({detail})")

        if not args.dry_run:
            update_cur.execute("""
                INSERT INTO salon_scrape_cache (salon_id, fail_reason, last_scraped_at)
                VALUES (%s, %s, now())
                ON CONFLICT (salon_id) DO UPDATE SET
                    fail_reason = EXCLUDED.fail_reason,
                    last_scraped_at = now()
            """, (salon_id, reason))

        time.sleep(0.2)

    update_cur.close()
    conn.close()

    # サマリー
    mode = "DRY-RUN" if args.dry_run else "LIVE"
    log.info(f"\n{'='*60}")
    log.info(f" 分類完了 ({mode})")
    log.info(f"{'='*60}")
    for reason, count in counts.most_common():
        pct = count / len(rows) * 100
        log.info(f"  {reason:<25} {count:>5}件 ({pct:.1f}%)")
    log.info(f"  {'合計':<25} {len(rows):>5}件")
    log.info(f"{'='*60}")


if __name__ == "__main__":
    main()
