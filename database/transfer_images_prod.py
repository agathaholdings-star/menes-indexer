"""
本番DBのlocalhost画像URL → 本番Supabase Storageに転送するスクリプト
対象: 本番therapistsテーブルの image_urls に 127.0.0.1 を含むレコード（約895名）
"""

import json
import re
import requests
import psycopg2
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import sys

# ローカルStorage
LOCAL_STORAGE_BASE = "http://127.0.0.1:54321/storage/v1/object/public"

# 本番Supabase
PROD_SUPABASE_URL = "https://oycayfewhqrezvhbbhzm.supabase.co"
PROD_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95Y2F5ZmV3aHFyZXp2aGJiaHptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU4NDM0NCwiZXhwIjoyMDg4MTYwMzQ0fQ.EAgclandEij8KmNXSh-VeR7dOCCMG6wOCQOP3rQ3ytw"

PROD_DB = "postgresql://postgres.oycayfewhqrezvhbbhzm:PgQA4SRZSLeAxtEq@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

BUCKET = "therapist-images"
PROD_STORAGE_BASE = f"{PROD_SUPABASE_URL}/storage/v1/object/public/{BUCKET}"

session = requests.Session()

def get_therapists_with_localhost_images():
    """本番DBからlocalhost URLを持つセラピスト一覧を取得"""
    conn = psycopg2.connect(PROD_DB)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, image_urls::text
        FROM therapists
        WHERE image_urls::text LIKE '%127.0.0.1%'
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def extract_storage_path(url: str) -> str | None:
    """localhost URLからStorage内パスを抽出"""
    # http://127.0.0.1:54321/storage/v1/object/public/therapist-images/78/105667/001.webp
    match = re.search(r'/therapist-images/(.+)$', url)
    return match.group(1) if match else None


def download_from_local(storage_path: str) -> bytes | None:
    """ローカルStorageから画像をダウンロード"""
    url = f"{LOCAL_STORAGE_BASE}/{BUCKET}/{storage_path}"
    try:
        resp = session.get(url, timeout=10)
        if resp.status_code == 200:
            return resp.content
        return None
    except Exception:
        return None


def upload_to_prod(storage_path: str, data: bytes) -> bool:
    """本番Supabase Storageにアップロード"""
    url = f"{PROD_SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}"
    headers = {
        "Authorization": f"Bearer {PROD_SERVICE_KEY}",
        "Content-Type": "image/webp",
        "x-upsert": "true",
    }
    try:
        resp = session.post(url, data=data, headers=headers, timeout=30)
        return resp.status_code in (200, 201)
    except Exception:
        return False


def process_therapist(therapist_id: int, image_urls_json: str) -> tuple[int, list[str] | None]:
    """1セラピスト分の画像を転送してURLリストを返す"""
    image_urls = json.loads(image_urls_json)
    new_urls = []

    for url in image_urls:
        storage_path = extract_storage_path(url)
        if not storage_path:
            new_urls.append(url)  # パス抽出失敗はそのまま
            continue

        # ダウンロード
        data = download_from_local(storage_path)
        if not data:
            new_urls.append(url)  # DL失敗はそのまま
            continue

        # アップロード
        if upload_to_prod(storage_path, data):
            new_urls.append(f"{PROD_STORAGE_BASE}/{storage_path}")
        else:
            new_urls.append(url)  # アップ失敗はそのまま

    # 全URL変換成功した場合のみ更新対象
    if all(PROD_STORAGE_BASE in u for u in new_urls):
        return (therapist_id, new_urls)
    else:
        return (therapist_id, None)


def update_prod_urls(updates: list[tuple[int, list[str]]]):
    """本番DBのimage_urlsを一括更新"""
    conn = psycopg2.connect(PROD_DB)
    cur = conn.cursor()
    for tid, urls in updates:
        cur.execute(
            "UPDATE therapists SET image_urls = %s WHERE id = %s",
            (json.dumps(urls), tid)
        )
    conn.commit()
    cur.close()
    conn.close()


def main():
    print("=== セラピスト画像転送スクリプト ===")
    print(f"ローカル: {LOCAL_STORAGE_BASE}")
    print(f"本番: {PROD_SUPABASE_URL}")
    print()

    # 1. 対象セラピスト取得
    print("対象セラピスト取得中...")
    rows = get_therapists_with_localhost_images()
    total = len(rows)
    print(f"対象: {total}名")

    if total == 0:
        print("転送対象なし")
        return

    # 2. 並列転送
    success = 0
    failed = 0
    updates = []

    start = time.time()
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(process_therapist, tid, urls): tid
            for tid, urls in rows
        }

        for i, future in enumerate(as_completed(futures), 1):
            tid, new_urls = future.result()
            if new_urls:
                updates.append((tid, new_urls))
                success += 1
            else:
                failed += 1

            if i % 50 == 0 or i == total:
                elapsed = time.time() - start
                rate = i / elapsed if elapsed > 0 else 0
                print(f"  [{i}/{total}] 成功:{success} 失敗:{failed} ({rate:.1f}/sec)")

    # 3. DB更新
    if updates:
        print(f"\n本番DB更新中... ({len(updates)}件)")
        update_prod_urls(updates)
        print("完了!")

    elapsed = time.time() - start
    print(f"\n=== 結果 ===")
    print(f"成功: {success}/{total}")
    print(f"失敗: {failed}/{total}")
    print(f"所要時間: {elapsed:.1f}秒")


if __name__ == "__main__":
    main()
