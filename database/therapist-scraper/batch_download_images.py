#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
セラピスト画像 DL → Supabase Storage 保存 → DB URL差し替え

therapists.image_urls の外部URLから画像をダウンロードし、
Supabase Storage の therapist-images バケットにアップロード。
DBのimage_urlsをStorage公開URLに書き換える。

Usage:
  # テスト（5件、DB書き込みなし）
  python batch_download_images.py --limit 5 --dry-run

  # 本番（全件、10並列）
  python batch_download_images.py --workers 10

  # VPS並列（ID範囲分割）
  python batch_download_images.py --start-id 0 --end-id 20000 --workers 10

  # チェックポイントから再開
  python batch_download_images.py --resume

前提:
  - database/.env に SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  - therapist-images バケットが作成済み（migration 20260221000001）
  - therapists.image_urls に外部URLが格納済み
"""

import json
import logging
import os
import signal
import sys
import time
import argparse
import mimetypes
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv

# .env読み込み
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# --- 設定 ---
DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
SUPABASE_URL = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET = "therapist-images"
DL_TIMEOUT = 15
DL_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# ログ設定
SCRIPT_DIR = os.path.dirname(__file__)
LOG_FILE = os.path.join(SCRIPT_DIR, 'batch_download_images.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger(__name__)

# graceful shutdown
_shutdown = False


def _handle_sigint(signum, frame):
    global _shutdown
    _shutdown = True
    log.info("\nSIGINT受信 — 現バッチ完了後に終了します...")


signal.signal(signal.SIGINT, _handle_sigint)


# =============================================================================
# チェックポイント
# =============================================================================

def _checkpoint_path(start_id=None, end_id=None):
    suffix = f"_{start_id}_{end_id}" if start_id is not None else ""
    return os.path.join(SCRIPT_DIR, f"batch_dl_images_checkpoint{suffix}.json")


def _default_checkpoint():
    return {
        'done_ids': [],
        'stats': {
            'processed': 0,
            'uploaded': 0,
            'dl_failed': 0,
            'upload_failed': 0,
            'skipped_no_images': 0,
            'total_images': 0,
            'total_bytes': 0,
            'started_at': None,
        }
    }


def load_checkpoint(path):
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return _default_checkpoint()


def save_checkpoint(checkpoint, path):
    checkpoint['stats']['last_updated'] = datetime.now().isoformat()
    with open(path, 'w') as f:
        json.dump(checkpoint, f, ensure_ascii=False, indent=2)


# =============================================================================
# 画像DL + Storage upload
# =============================================================================

def _guess_ext(url: str, content_type: str = "") -> str:
    """URLとContent-Typeから拡張子を推定"""
    # Content-Typeから
    if content_type:
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if ext and ext in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
            return ext.lstrip('.')
    # URLから
    path = urlparse(url).path.lower()
    for ext in ('jpg', 'jpeg', 'png', 'webp', 'gif'):
        if path.endswith(f'.{ext}'):
            return ext
    return 'jpg'  # デフォルト


def _content_type_for_ext(ext: str) -> str:
    """拡張子からContent-Typeを返す"""
    mapping = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif',
    }
    return mapping.get(ext, 'image/jpeg')


def download_image(url: str) -> tuple[bytes | None, str]:
    """
    画像をダウンロード。

    Returns:
        (bytes | None, content_type)
    """
    try:
        resp = requests.get(url, headers=DL_HEADERS, timeout=DL_TIMEOUT,
                           allow_redirects=True, stream=True)
        resp.raise_for_status()

        # サイズ制限 5MB
        content_length = resp.headers.get('Content-Length')
        if content_length and int(content_length) > 5 * 1024 * 1024:
            return None, ""

        data = resp.content
        if len(data) < 100:  # 極小ファイル = おそらくプレースホルダー
            return None, ""
        if len(data) > 5 * 1024 * 1024:
            return None, ""

        ct = resp.headers.get('Content-Type', '')
        return data, ct
    except Exception:
        return None, ""


def upload_to_storage(image_data: bytes, storage_path: str, content_type: str) -> bool:
    """Supabase Storage REST APIで直接アップロード"""
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{storage_path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    try:
        resp = requests.post(upload_url, headers=headers, data=image_data, timeout=30)
        if resp.status_code in (200, 201):
            return True
        log.debug(f"  upload failed: {resp.status_code} {resp.text[:100]}")
        return False
    except Exception as e:
        log.debug(f"  upload error: {e}")
        return False


def get_public_url(storage_path: str) -> str:
    """Storage公開URLを生成"""
    return f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{storage_path}"


def process_one_therapist(therapist_id: int, salon_id: int,
                          image_urls: list[str]) -> tuple[list[str], dict]:
    """
    1セラピスト分の画像を処理。

    Returns:
        (new_urls, stats_dict)
        new_urls: Storage公開URL一覧（失敗分は元URLを維持）
        stats_dict: {'uploaded': N, 'dl_failed': N, 'upload_failed': N, 'bytes': N}
    """
    new_urls = []
    stats = {'uploaded': 0, 'dl_failed': 0, 'upload_failed': 0, 'bytes': 0}

    for idx, url in enumerate(image_urls[:5]):
        if _shutdown:
            # シャットダウン時は元URLをそのまま残す
            new_urls.append(url)
            continue

        # ダウンロード
        data, ct = download_image(url)
        if data is None:
            stats['dl_failed'] += 1
            new_urls.append(url)  # 元URL維持
            continue

        # Storage パス決定
        ext = _guess_ext(url, ct)
        storage_path = f"{salon_id}/{therapist_id}/{idx + 1:03d}.{ext}"
        content_type = _content_type_for_ext(ext)

        # アップロード
        ok = upload_to_storage(data, storage_path, content_type)
        if ok:
            stats['uploaded'] += 1
            stats['bytes'] += len(data)
            new_urls.append(get_public_url(storage_path))
        else:
            stats['upload_failed'] += 1
            new_urls.append(url)  # 元URL維持

    return new_urls, stats


# =============================================================================
# メイン処理
# =============================================================================

def run(args):
    cp_path = _checkpoint_path(args.start_id, args.end_id)
    checkpoint = load_checkpoint(cp_path) if args.resume else _default_checkpoint()
    done_ids = set(checkpoint['done_ids'])
    stats = checkpoint['stats']

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # 対象取得: image_urlsが空でないactiveセラピスト
    where_parts = [
        "status = 'active'",
        "image_urls IS NOT NULL",
        "image_urls != '[]'::jsonb",
        "image_urls != 'null'::jsonb",
    ]
    params = {}
    if args.start_id is not None:
        where_parts.append("id >= %(start_id)s")
        params['start_id'] = args.start_id
    if args.end_id is not None:
        where_parts.append("id < %(end_id)s")
        params['end_id'] = args.end_id

    where_sql = " AND ".join(where_parts)
    cur.execute(f"""
        SELECT id, salon_id, image_urls
        FROM therapists
        WHERE {where_sql}
        ORDER BY id
    """, params)
    rows = cur.fetchall()

    if args.limit:
        rows = rows[:args.limit]

    # 処理済みスキップ
    rows = [r for r in rows if r['id'] not in done_ids]

    # 既にStorage URLになっている行をスキップ
    filtered = []
    for r in rows:
        imgs = r['image_urls']
        if isinstance(imgs, str):
            imgs = json.loads(imgs)
        if not imgs:
            continue
        # 全URLが既にStorage URLなら完了済み
        if all(STORAGE_BUCKET in str(u) for u in imgs):
            done_ids.add(r['id'])
            continue
        filtered.append(r)
    rows = filtered

    total = len(rows)
    log.info(f"対象: {total} 件 (start_id={args.start_id}, end_id={args.end_id})")
    if done_ids:
        log.info(f"  処理済みスキップ: {len(done_ids)} 件")

    if not total:
        log.info("処理対象が0件のため終了")
        conn.close()
        return

    if not stats.get('started_at'):
        stats['started_at'] = datetime.now().isoformat()

    start_time = time.time()
    batch_count = 0

    # 並列処理
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        # バッチ単位で投入
        batch_start = 0
        while batch_start < total and not _shutdown:
            batch_end = min(batch_start + args.batch_size, total)
            batch_rows = rows[batch_start:batch_end]

            futures = {}
            for row in batch_rows:
                if _shutdown:
                    break
                t_id = row['id']
                salon_id = row['salon_id']
                imgs = row['image_urls']
                if isinstance(imgs, str):
                    imgs = json.loads(imgs)
                if not imgs:
                    done_ids.add(t_id)
                    stats['skipped_no_images'] = stats.get('skipped_no_images', 0) + 1
                    continue

                future = executor.submit(process_one_therapist, t_id, salon_id, imgs)
                futures[future] = (t_id, imgs)

            for future in as_completed(futures):
                if _shutdown:
                    break
                t_id, orig_imgs = futures[future]
                try:
                    new_urls, one_stats = future.result()
                except Exception as e:
                    log.warning(f"  処理エラー id={t_id}: {e}")
                    done_ids.add(t_id)
                    continue

                stats['uploaded'] = stats.get('uploaded', 0) + one_stats['uploaded']
                stats['dl_failed'] = stats.get('dl_failed', 0) + one_stats['dl_failed']
                stats['upload_failed'] = stats.get('upload_failed', 0) + one_stats['upload_failed']
                stats['total_bytes'] = stats.get('total_bytes', 0) + one_stats['bytes']
                stats['total_images'] = stats.get('total_images', 0) + len(orig_imgs)

                # DB UPDATE
                if not args.dry_run and new_urls:
                    try:
                        cur.execute("SAVEPOINT sp_img")
                        cur.execute(
                            "UPDATE therapists SET image_urls = %s::jsonb WHERE id = %s",
                            (json.dumps(new_urls, ensure_ascii=False), t_id)
                        )
                        cur.execute("RELEASE SAVEPOINT sp_img")
                    except Exception as e:
                        cur.execute("ROLLBACK TO SAVEPOINT sp_img")
                        log.warning(f"  DB UPDATE error id={t_id}: {e}")

                done_ids.add(t_id)
                stats['processed'] = stats.get('processed', 0) + 1
                batch_count += 1

            # バッチ完了 → コミット + チェックポイント
            if not args.dry_run:
                conn.commit()
            checkpoint['done_ids'] = list(done_ids)
            checkpoint['stats'] = stats
            save_checkpoint(checkpoint, cp_path)

            # 進捗表示
            processed = stats.get('processed', 0)
            elapsed = timedelta(seconds=int(time.time() - start_time))
            rate = processed / (time.time() - start_time) if time.time() > start_time else 0
            eta = timedelta(seconds=int((total - processed) / rate)) if rate > 0 else "?"
            mb = stats.get('total_bytes', 0) / 1024 / 1024
            log.info(
                f"[{processed}/{total}] "
                f"uploaded={stats.get('uploaded', 0)} "
                f"dl_fail={stats.get('dl_failed', 0)} "
                f"upload_fail={stats.get('upload_failed', 0)} "
                f"{mb:.1f}MB "
                f"[{elapsed} / ETA {eta}]"
            )

            batch_start = batch_end

    # 最終コミット
    if not args.dry_run:
        conn.commit()
    checkpoint['done_ids'] = list(done_ids)
    checkpoint['stats'] = stats
    save_checkpoint(checkpoint, cp_path)

    # サマリー
    elapsed = timedelta(seconds=int(time.time() - start_time))
    mb = stats.get('total_bytes', 0) / 1024 / 1024
    gb = mb / 1024
    log.info(f"\n{'=' * 60}")
    log.info(f" 画像DL+Storage保存 完了 ({elapsed})")
    log.info(f"{'=' * 60}")
    log.info(f"  処理セラピスト: {stats.get('processed', 0)} 件")
    log.info(f"  画像アップロード: {stats.get('uploaded', 0)} 枚")
    log.info(f"  DL失敗:          {stats.get('dl_failed', 0)} 枚")
    log.info(f"  Upload失敗:      {stats.get('upload_failed', 0)} 枚")
    log.info(f"  合計サイズ:      {mb:.1f}MB ({gb:.2f}GB)")
    log.info(f"  スキップ:        {stats.get('skipped_no_images', 0)} 件")

    conn.close()


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='セラピスト画像 DL → Supabase Storage 保存')

    parser.add_argument('--start-id', type=int, default=None,
                        help='開始ID（VPS並列用）')
    parser.add_argument('--end-id', type=int, default=None,
                        help='終了ID（VPS並列用）')
    parser.add_argument('--resume', action='store_true',
                        help='チェックポイントから再開')
    parser.add_argument('--workers', type=int, default=10,
                        help='並列ダウンロードワーカー数（default: 10）')
    parser.add_argument('--limit', type=int, default=0,
                        help='処理件数制限（テスト用）')
    parser.add_argument('--dry-run', action='store_true',
                        help='DB書き込みスキップ')
    parser.add_argument('--batch-size', type=int, default=200,
                        help='コミット+チェックポイント間隔（default: 200）')

    args = parser.parse_args()

    if not SUPABASE_SERVICE_KEY:
        log.error("SUPABASE_SERVICE_ROLE_KEY が未設定です（database/.env を確認）")
        sys.exit(1)

    log.info("=" * 60)
    log.info(" セラピスト画像 DL → Supabase Storage")
    log.info(f" workers={args.workers} batch_size={args.batch_size}"
             f" dry_run={args.dry_run} resume={args.resume}")
    if args.start_id is not None or args.end_id is not None:
        log.info(f" ID範囲: [{args.start_id} .. {args.end_id})")
    log.info("=" * 60)

    run(args)


if __name__ == '__main__':
    main()
