#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
セラピスト情報 Haiku 一括抽出バッチ（統一パイプライン）

全サロンを3段階Haikuフローで処理:
  Stage 1: TOPページ分析 → page_type判定
  Stage 2: 一覧ページ分析 → 個別URL抽出
  Stage 3: 個別ページ → Haiku全フィールド抽出 → INSERT
  + 3Days CMS直接抽出 / single_page一括抽出 / Playwright fallback

全フローで source_url dedup 保証（INSERT前に既存チェック）。

Usage:
  # テスト（5件、DB書き込みなし）
  python batch_extract_therapist_info.py --limit 5 --dry-run

  # 本番（全サロン）
  python batch_extract_therapist_info.py          # 引数なし
  python batch_extract_therapist_info.py --full   # 明示的

  # VPS並列（ID範囲分割）
  python batch_extract_therapist_info.py --start-id 0 --end-id 3000
  python batch_extract_therapist_info.py --start-id 3000 --end-id 6489

  # チェックポイントから再開
  python batch_extract_therapist_info.py --resume

前提:
  - supabase start 済み (127.0.0.1:54322) or DATABASE_URL 環境変数
  - database/.env に ANTHROPIC_API_KEY
"""

import json
import logging
import os
import signal
import sys
import time
import argparse
from datetime import datetime, timedelta
from hashlib import md5
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# .env読み込み
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# ローカルモジュール
sys.path.insert(0, os.path.dirname(__file__))
from fetch_utils import fetch_page
from html_cache_utils import HtmlCache
from name_extractor import extract_therapist_info

_cache = HtmlCache()

# --- 設定 ---
DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
REQUEST_DELAY = 1.0

# ログ設定
SCRIPT_DIR = os.path.dirname(__file__)
LOG_FILE = os.path.join(SCRIPT_DIR, 'batch_extract_therapist_info.log')
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

def _checkpoint_path(mode, start_id=None, end_id=None):
    suffix = f"_{start_id}_{end_id}" if start_id is not None else ""
    return os.path.join(SCRIPT_DIR, f"batch_extract_{mode}_checkpoint{suffix}.json")


def _default_checkpoint():
    return {
        'done_ids': [],
        'stats': {
            'processed': 0,
            'updated': 0,
            'inserted': 0,
            'fetch_failed': 0,
            'extract_failed': 0,
            'skipped_no_name': 0,
            'db_error': 0,
            'total_input_tokens': 0,
            'total_output_tokens': 0,
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
# メイン処理
# =============================================================================

def _safe_int(val, min_val=None, max_val=None):
    """整数変換。範囲外はNone。"""
    if val is None:
        return None
    try:
        v = int(val)
        if min_val is not None and v < min_val:
            return None
        if max_val is not None and v > max_val:
            return None
        return v
    except (ValueError, TypeError):
        return None


def _normalize_source_url(url: str) -> str:
    """source_urlを正規化（dedup用）。#除去 + URLデコード + https統一"""
    from urllib.parse import unquote, urlparse, urlunparse
    if not url:
        return url
    # #アンカー除去
    url = url.split('#')[0]
    # URLデコード（%E5%9C%A8 → 在籍）
    url = unquote(url)
    # http → https に統一
    if url.startswith('http://'):
        url = 'https://' + url[7:]
    # 末尾スラッシュ統一
    return url.rstrip('/')


def insert_therapist_new(cur, salon_id, data):
    """新規セラピストをINSERT。SAVEPOINT付き。Returns id or None.

    重複判定:
    - salon_id + source_url + name の3点一致 → スキップ（真の重複）
    - 同じsource_urlでも名前が違えばINSERT許可（single_page対応）
    - source_urlなし → salon_id + name → スキップ
    """
    t_name = data.get('name')
    if not t_name:
        return None

    source_url = data.get('source_url')

    if source_url:
        # 保存前にsource_urlを正規化
        source_url = _normalize_source_url(source_url)
        data['source_url'] = source_url

        # 重複チェック: source_url + name の両方が一致 → 真の重複
        # single_pageでは全員同じsource_urlになるため、URLだけでは判定できない
        cur.execute(
            "SELECT id FROM therapists WHERE salon_id = %s AND source_url = %s AND name = %s LIMIT 1",
            (salon_id, source_url, t_name))
        if cur.fetchone():
            return None
    else:
        # source_urlなし → salon_id + name フォールバック
        cur.execute(
            "SELECT id FROM therapists WHERE salon_id = %s AND name = %s LIMIT 1",
            (salon_id, t_name))
        if cur.fetchone():
            return None

    bust_val = data.get('bust')
    if bust_val is not None:
        bust_val = str(bust_val)

    image_urls = data.get('image_urls') or []
    if isinstance(image_urls, str):
        try:
            image_urls = json.loads(image_urls)
        except json.JSONDecodeError:
            image_urls = [image_urls]

    try:
        cur.execute("SAVEPOINT sp_insert")
        cur.execute("""
            INSERT INTO therapists (
                salon_id, name, age, height,
                bust, waist, hip, cup,
                image_urls, profile_text, source_url,
                status, last_scraped_at
            ) VALUES (
                %(salon_id)s, %(name)s, %(age)s, %(height)s,
                %(bust)s, %(waist)s, %(hip)s, %(cup)s,
                %(image_urls)s::jsonb, %(profile_text)s, %(source_url)s,
                'active', now()
            )
            ON CONFLICT (salon_id, slug) DO NOTHING
            RETURNING id
        """, {
            'salon_id': salon_id,
            'name': t_name,
            'age': _safe_int(data.get('age'), min_val=18, max_val=70),
            'height': _safe_int(data.get('height'), min_val=130, max_val=200),
            'bust': bust_val,
            'waist': _safe_int(data.get('waist')),
            'hip': _safe_int(data.get('hip')),
            'cup': data.get('cup'),
            'image_urls': json.dumps(image_urls, ensure_ascii=False),
            'profile_text': data.get('profile_text'),
            'source_url': data.get('source_url'),
        })
        row = cur.fetchone()
        if row:
            t_id = row['id']
            cur.execute("UPDATE therapists SET slug = %s WHERE id = %s",
                        (str(t_id), t_id))
            cur.execute("RELEASE SAVEPOINT sp_insert")
            return t_id
        cur.execute("RELEASE SAVEPOINT sp_insert")
        return None
    except Exception as e:
        cur.execute("ROLLBACK TO SAVEPOINT sp_insert")
        log.warning(f"  DB INSERT error: {t_name}: {e}")
        return None


def _get_existing_source_urls(cur, salon_id):
    """サロン内の既存source_urlセットを取得"""
    cur.execute(
        "SELECT source_url FROM therapists WHERE salon_id = %s AND source_url IS NOT NULL",
        (salon_id,))
    return {r['source_url'] for r in cur.fetchall()}


def _process_haiku_salon(cur, salon, args, stats, _shutdown_ref):
    """全サロン共通: 3段階Haikuフローで処理

    scrape_failed_salons.py のロジックを統合:
    Stage 1: TOPページ分析 → page_type判定
    Stage 2: listing URL → 個別URL抽出
    Stage 3: 個別ページ → Haiku情報抽出 → INSERT
    + 3Days CMS直接抽出 / single_page一括抽出
    """
    # scrape_failed_salons.py から遅延import（循環import回避）
    from scrape_failed_salons import (
        fetch_page_smart, detect_3days_cms, parse_3days_data_js,
        haiku_analyze_page, haiku_extract_single_page,
        is_valid_therapist_url, _reanchor_stage1_urls,
        expand_individual_urls, detect_platform, fetch_paginated_listing,
    )

    salon_id = salon['salon_id']
    url = salon['official_url']
    salon_name = salon['salon_name'] or ''
    salon_display = salon['salon_display'] or salon_name

    if not url:
        return 0

    # --- Stage 1: TOPページ分析 ---
    html = fetch_page_smart(url, label=f"Haiku S1: ")
    if not html:
        stats['fetch_failed'] = stats.get('fetch_failed', 0) + 1
        return 0

    _cache.save("salon_top", salon_id, html)

    # 既存source_urls（全パスで使う）
    existing_urls = _get_existing_source_urls(cur, salon_id)

    # --- 3Days CMS 直接抽出（$0）---
    data_js_url = detect_3days_cms(html)
    if data_js_url:
        log.info(f"  3Days CMS detected → {data_js_url}")
        js_text = fetch_page(data_js_url)
        if js_text:
            _cache.save("data_js", salon_id, js_text)
            therapists = parse_3days_data_js(js_text, url, salon_name=salon_display)
            count = 0
            for t_data in therapists:
                # 3Days CMS: 各セラピストに個別source_urlあり、insert_therapist_newのdedupに委譲
                if not args.dry_run:
                    t_id = insert_therapist_new(cur, salon_id, t_data)
                    if t_id:
                        count += 1
                else:
                    count += 1
            stats['inserted'] = stats.get('inserted', 0) + count
            return count

    # --- Haiku Stage 1 分析 ---
    result1 = haiku_analyze_page(html, salon_display, url)
    if not result1:
        stats['extract_failed'] = stats.get('extract_failed', 0) + 1
        return 0

    _reanchor_stage1_urls(result1, url)

    stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + result1.get('input_tokens', 0)
    stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + result1.get('output_tokens', 0)

    page_type = result1['page_type']
    log.info(f"  Stage 1: {page_type} — {result1.get('notes', '')}")

    # エイジゲート → リダイレクト先で再分析
    if page_type == 'age_gate' and result1.get('redirect_url'):
        redirect_url = result1['redirect_url']
        html = fetch_page(redirect_url)
        if html:
            _cache.save("salon_top", f"{salon_id}_redirected", html)
            result1 = haiku_analyze_page(html, salon_display, redirect_url)
            if result1:
                _reanchor_stage1_urls(result1, redirect_url)
                stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + result1.get('input_tokens', 0)
                stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + result1.get('output_tokens', 0)
                page_type = result1['page_type']

    individual_urls = []
    listing_html = None
    listing_url_for_fallback = None

    # single_page でも individual_urls があれば has_individuals に補正
    if page_type == 'single_page' and result1.get('individual_urls'):
        from urllib.parse import urlparse as _urlparse
        salon_domain = _urlparse(url).netloc.lower()
        ext_urls = result1['individual_urls']
        def _is_internal(u_netloc):
            return u_netloc == salon_domain or u_netloc.endswith('.' + salon_domain)
        all_external = all(not _is_internal(_urlparse(u).netloc.lower()) for u in ext_urls)
        if not all_external:
            page_type = 'has_individuals'

    if page_type == 'has_individuals':
        individual_urls = result1.get('individual_urls', [])

        # listing_url もあればマージ
        listing_url_extra = result1.get('listing_url')
        if listing_url_extra:
            list_html = fetch_page_smart(listing_url_extra, label="S2 LIST(補完): ")
            if list_html:
                _cache.save("salon_list", salon_id, list_html)
                listing_html = list_html
                listing_url_for_fallback = listing_url_extra
                # 3Days CMS チェック
                list_data_js_url = detect_3days_cms(list_html)
                if list_data_js_url:
                    js_text = fetch_page(list_data_js_url)
                    if js_text:
                        _cache.save("data_js", f"{salon_id}_list", js_text)
                        therapists = parse_3days_data_js(js_text, listing_url_extra, salon_name=salon_display)
                        count = 0
                        for t_data in therapists:
                            # 3Days CMS: insert_therapist_newのdedupに委譲
                            if not args.dry_run:
                                t_id = insert_therapist_new(cur, salon_id, t_data)
                                if t_id:
                                    count += 1
                            else:
                                count += 1
                        stats['inserted'] = stats.get('inserted', 0) + count
                        return count
                else:
                    result2 = haiku_analyze_page(list_html, salon_display, listing_url_extra)
                    if result2:
                        _reanchor_stage1_urls(result2, listing_url_extra)
                        stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + result2.get('input_tokens', 0)
                        stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + result2.get('output_tokens', 0)
                        existing_set = set(individual_urls)
                        for u in result2.get('individual_urls', []):
                            if u not in existing_set:
                                individual_urls.append(u)
                                existing_set.add(u)

    elif page_type == 'listing':
        listing_url = result1.get('listing_url')
        if listing_url:
            list_html = fetch_page_smart(listing_url, label="S2 LIST: ")
            if list_html:
                _cache.save("salon_list", salon_id, list_html)
                listing_html = list_html
                listing_url_for_fallback = listing_url
                # 3Days CMS チェック
                list_data_js_url = detect_3days_cms(list_html)
                if list_data_js_url:
                    js_text = fetch_page(list_data_js_url)
                    if js_text:
                        _cache.save("data_js", f"{salon_id}_list2", js_text)
                        therapists = parse_3days_data_js(js_text, listing_url, salon_name=salon_display)
                        count = 0
                        for t_data in therapists:
                            # 3Days CMS: insert_therapist_newのdedupに委譲
                            if not args.dry_run:
                                t_id = insert_therapist_new(cur, salon_id, t_data)
                                if t_id:
                                    count += 1
                            else:
                                count += 1
                        stats['inserted'] = stats.get('inserted', 0) + count
                        return count

                result2 = haiku_analyze_page(list_html, salon_display, listing_url)
                if result2:
                    _reanchor_stage1_urls(result2, listing_url)
                    stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + result2.get('input_tokens', 0)
                    stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + result2.get('output_tokens', 0)
                    individual_urls = result2.get('individual_urls', [])

                # 個別URLなし → single_page fallback
                if not individual_urls and list_html:
                    therapists = haiku_extract_single_page(list_html, salon_display, listing_url)
                    count = 0
                    for t_data in therapists:
                        t_data['source_url'] = listing_url
                        stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + t_data.pop('input_tokens', 0)
                        stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + t_data.pop('output_tokens', 0)
                        # single_page: insert_therapist_new()の3点dedup(url+name)に委譲
                        if not args.dry_run:
                            t_id = insert_therapist_new(cur, salon_id, t_data)
                            if t_id:
                                count += 1
                        else:
                            count += 1
                    stats['inserted'] = stats.get('inserted', 0) + count
                    return count

    elif page_type == 'single_page':
        # TOPページ自体から一括抽出
        therapists = haiku_extract_single_page(html, salon_display, url)
        count = 0
        for t_data in therapists:
            t_data['source_url'] = url
            stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + t_data.pop('input_tokens', 0)
            stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + t_data.pop('output_tokens', 0)
            # single_page: insert_therapist_new()の3点dedup(url+name)に委譲
            if not args.dry_run:
                t_id = insert_therapist_new(cur, salon_id, t_data)
                if t_id:
                    count += 1
            else:
                count += 1
        stats['inserted'] = stats.get('inserted', 0) + count
        return count

    elif page_type == 'no_therapists':
        return 0
    else:
        return 0

    # listing_html fallback: TOP page
    if listing_html is None:
        listing_html = html
        listing_url_for_fallback = url

    # --- URL補完: TOP+一覧の全HTMLから同パターンのURLを追加抽出 ---
    if individual_urls:
        html_sources = [h for h in [html, listing_html] if h]
        individual_urls = expand_individual_urls(html_sources, url, individual_urls,
                                                listing_url=listing_url_for_fallback)

    # --- ページネーション: 一覧ページにpage 2以降があれば全ページからURL収集 ---
    if individual_urls and listing_html and listing_url_for_fallback:
        individual_urls = fetch_paginated_listing(
            listing_html, listing_url_for_fallback,
            individual_urls, salon_name=salon_display
        )

    # --- プラットフォーム検知 + Wix外部URL除外 ---
    platform = detect_platform(url, html)
    if platform == 'wix' and individual_urls:
        salon_domain = urlparse(url).netloc.lower()
        internal_urls = [u for u in individual_urls
                         if urlparse(u).netloc.lower() == salon_domain
                         or urlparse(u).netloc.lower().endswith('.' + salon_domain)]
        if not internal_urls:
            log.info(f"  Wix: 外部URLのみ ({len(individual_urls)}件) → single_page fallbackへ")
            individual_urls = []
        else:
            removed = len(individual_urls) - len(internal_urls)
            if removed > 0:
                log.info(f"  Wix: 外部URL {removed}件除外 → {len(internal_urls)}件")
            individual_urls = internal_urls

    # --- individual_urls の dedup + Stage 3 ---
    if not individual_urls:
        # 個別URLなし → 一覧ページからsingle_page抽出を試みる
        if listing_html:
            therapists = haiku_extract_single_page(listing_html, salon_display, listing_url_for_fallback)
            count = 0
            for t_data in therapists:
                t_data['source_url'] = listing_url_for_fallback
                stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + t_data.pop('input_tokens', 0)
                stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + t_data.pop('output_tokens', 0)
                # single_page: insert_therapist_new()の3点dedup(url+name)に委譲
                if not args.dry_run:
                    t_id = insert_therapist_new(cur, salon_id, t_data)
                    if t_id:
                        count += 1
                else:
                    count += 1
            stats['inserted'] = stats.get('inserted', 0) + count
            return count
        return 0

    # URLバリデーション
    individual_urls = [u for u in individual_urls if is_valid_therapist_url(u)]

    # 外部ドメインURL除外（Haikuがranking-deli.jp等を返すケース対策）
    salon_domain = urlparse(url).netloc.lower()
    individual_urls = [u for u in individual_urls
                       if urlparse(u).netloc.lower() == salon_domain
                       or urlparse(u).netloc.lower().endswith('.' + salon_domain)]

    # ポータルサイトの非プロフィールURL除外（coupon/accessmap/system等）
    _NON_PROFILE_PATH_KEYWORDS = (
        '/coupon', '/accessmap', '/system', '/shopdata',
        '/reviewlist', '/bloglist', '/recruit', '/event',
    )
    individual_urls = [u for u in individual_urls
                       if not any(kw in urlparse(u).path.lower()
                                  for kw in _NON_PROFILE_PATH_KEYWORDS)]

    # source_url正規化（#除去 + URLデコード + https統一）
    individual_urls = list(dict.fromkeys(_normalize_source_url(u) for u in individual_urls))

    # source_url dedup
    if existing_urls:
        individual_urls = [u for u in individual_urls if u not in existing_urls]

    if not individual_urls:
        return 0

    # アンカーリンク検出 → single_page fallback
    anchor_urls = [u for u in individual_urls if '#' in u]
    if anchor_urls and len(anchor_urls) == len(individual_urls):
        base_url = individual_urls[0].split('#')[0]
        all_same_base = all(u.split('#')[0] == base_url for u in individual_urls)
        if all_same_base:
            anchor_html = fetch_page(base_url)
            if anchor_html:
                _cache.save("salon_list", f"{salon_id}_anchor", anchor_html)
                therapists = haiku_extract_single_page(anchor_html, salon_display, base_url)
                count = 0
                for t_data in therapists:
                    t_data['source_url'] = base_url
                    stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + t_data.pop('input_tokens', 0)
                    stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + t_data.pop('output_tokens', 0)
                    if not args.dry_run:
                        t_id = insert_therapist_new(cur, salon_id, t_data)
                        if t_id:
                            count += 1
                    else:
                        count += 1
                stats['inserted'] = stats.get('inserted', 0) + count
                return count

    # Stage 3: 個別ページ抽出
    salon_inserted = 0
    for t_url in individual_urls:
        if _shutdown:
            break

        t_html = fetch_page_smart(t_url, label="S3: ")
        if not t_html:
            stats['fetch_failed'] = stats.get('fetch_failed', 0) + 1
            continue
        _cache.save("therapist", f"{salon_id}_{md5(t_url.encode()).hexdigest()[:12]}", t_html)

        try:
            data = extract_therapist_info(
                t_html,
                salon_name=salon_name,
                salon_display=salon_display,
                url=t_url,
            )
        except Exception:
            stats['extract_failed'] = stats.get('extract_failed', 0) + 1
            continue

        if not data or not data.get('name'):
            stats['skipped_no_name' if data else 'extract_failed'] = \
                stats.get('skipped_no_name' if data else 'extract_failed', 0) + 1
            continue

        stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + data.get('input_tokens', 0)
        stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + data.get('output_tokens', 0)

        data['source_url'] = t_url

        if not args.dry_run:
            t_id = insert_therapist_new(cur, salon_id, data)
            if t_id:
                stats['inserted'] = stats.get('inserted', 0) + 1
                salon_inserted += 1
            else:
                stats['db_error'] = stats.get('db_error', 0) + 1
        else:
            stats['inserted'] = stats.get('inserted', 0) + 1
            salon_inserted += 1

        time.sleep(0.5)

    # --- Stage 3 全件失敗 → 一覧ページからsingle_page fallback ---
    if salon_inserted == 0 and listing_html:
        log.info("  Stage 3 全件失敗 → 一覧ページからsingle_page抽出")
        therapists = haiku_extract_single_page(listing_html, salon_display, listing_url_for_fallback)
        log.info(f"  single_page fallback: {len(therapists)} 名抽出")
        count = 0
        for t_data in therapists:
            t_data['source_url'] = listing_url_for_fallback
            stats['total_input_tokens'] = stats.get('total_input_tokens', 0) + t_data.pop('input_tokens', 0)
            stats['total_output_tokens'] = stats.get('total_output_tokens', 0) + t_data.pop('output_tokens', 0)
            # single_page: insert_therapist_new()の3点dedup(url+name)に委譲
            if not args.dry_run:
                t_id = insert_therapist_new(cur, salon_id, t_data)
                if t_id:
                    count += 1
                    salon_inserted += 1
            else:
                count += 1
                salon_inserted += 1
        stats['inserted'] = stats.get('inserted', 0) + count

    return salon_inserted


def run_full(args):
    """--full モード: 全サロン統一スクレイピング

    全サロンを3段階Haikuフローで処理（ヒューリスティック経路は廃止）。
    Stage 1: TOPページ → page_type判定
    Stage 2: 一覧ページ → 個別URL抽出
    Stage 3: 個別ページ → Haiku全フィールド抽出 → INSERT
    """
    cp_path = _checkpoint_path("full", args.start_id, args.end_id)
    checkpoint = load_checkpoint(cp_path) if args.resume else _default_checkpoint()
    done_ids = set(checkpoint['done_ids'])  # done salon_ids
    stats = checkpoint['stats']

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # --- 全サロン: 3段階Haikuフローで処理（ヒューリスティック経路は廃止）---
    where_parts = ["s.official_url IS NOT NULL"]
    params = {}
    if args.start_id is not None:
        where_parts.append("s.id >= %(start_id)s")
        params['start_id'] = args.start_id
    if args.end_id is not None:
        where_parts.append("s.id < %(end_id)s")
        params['end_id'] = args.end_id

    where_sql = " AND ".join(where_parts)
    cur.execute(f"""
        SELECT s.id AS salon_id, s.name AS salon_name,
               s.display_name AS salon_display, s.official_url
        FROM salons s
        WHERE {where_sql}
        ORDER BY s.id
    """, params)
    all_salons = cur.fetchall()

    if args.limit:
        all_salons = all_salons[:args.limit]

    # 処理済みスキップ
    all_salons = [s for s in all_salons if s['salon_id'] not in done_ids]

    total = len(all_salons)
    log.info(f"--full モード: 対象サロン {total} 件 (全件Haikuフロー)")

    if not total:
        log.info("処理対象が0件のため終了")
        conn.close()
        return

    if not stats.get('started_at'):
        stats['started_at'] = datetime.now().isoformat()

    start_time = time.time()
    batch_count = 0

    for idx, salon in enumerate(all_salons):
        if _shutdown:
            log.info("シャットダウン — チェックポイント保存中...")
            break

        salon_id = salon['salon_id']
        salon_display = salon.get('salon_display') or salon.get('salon_name') or ''

        salon_inserted = _process_haiku_salon(cur, salon, args, stats, _shutdown)

        done_ids.add(salon_id)
        stats['processed'] = stats.get('processed', 0) + 1
        batch_count += 1

        if salon_inserted > 0:
            log.info(f"[{idx + 1}/{total}] {salon_display}: +{salon_inserted}名")

        # batch-size ごとにコミット
        if batch_count >= args.batch_size:
            if not args.dry_run:
                conn.commit()
            checkpoint['done_ids'] = list(done_ids)
            checkpoint['stats'] = stats
            save_checkpoint(checkpoint, cp_path)
            batch_count = 0

    # 最終コミット
    if not args.dry_run:
        conn.commit()
    checkpoint['done_ids'] = list(done_ids)
    checkpoint['stats'] = stats
    save_checkpoint(checkpoint, cp_path)

    elapsed = timedelta(seconds=int(time.time() - start_time))
    log.info(f"\n{'=' * 60}")
    log.info(f" --full 完了 ({elapsed})")
    log.info(f"{'=' * 60}")
    log.info(f"  サロン処理:    {stats.get('processed', 0)} 件")
    log.info(f"  INSERT成功:    {stats.get('inserted', 0)} 件")
    log.info(f"  fetch失敗:     {stats.get('fetch_failed', 0)} 件")
    log.info(f"  extract失敗:   {stats.get('extract_failed', 0)} 件")
    log.info(f"  name=null:     {stats.get('skipped_no_name', 0)} 件")
    log.info(f"  DBエラー:      {stats.get('db_error', 0)} 件")
    log.info(f"  入力トークン:  {stats.get('total_input_tokens', 0):,}")
    log.info(f"  出力トークン:  {stats.get('total_output_tokens', 0):,}")

    conn.close()


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='セラピスト情報 Haiku 一括抽出バッチ')

    parser.add_argument('--full', action='store_true',
                        help='全サロン3段階Haikuフロー（デフォルト動作、明示用）')
    # 廃止済み引数（明示エラー）
    parser.add_argument('--new', action='store_true',
                        help=argparse.SUPPRESS)
    parser.add_argument('--existing', action='store_true',
                        help=argparse.SUPPRESS)
    parser.add_argument('--start-id', type=int, default=None,
                        help='開始サロンID（VPS並列用）')
    parser.add_argument('--end-id', type=int, default=None,
                        help='終了サロンID（VPS並列用）')
    parser.add_argument('--resume', action='store_true',
                        help='チェックポイントから再開')
    parser.add_argument('--limit', type=int, default=0,
                        help='処理件数制限（テスト用）')
    parser.add_argument('--dry-run', action='store_true',
                        help='DB書き込みスキップ')
    parser.add_argument('--batch-size', type=int, default=100,
                        help='コミット+チェックポイント間隔（default: 100）')

    args = parser.parse_args()

    if args.existing or args.new:
        parser.error("--existing/--new は廃止されました。引数なし または --full で実行してください。")

    log.info("=" * 60)
    log.info(" セラピスト情報 Haiku 一括抽出バッチ")
    log.info(f" batch_size={args.batch_size}"
             f" dry_run={args.dry_run} resume={args.resume}")
    if args.start_id is not None or args.end_id is not None:
        log.info(f" ID範囲: [{args.start_id} .. {args.end_id})")
    log.info("=" * 60)

    run_full(args)


if __name__ == '__main__':
    main()
