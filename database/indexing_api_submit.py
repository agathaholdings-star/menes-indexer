#!/usr/bin/env python3
"""
Google Indexing API バッチ送信スクリプト

口コミありセラピストのURLをGoogle Indexing APIに送信して
クロールを促進する。1日200URLの制限あり。

使い方:
  python3 indexing_api_submit.py          # ドライラン（送信しない）
  python3 indexing_api_submit.py --submit # 実際に送信
  python3 indexing_api_submit.py --submit --limit 50  # 50件だけ送信
"""

import json
import os
import sys
import argparse
from datetime import datetime, timezone
from pathlib import Path

import httplib2
from google.oauth2 import service_account
from googleapiclient.discovery import build

# --- 設定 ---
KEY_FILE = os.path.expanduser("~/Downloads/menes-skr-b4ff611b2acf.json")
SCOPES = ["https://www.googleapis.com/auth/indexing"]
BASE_URL = "https://menes-skr.com"
DAILY_LIMIT = 200
LOG_FILE = Path(__file__).parent / "indexing_api_log.json"

# --- DB接続 ---
DB_URL = "postgresql://postgres.oycayfewhqrezvhbbhzm:PgQA4SRZSLeAxtEq@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"


def get_priority_urls(limit: int = 200) -> list[str]:
    """口コミありセラピストURLを優先度順で取得"""
    import psycopg2

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # 送信済みURLを除外
    submitted = load_submitted_urls()

    cur.execute("""
        SELECT t.id, t.review_count
        FROM therapists t
        JOIN salons s ON t.salon_id = s.id
        WHERE s.published_at IS NOT NULL
          AND t.status = 'active'
          AND (t.review_count IS NOT NULL AND t.review_count > 0)
        ORDER BY t.review_count DESC, t.id
    """)

    urls = []
    for row in cur:
        url = f"{BASE_URL}/therapist/{row[0]}"
        if url not in submitted:
            urls.append(url)
        if len(urls) >= limit:
            break

    cur.close()
    conn.close()

    # 口コミありが足りなければ、口コミなし公開済みセラピストも追加
    if len(urls) < limit:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        cur.execute("""
            SELECT t.id
            FROM therapists t
            JOIN salons s ON t.salon_id = s.id
            WHERE s.published_at IS NOT NULL
              AND t.status = 'active'
              AND (t.review_count IS NULL OR t.review_count = 0)
            ORDER BY t.id
        """)
        for row in cur:
            url = f"{BASE_URL}/therapist/{row[0]}"
            if url not in submitted:
                urls.append(url)
            if len(urls) >= limit:
                break
        cur.close()
        conn.close()

    return urls


def load_submitted_urls() -> set[str]:
    """送信済みURLを読み込み"""
    if not LOG_FILE.exists():
        return set()
    with open(LOG_FILE) as f:
        data = json.load(f)
    return set(data.get("submitted_urls", []))


def save_submitted_urls(urls: list[str]):
    """送信済みURLを保存（追記）"""
    existing = load_submitted_urls()
    existing.update(urls)
    with open(LOG_FILE, "w") as f:
        json.dump({
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "total_submitted": len(existing),
            "submitted_urls": sorted(existing),
        }, f, indent=2)


def submit_urls(urls: list[str], dry_run: bool = True):
    """Indexing APIにURL送信"""
    credentials = service_account.Credentials.from_service_account_file(
        KEY_FILE, scopes=SCOPES
    )
    from google.auth.transport.requests import AuthorizedSession
    session = AuthorizedSession(credentials)

    success = []
    errors = []

    for i, url in enumerate(urls):
        body = json.dumps({
            "url": url,
            "type": "URL_UPDATED",
        })

        if dry_run:
            print(f"  [DRY RUN] {i+1}/{len(urls)}: {url}")
            success.append(url)
            continue

        try:
            resp = session.post(
                "https://indexing.googleapis.com/v3/urlNotifications:publish",
                json={"url": url, "type": "URL_UPDATED"},
            )

            if resp.status_code == 200:
                print(f"  [OK] {i+1}/{len(urls)}: {url}")
                success.append(url)
            else:
                error_msg = resp.json().get("error", {}).get("message", "unknown")
                print(f"  [ERROR] {i+1}/{len(urls)}: {url} -> {resp.status_code}: {error_msg}")
                errors.append({"url": url, "status": resp.status_code, "error": error_msg})

                if resp.status_code == 429:
                    print("\n  Rate limit reached. Stopping.")
                    break

        except Exception as e:
            print(f"  [EXCEPTION] {i+1}/{len(urls)}: {url} -> {e}")
            errors.append({"url": url, "error": str(e)})

    return success, errors


def main():
    parser = argparse.ArgumentParser(description="Google Indexing API バッチ送信")
    parser.add_argument("--submit", action="store_true", help="実際に送信する（省略時はドライラン）")
    parser.add_argument("--limit", type=int, default=DAILY_LIMIT, help=f"送信URL数（デフォルト: {DAILY_LIMIT}）")
    args = parser.parse_args()

    dry_run = not args.submit
    limit = min(args.limit, DAILY_LIMIT)

    print(f"=== Google Indexing API {'ドライラン' if dry_run else '送信'} ===")
    print(f"制限: {limit} URLs")
    print()

    # URL取得
    print("優先度付きURL取得中...")
    urls = get_priority_urls(limit)
    print(f"  対象: {len(urls)} URLs")

    if not urls:
        print("  送信対象なし（全て送信済み）")
        return

    # 送信
    print()
    print("送信開始...")
    success, errors = submit_urls(urls, dry_run=dry_run)

    # 結果
    print()
    print(f"=== 結果 ===")
    print(f"  成功: {len(success)}")
    print(f"  エラー: {len(errors)}")

    if errors:
        print(f"\n  エラー詳細:")
        for e in errors:
            print(f"    {e['url']}: {e.get('error', 'unknown')}")

    # 送信済み記録
    if not dry_run and success:
        save_submitted_urls(success)
        print(f"\n  送信済みURL記録を更新（累計: {len(load_submitted_urls())}件）")


if __name__ == "__main__":
    main()
