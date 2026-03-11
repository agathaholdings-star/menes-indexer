"""
全セラピスト画像をローカルStorage → 本番Supabase Storageに転送
対象: ローカルStorageの全画像（約409K files, 10GB）
"""

import requests
import psycopg2
import time
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

# ローカル
LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
LOCAL_STORAGE = "http://127.0.0.1:54321/storage/v1"

# 本番
PROD_SUPABASE_URL = "https://oycayfewhqrezvhbbhzm.supabase.co"
PROD_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95Y2F5ZmV3aHFyZXp2aGJiaHptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU4NDM0NCwiZXhwIjoyMDg4MTYwMzQ0fQ.EAgclandEij8KmNXSh-VeR7dOCCMG6wOCQOP3rQ3ytw"

BUCKET = "therapist-images"
BATCH_SIZE = 500

session = requests.Session()
prod_headers = {
    "Authorization": f"Bearer {PROD_SERVICE_KEY}",
    "Content-Type": "image/webp",
    "x-upsert": "true",
}


def get_all_storage_objects():
    """ローカルDBからStorage内の全オブジェクトパスを取得"""
    conn = psycopg2.connect(LOCAL_DB)
    cur = conn.cursor()
    cur.execute("""
        SELECT name FROM storage.objects
        WHERE bucket_id = 'therapist-images'
        ORDER BY name
    """)
    rows = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def check_prod_existing():
    """本番に既にアップロード済みのファイル一覧を取得（スキップ用）"""
    # 本番DBに直接クエリ
    PROD_DB = "postgresql://postgres.oycayfewhqrezvhbbhzm:PgQA4SRZSLeAxtEq@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
    try:
        conn = psycopg2.connect(PROD_DB)
        cur = conn.cursor()
        cur.execute("""
            SELECT name FROM storage.objects
            WHERE bucket_id = 'therapist-images'
        """)
        existing = set(r[0] for r in cur.fetchall())
        cur.close()
        conn.close()
        return existing
    except Exception as e:
        print(f"本番既存チェックスキップ: {e}")
        return set()


def transfer_file(path: str) -> bool:
    """1ファイルを転送"""
    # ダウンロード
    local_url = f"{LOCAL_STORAGE}/object/public/{BUCKET}/{path}"
    try:
        resp = session.get(local_url, timeout=10)
        if resp.status_code != 200:
            return False
    except Exception:
        return False

    # アップロード
    prod_url = f"{PROD_SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
    try:
        resp = session.post(prod_url, data=resp.content, headers=prod_headers, timeout=30)
        return resp.status_code in (200, 201)
    except Exception:
        return False


def main():
    print("=== 全画像転送スクリプト ===")
    print(f"ローカル: {LOCAL_STORAGE}")
    print(f"本番: {PROD_SUPABASE_URL}")
    print()

    # 1. 全ファイルパス取得
    print("ローカルStorage全ファイル取得中...")
    all_paths = get_all_storage_objects()
    total_all = len(all_paths)
    print(f"ローカル全ファイル: {total_all}")

    # 2. 本番既存チェック（スキップ用）
    print("本番既存ファイルチェック中...")
    existing = check_prod_existing()
    print(f"本番既存: {len(existing)}件（スキップ）")

    # 3. 未転送分をフィルタ
    paths = [p for p in all_paths if p not in existing]
    total = len(paths)
    print(f"転送対象: {total}件")
    print()

    if total == 0:
        print("全ファイル転送済み！")
        return

    # 4. 並列転送
    success = 0
    failed = 0
    failed_paths = []
    start = time.time()

    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(transfer_file, p): p for p in paths}

        for i, future in enumerate(as_completed(futures), 1):
            path = futures[future]
            try:
                if future.result():
                    success += 1
                else:
                    failed += 1
                    failed_paths.append(path)
            except Exception:
                failed += 1
                failed_paths.append(path)

            if i % 500 == 0 or i == total:
                elapsed = time.time() - start
                rate = i / elapsed if elapsed > 0 else 0
                eta = (total - i) / rate if rate > 0 else 0
                print(f"  [{i:,}/{total:,}] 成功:{success:,} 失敗:{failed} ({rate:.0f}/sec) ETA:{eta/60:.0f}分")

    elapsed = time.time() - start

    print(f"\n=== 結果 ===")
    print(f"成功: {success:,}/{total:,}")
    print(f"失敗: {failed}")
    print(f"所要時間: {elapsed/60:.1f}分")

    if failed_paths:
        with open("/tmp/failed_image_transfers.txt", "w") as f:
            f.write("\n".join(failed_paths))
        print(f"失敗リスト: /tmp/failed_image_transfers.txt")


if __name__ == "__main__":
    main()
