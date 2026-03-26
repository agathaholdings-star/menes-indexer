"""
サロン画像をesthe-ranking.jpからダウンロードしてSupabase Storageに転送するスクリプト。
セラピスト画像と同様のパターン。

Usage:
  python database/transfer_salon_images.py
"""

import os
import sys
import requests
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from supabase import create_client

# database/.env から環境変数を読み込み
load_dotenv(Path(__file__).parent / ".env")

# 本番Supabase
PROD_URL = os.environ["SUPABASE_PROD_URL"]
PROD_SERVICE_KEY = os.environ["SUPABASE_PROD_SERVICE_ROLE_KEY"]
BUCKET = "salon-images"

supabase = create_client(PROD_URL, PROD_SERVICE_KEY)


def ensure_bucket():
    """salon-imagesバケットが存在しなければ作成"""
    try:
        supabase.storage.get_bucket(BUCKET)
        print(f"✓ Bucket '{BUCKET}' exists")
    except Exception:
        supabase.storage.create_bucket(BUCKET, options={"public": True})
        print(f"✓ Bucket '{BUCKET}' created")


def get_salons_with_images():
    """image_urlを持つサロン一覧を取得（ページネーション対応）"""
    all_data = []
    offset = 0
    page_size = 1000
    while True:
        result = supabase.table("salons").select("id, image_url").not_.is_("image_url", "null").range(offset, offset + page_size - 1).execute()
        all_data.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size
    return all_data


def transfer_image(salon):
    """1件のサロン画像を転送"""
    salon_id = salon["id"]
    image_url = salon["image_url"]

    # すでにStorage URLならスキップ
    if "supabase.co/storage" in image_url:
        return {"id": salon_id, "status": "skipped", "reason": "already_storage"}

    try:
        # ダウンロード
        resp = requests.get(image_url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (compatible; SKR-Bot/1.0)"
        })
        if resp.status_code != 200:
            return {"id": salon_id, "status": "failed", "reason": f"http_{resp.status_code}"}

        # 拡張子判定
        content_type = resp.headers.get("content-type", "image/jpeg")
        if "png" in content_type:
            ext = "png"
        elif "webp" in content_type:
            ext = "webp"
        else:
            ext = "jpg"

        # Storageにアップロード
        storage_path = f"{salon_id}/main.{ext}"
        supabase.storage.from_(BUCKET).upload(
            storage_path,
            resp.content,
            file_options={"content-type": content_type, "upsert": "true"}
        )

        # DB更新
        new_url = f"{PROD_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"
        supabase.table("salons").update({"image_url": new_url}).eq("id", salon_id).execute()

        return {"id": salon_id, "status": "ok", "url": new_url}

    except Exception as e:
        return {"id": salon_id, "status": "error", "reason": str(e)[:100]}


def main():
    ensure_bucket()

    salons = get_salons_with_images()
    print(f"\n対象サロン: {len(salons)}件")

    ok = 0
    failed = 0
    skipped = 0

    # 逐次処理（レート制限回避、0.3秒間隔）
    for i, salon in enumerate(salons, 1):
        result = transfer_image(salon)
        if result["status"] == "ok":
            ok += 1
        elif result["status"] == "skipped":
            skipped += 1
        else:
            failed += 1
            if failed <= 20:
                print(f"  ✗ salon {result['id']}: {result.get('reason', 'unknown')}")

        if i % 100 == 0:
            print(f"  進捗: {i}/{len(salons)} (ok={ok}, failed={failed}, skipped={skipped})")
            sys.stdout.flush()

        if result["status"] != "skipped":
            time.sleep(0.3)

    print(f"\n完了: ok={ok}, failed={failed}, skipped={skipped}")


if __name__ == "__main__":
    main()
