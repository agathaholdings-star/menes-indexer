#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
失敗サロン Haiku適応型スクレイピングパイプライン

Phase②③でセラピスト0名だった2,977サロンを、Haiku LLMに
ページ構造理解・URL発見を委ねる適応型3ステージパイプラインで再挑戦。

2モード:
  --test N    : 直接API呼び出しでN件テスト（Batch API不使用、CSV結果出力）
  stage1|stage2|stage3 prepare|submit|status|process : Batch APIパイプライン

Usage:
  # 20件テスト
  python scrape_failed_salons.py --test 20

  # Batch APIパイプライン
  python scrape_failed_salons.py stage1 prepare
  python scrape_failed_salons.py stage1 submit
  python scrape_failed_salons.py stage1 status
  python scrape_failed_salons.py stage1 process
  python scrape_failed_salons.py stage2 prepare   # stage1 process後
  ...

前提:
  - supabase start 済み (127.0.0.1:54322)
  - database/.env に ANTHROPIC_API_KEY
"""

import csv
import json
import logging
import os
import re
import sys
import time
import argparse
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# .env読み込み
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

sys.path.insert(0, os.path.dirname(__file__))
from fetch_utils import fetch_page
from html_cache_utils import HtmlCache
from bs4 import BeautifulSoup, Comment
from name_extractor import (
    build_extract_prompt, parse_extract_response,
    collect_image_candidates, extract_therapist_info,
)
from batch_extract_therapist_info import insert_therapist_new

# Playwright はオプショナル（未インストールなら従来動作）
try:
    from playwright_fetch import fetch_page_playwright, cleanup_browser
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

_cache = HtmlCache()

# --- 設定 ---
DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
MODEL = "claude-haiku-4-5-20251001"

SCRIPT_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(SCRIPT_DIR, "batch_api_data", "failed_salons")

LOG_FILE = os.path.join(SCRIPT_DIR, 'scrape_failed_salons.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger(__name__)


# =============================================================================
# Tiered Fetch: requests優先 → Playwright fallback
# =============================================================================

def is_thin_html(html: str) -> bool:
    """
    HTMLがJS描画前のシェル（薄いHTML）かどうか判定。

    - visible text 200文字未満 → 薄い
    - JSフレームワークシェル（#root, #app, __next）+ visible 500文字未満 → 薄い
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, 'html.parser')
    for tag in soup(['script', 'style', 'noscript', 'link', 'meta']):
        tag.decompose()
    visible_text = soup.get_text(strip=True)

    if len(visible_text) < 200:
        return True

    if re.search(r'<div\s+id=["\'](?:root|app|__next)["\']>\s*</div>', html):
        if len(visible_text) < 500:
            return True

    return False


def fetch_page_smart(url: str, label: str = "") -> str | None:
    """
    requests優先 → 薄いHTMLならPlaywrightフォールバック。

    Stage 1（TOP）と Stage 2（一覧）で使用。
    Playwright未インストールなら従来の fetch_page() のみ。
    """
    html = fetch_page(url)

    if html and not is_thin_html(html):
        return html

    if not HAS_PLAYWRIGHT:
        if html and is_thin_html(html):
            log.info(f"  {label}Thin HTML detected but Playwright unavailable")
        return html

    reason = "fetch failed" if not html else "thin HTML detected"
    log.info(f"  {label}{reason} → Playwright fallback: {url}")
    pw_html = fetch_page_playwright(url)
    if pw_html:
        log.info(f"  {label}Playwright OK ({len(pw_html):,} chars)")
        return pw_html

    log.info(f"  {label}Playwright also failed")
    return html  # requests版のHTMLがあればそれを返す（Noneかもしれない）


# =============================================================================
# リンク抽出（clean_html_for_llmで落ちるナビゲーション対策）
# =============================================================================

def extract_page_links(html: str, base_url: str, max_links: int = 50) -> str:
    """HTMLから内部リンク一覧を抽出。clean_html_for_llmで消えるナビを補完する。"""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, 'html.parser')
    base_domain = urlparse(base_url).netloc.lower()

    links = []
    seen = set()
    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        if not href or href.startswith(('javascript:', 'mailto:', 'tel:')):
            continue

        full_url = urljoin(base_url, href)
        if full_url in seen:
            continue
        seen.add(full_url)

        # 内部リンクのみ（外部サイトは除外）
        link_domain = urlparse(full_url).netloc.lower()
        if link_domain != base_domain:
            continue

        text = a.get_text(strip=True)[:60]
        links.append(f"  {text} → {full_url}" if text else f"  {full_url}")

    if not links:
        return ""
    return "\n## ページ内リンク一覧（内部リンクのみ）\n" + "\n".join(links[:max_links])


# =============================================================================
# HTML軽量化（Stage 1/2用: nav/header/footer保持版）
# =============================================================================

def clean_html_full(html: str, base_url: str, max_chars: int = 100_000) -> str:
    """Stage 1/2用: ナビ構造保持・大容量のHTML軽量化。

    clean_html_for_llm() との違い:
    - nav/header/footer を保持（セラピスト一覧へのリンクがここにある）
    - max_chars を100Kに拡大（情報欠落を最小化）
    """
    soup = BeautifulSoup(html, 'html.parser')

    # script/style/noscriptのみ除去（nav/header/footerは保持！）
    for tag in soup(['script', 'style', 'noscript', 'iframe', 'svg']):
        tag.decompose()
    for comment in soup.find_all(string=lambda s: isinstance(s, Comment)):
        comment.extract()

    # リンクをマークダウン形式に
    for a in soup.find_all('a', href=True):
        href = urljoin(base_url, a['href'])
        text = a.get_text(strip=True)
        if text and href.startswith('http'):
            a.replace_with(f"[{text}]({href})")

    # imgのsrcを保持
    for img in soup.find_all('img'):
        src = img.get('src') or img.get('data-src') or img.get('data-lazy-src') or ''
        if src:
            src = urljoin(base_url, src)
            alt = img.get('alt', '')
            img.replace_with(f"[IMG:{alt}]({src})")
        else:
            img.decompose()

    text = soup.get_text(separator='\n')
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    text = '\n'.join(lines)

    if len(text) > max_chars:
        text = text[:max_chars] + "\n[...truncated...]"
    return text


# =============================================================================
# URLバリデーション
# =============================================================================

_STATIC_EXTENSIONS = frozenset([
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
    '.css', '.js', '.pdf', '.zip', '.mp4', '.mp3',
    '.woff', '.woff2', '.ttf', '.eot',
])


def is_valid_therapist_url(url: str, base_domain: str = "") -> bool:
    """URLがセラピストページとして妥当かバリデーション。

    画像/CSS/JS等の静的アセットURLを除外する。
    """
    if not url or not url.startswith('http'):
        return False

    parsed = urlparse(url)
    path_lower = parsed.path.lower()

    # 静的アセット拡張子を除外
    for ext in _STATIC_EXTENSIONS:
        if path_lower.endswith(ext):
            return False

    # ドメインチェック（指定時）
    if base_domain and parsed.netloc.lower() != base_domain:
        return False

    return True


def _reanchor_url(url: str, official_url: str) -> str:
    """LLMが返したURLのドメインを公式URLのドメインで上書き。パスは保持。

    LLMがドメインをハルシネーションするケース対策（sh-gzs → sh-gzz 等）。
    外部ドメイン（ranking-deli.jp等のポータル）はそのまま返す。
    """
    if not url or not official_url:
        return url
    parsed = urlparse(url)
    official_parsed = urlparse(official_url)
    official_domain = official_parsed.netloc.lower()
    url_domain = parsed.netloc.lower()

    # 完全一致ならそのまま
    if url_domain == official_domain:
        return url

    # 明らかに別サービス（ポータル等）はそのまま
    # TLDが異なれば確実に外部 → スキップ
    def _tld(d):
        parts = d.split('.')
        return parts[-1] if parts else d

    if _tld(url_domain) != _tld(official_domain):
        return url

    # TLDが同じ場合、ドメイン全体の類似度で判定
    # sh-gzz.tokyo vs sh-gzs.tokyo → 類似 → typo
    # example.tokyo vs sh-gzs.tokyo → 非類似 → 外部
    from difflib import SequenceMatcher
    ratio = SequenceMatcher(None, url_domain, official_domain).ratio()
    if ratio < 0.7:
        return url

    # 同系ドメインだがtypo → 公式ドメインで上書き
    from urllib.parse import urlunparse
    return urlunparse(parsed._replace(
        scheme=official_parsed.scheme or parsed.scheme,
        netloc=official_parsed.netloc,
    ))


def _reanchor_stage1_urls(result: dict, official_url: str) -> dict:
    """Stage 1/2 レスポンス内の全URLを公式ドメインで再アンカー"""
    if not result:
        return result

    if result.get('listing_url'):
        result['listing_url'] = _reanchor_url(result['listing_url'], official_url)

    if result.get('individual_urls'):
        result['individual_urls'] = [
            _reanchor_url(u, official_url) for u in result['individual_urls']
        ]

    if result.get('redirect_url'):
        result['redirect_url'] = _reanchor_url(result['redirect_url'], official_url)

    return result


_LISTING_EXCLUDE_PREFIXES = frozenset([
    '/category/', '/tag/', '/author/', '/wp-admin/', '/wp-content/',
    '/wp-login/', '/wp-json/', '/wp-includes/', '/page/', '/feed/',
    '/comments/', '/trackback/', '/xmlrpc', '/sitemap', '/cdn-cgi/',
    '/cart/', '/checkout/', '/attachment/', '/?s=',
])


def _extract_urls_from_html(html: str, base_url: str, patterns: set, existing: set) -> list[str]:
    """HTMLから指定パターンにマッチするURLを抽出（expand/paginationで共用）"""
    base_domain = urlparse(base_url).netloc.lower()
    soup = BeautifulSoup(html, 'html.parser')
    added = []

    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        if not href or href.startswith(('javascript:', 'mailto:', 'tel:', '#')):
            continue

        full_url = urljoin(base_url, href)

        if full_url in existing:
            continue

        # 同一ドメインのみ
        if urlparse(full_url).netloc.lower() != base_domain:
            continue

        # 静的アセット除外
        if not is_valid_therapist_url(full_url):
            continue

        parsed_full = urlparse(full_url)
        matched = False
        for ptype, pval in patterns:
            if ptype == 'query' and parsed_full.query.startswith(pval + '='):
                matched = True
                break
            if ptype == 'path' and parsed_full.path.startswith(pval):
                matched = True
                break
            if ptype == 'all_internal':
                # ルートレベルURL: WP構造パスを除外し全内部リンクを候補にする
                path_lower = parsed_full.path.lower()
                if path_lower and path_lower != '/' and not any(
                    path_lower.startswith(ep) for ep in _LISTING_EXCLUDE_PREFIXES
                ):
                    matched = True
                    break

        if matched:
            added.append(full_url)
            existing.add(full_url)

    return added


def _infer_url_patterns(seed_urls: list[str]) -> set:
    """seed URLsからパス/クエリパターンを推定。

    1. クエリパラメータパターン: ?castid= 等
    2. 共通パスプレフィックス: 全seedの最長共通パス（例: /therapists/521/p.html + /therapists/126/p.html → /therapists/）
    3. ルートレベルURL: 共通プレフィックスが / のみの場合、all_internal フラグで全内部リンクを候補にする
    """
    patterns = set()

    # クエリパラメータパターン (e.g., ?castid=)
    for u in seed_urls:
        parsed = urlparse(u)
        if parsed.query:
            key = parsed.query.split('=')[0]
            patterns.add(('query', key))

    # パスプレフィックスパターン - 全seedの共通プレフィックスを検出
    paths = []
    for u in seed_urls:
        parsed = urlparse(u)
        path = parsed.path.rstrip('/')
        if path:
            paths.append(path)

    if paths:
        segments_list = [p.split('/') for p in paths]
        min_len = min(len(s) for s in segments_list)

        common_depth = 0
        for i in range(min_len):
            if len(set(s[i] for s in segments_list)) == 1:
                common_depth = i + 1
            else:
                break

        if common_depth >= 2:
            # 共通プレフィックスあり (例: /therapists/)
            prefix = '/'.join(segments_list[0][:common_depth]) + '/'
            patterns.add(('path', prefix))
        elif not patterns:
            # queryパターンもpathパターンも見つからない → ルートレベルURL
            # 一覧ページ内の全内部リンクを候補にする（WP構造パスは除外）
            patterns.add(('all_internal', True))

    return patterns


def expand_individual_urls(html_list: list[str] | str, base_url: str, seed_urls: list[str]) -> list[str]:
    """LLMが返したindividual_urlsをヒントに、全HTMLから同パターンのURLを追加抽出。

    clean_html_full() の100K切り詰めでLLMに見えなかったURLを補完する。
    seed_urlsのURLパスパターン（共通プレフィックス or クエリキー）を学習し、
    全HTMLの <a href> から同パターンのURLをマージ。

    html_list: 単一HTMLまたはHTMLのリスト（TOPページ+一覧ページ等）

    例: seed = ["?castid=155", "?castid=148"] → 全HTMLから ?castid= を持つURLを全抽出
    例: seed = ["/therapist/3102", "/therapist/3098"] → /therapist/ 以下を全抽出
    """
    if not seed_urls:
        return seed_urls

    # 文字列→リスト統一
    if isinstance(html_list, str):
        html_list = [html_list]
    html_list = [h for h in html_list if h]
    if not html_list:
        return seed_urls

    patterns = _infer_url_patterns(seed_urls)
    if not patterns:
        return seed_urls

    existing = set(seed_urls)
    all_added = []

    for h in html_list:
        added = _extract_urls_from_html(h, base_url, patterns, existing)
        all_added.extend(added)

    if all_added:
        log.info(f"  URL補完: seed {len(seed_urls)} + 追加 {len(all_added)} = {len(seed_urls) + len(all_added)}")

    return seed_urls + all_added


def detect_pagination(html: str, listing_url: str) -> list[str]:
    """一覧ページのページネーションを検出し、page 2以降のURLを返す。

    検出パターン:
    - /page/2/, /page/3/ ... (WordPress)
    - ?page=2, ?page=3 ... (汎用)
    - ?p=2, ?p=3 ...

    Returns: page 2以降のURL一覧（page 1は含まない）
    """
    soup = BeautifulSoup(html, 'html.parser')
    base_domain = urlparse(listing_url).netloc.lower()
    listing_path = urlparse(listing_url).path.rstrip('/')

    page_urls = set()

    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        if not href or href.startswith(('javascript:', 'mailto:', 'tel:', '#')):
            continue

        full_url = urljoin(listing_url, href)
        parsed = urlparse(full_url)

        if parsed.netloc.lower() != base_domain:
            continue

        path = parsed.path.rstrip('/')

        # WordPress: /category/therapist/page/3/
        import re
        wp_match = re.search(r'/page/(\d+)$', path)
        if wp_match and int(wp_match.group(1)) >= 2:
            # listing_pathが含まれているか確認
            base_path = path[:wp_match.start()]
            if base_path.rstrip('/') == listing_path or listing_path.startswith(base_path.rstrip('/')):
                page_urls.add(full_url.split('?')[0].rstrip('/') + '/')
                continue

        # クエリパラメータ: ?page=2, ?p=2
        if parsed.query:
            for key in ('page', 'p', 'pg', 'paged'):
                qmatch = re.search(rf'(?:^|&){key}=(\d+)', parsed.query)
                if qmatch and int(qmatch.group(1)) >= 2:
                    if parsed.path.rstrip('/') == listing_path:
                        page_urls.add(full_url)
                        break

    # 番号順にソート
    def page_sort_key(u):
        import re
        nums = re.findall(r'(\d+)', u)
        return int(nums[-1]) if nums else 0

    return sorted(page_urls, key=page_sort_key)


def fetch_paginated_listing(listing_html: str, listing_url: str,
                            seed_urls: list[str], salon_name: str = "") -> list[str]:
    """一覧ページのページネーションを検出し、全ページからセラピストURLを収集。

    Returns: seed_urls + 全ページネーションページから追加されたURL
    """
    page_urls = detect_pagination(listing_html, listing_url)
    if not page_urls:
        return seed_urls

    log.info(f"  ページネーション検出: {len(page_urls)} ページ追加 ({page_urls[0]} ... {page_urls[-1]})")

    patterns = _infer_url_patterns(seed_urls)
    if not patterns:
        return seed_urls

    existing = set(seed_urls)
    all_added = []

    for i, page_url in enumerate(page_urls):
        page_html = fetch_page_smart(page_url, label=f"  Page{i+2}: ")
        if not page_html:
            log.info(f"  Page {i+2} fetch失敗 → 終了")
            break

        added = _extract_urls_from_html(page_html, listing_url, patterns, existing)
        all_added.extend(added)
        log.info(f"  Page {i+2}: +{len(added)} URL")

    if all_added:
        log.info(f"  ページネーション合計: +{len(all_added)} URL → 合計 {len(seed_urls) + len(all_added)}")

    return seed_urls + all_added


# =============================================================================
# プラットフォーム検知
# =============================================================================

def detect_platform(url: str, html: str) -> str | None:
    """ドメイン/HTMLマーカーからプラットフォームを早期判定。

    Returns: 'wix' | '3days_cms' | 'crayon' | 'age_gate' | None
    """
    domain = urlparse(url).netloc.lower()

    # ドメインベース
    if 'wixsite.com' in domain:
        return 'wix'
    if 'crayonsite.net' in domain:
        return 'crayon'

    # HTMLベース: Wix（カスタムドメインでも検出）
    if 'wix-code-sdk' in html or 'static.wixstatic.com' in html:
        return 'wix'
    if '<meta name="generator" content="Wix.com' in html:
        return 'wix'

    # 3Days CMS
    if detect_3days_cms(html):
        return '3days_cms'

    # age gate検知（短いHTMLで年齢確認ページ）
    if len(html) < 2000:
        html_lower = html.lower()
        if 'age' in html_lower or 'access denied' in html_lower:
            return 'age_gate'

    return None


# =============================================================================
# 3Days CMS 検出・直接抽出（Alpine.js + S3 data.js パターン）
# =============================================================================

_3DAYS_S3_RE = re.compile(
    r'src=["\']'
    r'(https?://3days-cms-bucket-prod\.s3[^"\']+/data\.js)'
    r'["\']'
)


def detect_3days_cms(html: str) -> str | None:
    """3Days CMS を検出し、data.js の URL を返す。非該当なら None。

    検出条件:
    - x-data="shopData" が HTML内に存在
    - 3days-cms-bucket-prod.s3... の data.js <script> タグ
    """
    if 'x-data="shopData"' not in html and "x-data='shopData'" not in html:
        return None

    m = _3DAYS_S3_RE.search(html)
    if m:
        return m.group(1)
    return None


def parse_3days_data_js(js_text: str, base_url: str, salon_name: str = "") -> list[dict]:
    """3Days CMS の data.js から全セラピスト情報を抽出。

    data.js は var shopData = {...} の JS オブジェクトリテラル。
    therapists 配列内の各エントリから名前・年齢・身長・スリーサイズ・血液型・紹介文・画像を取得。
    """
    therapists = []

    # therapists配列全体を抽出
    m = re.search(r'therapists\s*:\s*\[', js_text)
    if not m:
        return []

    # therapists配列の開始位置から閉じ括弧までを取得
    start = m.start()
    bracket_count = 0
    arr_start = js_text.index('[', start)
    for i in range(arr_start, len(js_text)):
        if js_text[i] == '[':
            bracket_count += 1
        elif js_text[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                arr_text = js_text[arr_start:i+1]
                break
    else:
        return []

    # 各セラピストオブジェクト {} を個別に処理
    # JSONではなくJSオブジェクトリテラルなので正規表現で抽出
    obj_pattern = re.compile(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}')

    for obj_match in obj_pattern.finditer(arr_text):
        obj_text = obj_match.group()

        def extract_field(field_name: str) -> str | None:
            # key:"value" or key:'value' or key: "value"
            pat = re.compile(rf'{field_name}\s*:\s*["\']([^"\']*)["\']')
            m = pat.search(obj_text)
            return m.group(1).strip() if m else None

        name = extract_field("therapistName")
        if not name:
            continue

        # ゴミデータフィルタ（体験枠、店長、OPEN告知等）
        _junk = name.strip()
        if not _junk:
            continue
        # 絵文字で囲まれた体験/イベント枠
        if re.search(r'[💛🔥❕✨🎉]', _junk):
            continue
        # 店長/オーナー/スタッフ
        if re.search(r'(店長|オーナー|スタッフ|manager)', _junk, re.IGNORECASE):
            continue
        # OPEN/オープン告知
        if re.search(r'(OPEN|オープン|開店|求人|募集)', _junk, re.IGNORECASE):
            continue
        # 「体験」のみ
        if re.search(r'^体験', _junk):
            continue

        # サロン名フィルタ
        if salon_name and name == salon_name:
            continue

        age_str = extract_field("age")
        height_str = extract_field("height")
        blood_type = extract_field("bloodType")
        comment = extract_field("comment")
        three_size = extract_field("threeSize")

        # age/height を数値化
        age = None
        if age_str and age_str.isdigit():
            age = int(age_str)
            if age < 18 or age > 70:
                age = None

        height = None
        if height_str and height_str.isdigit():
            height = int(height_str)
            if height < 130 or height > 200:
                height = None

        # スリーサイズ解析: "82(D)-57-84" or "85-58-86"
        cup = None
        bust = None
        waist = None
        hip = None
        if three_size:
            size_m = re.match(
                r'(\d+)\(?([A-Ka-k])?\)?\s*[-/]\s*(\d+)\s*[-/]\s*(\d+)',
                three_size,
            )
            if size_m:
                bust = int(size_m.group(1))
                if size_m.group(2):
                    cup = size_m.group(2).upper()
                waist = int(size_m.group(3))
                hip = int(size_m.group(4))

        # 画像URL
        image_urls = []
        for img_key in ["img1", "img2", "img3", "img4", "img5", "img6"]:
            img_url = extract_field(img_key)
            if img_url and img_url.startswith("http"):
                image_urls.append(img_url)
                if len(image_urls) >= 3:
                    break

        # source_url
        therapist_url_path = extract_field("url")
        source_url = None
        if therapist_url_path:
            source_url = urljoin(base_url, therapist_url_path)

        # blood_type正規化
        if blood_type:
            blood_type = blood_type.replace("型", "").strip().upper()
            if blood_type not in ("A", "B", "O", "AB"):
                blood_type = None

        therapists.append({
            "name": name,
            "age": age,
            "height": height,
            "cup": cup,
            "bust": bust,
            "waist": waist,
            "hip": hip,
            "blood_type": blood_type,
            "profile_text": comment[:200] if comment else None,
            "image_urls": image_urls,
            "source_url": source_url or base_url,
        })

    return therapists


# =============================================================================
# Stage 1 プロンプト: TOPページ分析
# =============================================================================

def build_stage1_prompt(html: str, salon_name: str, url: str) -> str:
    """TOPページからセラピスト関連URLを探すプロンプト"""
    cleaned = clean_html_full(html, url)
    link_list = extract_page_links(html, url)

    return f"""このメンズエステサロンのウェブページを分析し、セラピスト/スタッフに関するURLを探してください。

サロン名: {salon_name}
URL: {url}

ページ内容（軽量化済み）:
{cleaned}
{link_list}

## 探すべきもの
1. セラピスト/スタッフ一覧ページのURL（別ページにある場合）
2. セラピスト個別プロフィールページのURL（見つかれば全員分）

## 注意点
- ナビゲーション/メニューのリンクを確認（「スタッフ」「セラピスト」「キャスト」「在籍」等）
- エイジゲート（年齢確認）ページの場合: 確認後の実際のURLを推定して返す
- アンカーリンク（#staff, #therapist等）: そのセクション内にデータがあるか確認
- クエリパラメータ型URL（?list_3/等）も考慮
- 非標準パス（/member/, /models/, /team/等）も探す
- ページ自体にセラピスト一覧が掲載されている場合は single_page
- サロンのサイトではない/閉店/セラピスト情報が一切ない場合は no_therapists

## individual_urls について
- 画像URL（.jpg, .png等）は含めない

## page_type の判定基準
- "listing": セラピスト一覧ページへのリンクが見つかった（listing_urlに設定）
- "has_individuals": 個別プロフィールページへのリンクが直接見つかった（individual_urlsに設定）
- "single_page": 現在のページ自体にセラピスト情報（名前+写真）が複数人分ある
- "age_gate": 年齢確認ページ。実際のサイトURLを redirect_url に設定
- "no_therapists": セラピスト情報が見つからない/サイトダウン

## 重要: listing_url は常に返す
- page_type が "has_individuals" でも、セラピスト一覧ページへのナビリンクが存在するなら listing_url に設定すること
- トップページには「本日出勤」「おすすめ」等の一部セラピストしか載っていないことが多い。一覧ページには全員載っている
- listing_url と individual_urls は排他ではない。両方見つかれば両方返す

## 出力: JSONのみ（余計なテキスト不要）
{{"page_type":"listing|has_individuals|single_page|age_gate|no_therapists","listing_url":"一覧ページURL or null","individual_urls":["個別URL1","URL2"],"redirect_url":"エイジゲート先URL or null","notes":"判断理由1文"}}"""


def parse_stage1_response(result_text: str) -> dict | None:
    """Stage 1/2 のレスポンスをパース"""
    try:
        text = result_text.strip()
        json_match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
        if json_match:
            text = json_match.group(1)
        # JSONオブジェクトを探す
        text = text.strip()
        js = text.find("{")
        je = text.rfind("}") + 1
        if js >= 0 and je > js:
            text = text[js:je]

        data = json.loads(text)

        # バリデーション
        page_type = data.get("page_type", "no_therapists")
        if page_type not in ("listing", "has_individuals", "single_page",
                             "age_gate", "no_therapists"):
            page_type = "no_therapists"

        listing_url = data.get("listing_url")
        if listing_url and not is_valid_therapist_url(listing_url):
            listing_url = None

        individual_urls = data.get("individual_urls") or []
        if not isinstance(individual_urls, list):
            individual_urls = []
        individual_urls = [
            u for u in individual_urls
            if isinstance(u, str) and is_valid_therapist_url(u)
        ]

        redirect_url = data.get("redirect_url")
        if redirect_url and not redirect_url.startswith("http"):
            redirect_url = None

        return {
            "page_type": page_type,
            "listing_url": listing_url,
            "individual_urls": individual_urls,
            "redirect_url": redirect_url,
            "notes": data.get("notes", ""),
        }
    except (json.JSONDecodeError, Exception) as e:
        log.warning(f"Stage1 parse error: {e} | raw: {result_text[:200]}")
        return None


# =============================================================================
# Single Page 抽出: 1ページから複数セラピストを一括抽出
# =============================================================================

def build_single_page_prompt(html: str, salon_name: str, url: str) -> str:
    """1ページに複数セラピストが掲載されているケースの抽出プロンプト"""
    cleaned = clean_html_full(html, url)

    image_cands = collect_image_candidates(html, url)
    if image_cands:
        img_lines = []
        for i, c in enumerate(image_cands[:50]):  # 上限50件
            line = f"[{i}] {c['url']}"
            if c["alt"]:
                line += f' alt="{c["alt"]}"'
            if c["class"]:
                line += f' class="{c["class"]}"'
            if c["parent"]:
                line += f" {c['parent']}"
            img_lines.append(line)
        image_section = f"\n## 画像候補（{len(image_cands)}件）\n" + "\n".join(img_lines)
    else:
        image_section = "\n## 画像候補\nなし"

    return f"""このメンズエステサロンのページに掲載されている全セラピストの情報を抽出してJSON配列で返してください。

サロン名: {salon_name}
URL: {url}

ページ内容（軽量化済み）:
{cleaned}
{image_section}

## 各セラピストから抽出するフィールド
- name（必須）: セラピスト個人の名前。年齢・キャッチコピー・「NEW FACE」等の装飾は除去
- age: 数値のみ。記載なしはnull
- height: 数値のみ。記載なしはnull
- cup: アルファベット1文字（A〜K）。記載なしはnull
- bust, waist, hip: 数値のみ。記載なしはnull
- blood_type: A/B/O/AB。記載なしはnull
- profile_text: 紹介文（200文字以内に要約）。なければnull
- image_urls: そのセラピスト本人の写真URLのみ（最大3枚）。ロゴ・バナー・ナビ画像は除外

## ルール
- ページ内の全セラピストを抽出（最大30名）
- 名前が取れないセラピストはスキップ
- サロン名（「{salon_name}」）はセラピスト名ではない
- 画像候補リストの番号[N]ではなく、実際のURLを返すこと

## 出力: JSON配列のみ（余計なテキスト不要）
```json
[{{"name":"名前1","age":23,"height":158,"cup":"D","bust":86,"waist":57,"hip":85,"blood_type":"O","profile_text":"紹介文...","image_urls":["URL1"]}},{{"name":"名前2","age":null,"height":null,"cup":null,"bust":null,"waist":null,"hip":null,"blood_type":null,"profile_text":null,"image_urls":[]}}]
```"""


def parse_single_page_response(result_text: str, salon_name: str = "",
                                salon_display: str = "", url: str = "") -> list[dict]:
    """single_page応答をパース → セラピスト情報のリスト"""
    try:
        text = result_text.strip()
        json_match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
        if json_match:
            text = json_match.group(1)
        # JSON配列を探す
        text = text.strip()
        js = text.find("[")
        je = text.rfind("]") + 1
        if js >= 0 and je > js:
            text = text[js:je]

        data_list = json.loads(text)
        if not isinstance(data_list, list):
            return []

        results = []
        for item in data_list:
            # parse_extract_response と同じバリデーションを適用
            parsed = parse_extract_response(
                json.dumps(item, ensure_ascii=False),
                salon_name=salon_name,
                salon_display=salon_display,
                url=url,
            )
            if parsed and parsed.get("name"):
                results.append(parsed)
        return results

    except (json.JSONDecodeError, Exception) as e:
        log.warning(f"Single page parse error: {e} | raw: {result_text[:200]}")
        return []


def haiku_extract_single_page(html: str, salon_name: str, url: str) -> list[dict]:
    """single_page: Haiku で1ページから複数セラピストを一括抽出（直接API）"""
    from anthropic import Anthropic
    client = Anthropic()

    prompt = build_single_page_prompt(html, salon_name, url)

    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=8000,
            messages=[{"role": "user", "content": prompt}],
        )
        result_text = resp.content[0].text.strip()
        therapists = parse_single_page_response(result_text, salon_name, salon_name, url)

        input_tokens = resp.usage.input_tokens
        output_tokens = resp.usage.output_tokens
        for t in therapists:
            t["input_tokens"] = input_tokens // max(len(therapists), 1)
            t["output_tokens"] = output_tokens // max(len(therapists), 1)

        return therapists
    except Exception as e:
        log.warning(f"  Single page API error: {e}")
        return []


# =============================================================================
# 失敗サロン一覧取得
# =============================================================================

def get_failed_salons(limit: int | None = None) -> list[dict]:
    """セラピスト0名のサロンを取得"""
    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT s.id AS salon_id, s.name AS salon_name,
               s.display_name AS salon_display,
               s.official_url
        FROM salons s
        WHERE s.official_url IS NOT NULL
          AND s.id NOT IN (
              SELECT DISTINCT salon_id FROM therapists
          )
        ORDER BY s.id
    """)
    rows = cur.fetchall()
    conn.close()

    if limit:
        rows = rows[:limit]
    return rows


def get_salons_by_ids(salon_ids: list[int]) -> list[dict]:
    """指定されたsalon_idのサロン情報を取得（セラピスト有無に関わらず）"""
    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT s.id AS salon_id, s.name AS salon_name,
               s.display_name AS salon_display,
               s.official_url
        FROM salons s
        WHERE s.id = ANY(%s)
          AND s.official_url IS NOT NULL
        ORDER BY s.id
    """, (salon_ids,))
    rows = cur.fetchall()
    conn.close()
    return rows


# =============================================================================
# Haiku API呼び出し（テストモード用）
# =============================================================================

def haiku_analyze_page(html: str, salon_name: str, url: str) -> dict | None:
    """Stage 1/2: Haiku にページ分析を依頼（直接API呼び出し）"""
    from anthropic import Anthropic
    client = Anthropic()

    prompt = build_stage1_prompt(html, salon_name, url)

    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=8000,
            messages=[{"role": "user", "content": prompt}],
        )
        result_text = resp.content[0].text.strip()
        stop_reason = resp.stop_reason
        log.debug(f"  Haiku response ({stop_reason}): {result_text[:200]}")

        if stop_reason == "max_tokens":
            log.warning(f"  Haiku max_tokens reached — response may be truncated")

        parsed = parse_stage1_response(result_text)
        if parsed:
            parsed["input_tokens"] = resp.usage.input_tokens
            parsed["output_tokens"] = resp.usage.output_tokens
        return parsed
    except Exception as e:
        log.warning(f"  Haiku API error: {e}")
        return None


# =============================================================================
# --test モード: N件テスト（直接API、CSV出力）
# =============================================================================

def run_test(salons: list[dict], csv_path: str | None = None):
    """テスト実行（直接API呼び出し）"""
    if csv_path is None:
        csv_path = os.path.join(SCRIPT_DIR, "failed_salons_test_result.csv")
    log.info(f"テストモード: {len(salons)} サロン → {csv_path}")

    results = []
    stats = {
        "total": 0, "fetch_failed": 0, "no_therapists": 0,
        "listing": 0, "has_individuals": 0, "single_page": 0,
        "age_gate": 0, "therapists_inserted": 0,
        "total_input_tokens": 0, "total_output_tokens": 0,
    }

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    for idx, salon in enumerate(salons):
        sid = salon["salon_id"]
        name = salon["salon_display"] or salon["salon_name"] or ""
        url = salon["official_url"]

        log.info(f"\n[{idx+1}/{len(salons)}] #{sid} {name} — {url}")
        stats["total"] += 1

        row = {
            "salon_id": sid, "salon_name": name, "official_url": url,
            "page_type": "", "listing_url": "", "individual_count": 0,
            "therapists_found": 0, "status": "", "fail_reason": "", "notes": "",
        }

        # --- Stage 1: TOPページ分析 ---
        html = fetch_page_smart(url, label="Stage1 TOP: ")
        if not html:
            log.info("  fetch失敗")
            stats["fetch_failed"] += 1
            row["status"] = "FETCH_FAILED"
            row["fail_reason"] = "domain_dead"
            results.append(row)
            continue

        _cache.save("salon_top", sid, html)

        # --- 3Days CMS 直接抽出（LLM不要、$0）---
        data_js_url = detect_3days_cms(html)
        if data_js_url:
            log.info(f"  3Days CMS detected → {data_js_url}")
            js_text = fetch_page(data_js_url)
            if js_text:
                therapists = parse_3days_data_js(js_text, url, salon_name=name)
                log.info(f"  3Days CMS: {len(therapists)} 名抽出")

                row["page_type"] = "3days_cms"
                row["notes"] = f"3Days CMS direct extraction from data.js"
                row["individual_count"] = len(therapists)

                therapist_count = 0
                for t_data in therapists:
                    t_id = insert_therapist_new(cur, sid, t_data)
                    if t_id:
                        therapist_count += 1
                        log.info(f"    → {t_data['name']} (id={t_id})")
                    else:
                        log.info(f"    → {t_data['name']} (INSERT失敗/重複)")

                stats["therapists_inserted"] += therapist_count
                row["therapists_found"] = therapist_count
                row["status"] = "OK" if therapist_count > 0 else "NO_DATA"
                results.append(row)
                conn.commit()
                continue
            else:
                log.info(f"  3Days CMS data.js fetch失敗 → Haiku fallback")

        result1 = haiku_analyze_page(html, name, url)
        if not result1:
            log.info("  Haiku分析失敗")
            stats["no_therapists"] += 1
            row["status"] = "ANALYZE_FAILED"
            row["fail_reason"] = "haiku_parse_error"
            results.append(row)
            continue

        # LLMドメインハルシネーション対策: URLを公式ドメインで再アンカー
        _reanchor_stage1_urls(result1, url)

        stats["total_input_tokens"] += result1.get("input_tokens", 0)
        stats["total_output_tokens"] += result1.get("output_tokens", 0)

        page_type = result1["page_type"]
        row["page_type"] = page_type
        row["notes"] = result1.get("notes", "")
        log.info(f"  Stage 1: {page_type} — {result1.get('notes', '')}")

        # エイジゲート → リダイレクト先で再分析
        if page_type == "age_gate" and result1.get("redirect_url"):
            redirect_url = result1["redirect_url"]
            log.info(f"  エイジゲート → {redirect_url}")
            html = fetch_page(redirect_url)
            if html:
                _cache.save("salon_top", f"{sid}_redirected", html)
                result1 = haiku_analyze_page(html, name, redirect_url)
                if result1:
                    _reanchor_stage1_urls(result1, redirect_url)
                    stats["total_input_tokens"] += result1.get("input_tokens", 0)
                    stats["total_output_tokens"] += result1.get("output_tokens", 0)
                    page_type = result1["page_type"]
                    row["page_type"] = page_type
                    row["notes"] += f" → redirect: {page_type}"
                    log.info(f"  再分析: {page_type}")

        individual_urls = []
        listing_html = None
        listing_url_for_fallback = None

        # 補正: single_pageでもindividual_urlsがあればhas_individualsに変更
        # ただし全URLが外部ドメインの場合は補正しない（予約サイト等）
        if page_type == "single_page" and result1.get("individual_urls"):
            salon_domain = urlparse(url).netloc.lower()
            ext_urls = result1["individual_urls"]
            all_external = all(
                urlparse(u).netloc.lower() != salon_domain
                for u in ext_urls
            )
            if all_external:
                log.info(f"  補正スキップ: individual_urls全{len(ext_urls)}件が外部ドメイン → single_page維持")
                result1["individual_urls"] = []  # 外部URLを使わない
            else:
                log.info(f"  補正: single_page → has_individuals ({len(ext_urls)} URLs)")
                page_type = "has_individuals"
                row["page_type"] = page_type

        if page_type == "has_individuals":
            individual_urls = result1.get("individual_urls", [])
            stats["has_individuals"] += 1

            # listing_url もあれば一覧ページからURLをマージ（トップは一部しか載せない）
            listing_url_extra = result1.get("listing_url")
            if listing_url_extra:
                log.info(f"  has_individuals + listing_url → 一覧ページもfetch: {listing_url_extra}")
                row["listing_url"] = listing_url_extra
                list_html = fetch_page_smart(listing_url_extra, label="Stage2 LIST(補完): ")
                if list_html:
                    _cache.save("salon_list", sid, list_html)
                    listing_html = list_html
                    listing_url_for_fallback = listing_url_extra

                    # 3Days CMS チェック
                    list_data_js_url = detect_3days_cms(list_html)
                    if list_data_js_url:
                        log.info(f"  一覧ページ: 3Days CMS detected → {list_data_js_url}")
                        js_text = fetch_page(list_data_js_url)
                        if js_text:
                            therapists = parse_3days_data_js(js_text, listing_url_extra, salon_name=name)
                            log.info(f"  3Days CMS (一覧): {len(therapists)} 名抽出")
                            therapist_count = 0
                            for t_data in therapists:
                                t_id = insert_therapist_new(cur, sid, t_data)
                                if t_id:
                                    therapist_count += 1
                                    log.info(f"    → {t_data['name']} (id={t_id})")
                            stats["therapists_inserted"] += therapist_count
                            row["therapists_found"] = therapist_count
                            row["individual_count"] = len(therapists)
                            row["page_type"] = "3days_cms"
                            row["status"] = "OK" if therapist_count > 0 else "NO_DATA"
                            results.append(row)
                            conn.commit()
                            continue
                    else:
                        # Haiku で一覧ページから個別URL抽出
                        result2 = haiku_analyze_page(list_html, name, listing_url_extra)
                        if result2:
                            _reanchor_stage1_urls(result2, listing_url_extra)
                            stats["total_input_tokens"] += result2.get("input_tokens", 0)
                            stats["total_output_tokens"] += result2.get("output_tokens", 0)
                            extra_urls = result2.get("individual_urls", [])
                            if extra_urls:
                                # トップページURLと一覧ページURLをマージ（重複排除）
                                existing = set(individual_urls)
                                merged_count = 0
                                for u in extra_urls:
                                    if u not in existing:
                                        individual_urls.append(u)
                                        existing.add(u)
                                        merged_count += 1
                                log.info(f"  一覧ページから +{merged_count} URL追加 → 合計 {len(individual_urls)}")

        elif page_type == "listing":
            listing_url = result1.get("listing_url")
            row["listing_url"] = listing_url or ""
            stats["listing"] += 1

            if listing_url:
                # --- Stage 2: 一覧ページ分析 ---
                log.info(f"  Stage 2: {listing_url}")
                # .click ドメインはPlaywright強制（JS描画が多い）
                if HAS_PLAYWRIGHT and urlparse(listing_url).netloc.lower().endswith('.click'):
                    log.info(f"  .click ドメイン → Playwright強制: {listing_url}")
                    list_html = fetch_page_playwright(listing_url)
                else:
                    list_html = fetch_page_smart(listing_url, label="Stage2 LIST: ")
                if list_html:
                    _cache.save("salon_list", sid, list_html)
                    listing_html = list_html
                    listing_url_for_fallback = listing_url

                    # Stage 2 でも 3Days CMS チェック
                    list_data_js_url = detect_3days_cms(list_html)
                    if list_data_js_url:
                        log.info(f"  Stage 2: 3Days CMS detected → {list_data_js_url}")
                        js_text = fetch_page(list_data_js_url)
                        if js_text:
                            therapists = parse_3days_data_js(js_text, listing_url, salon_name=name)
                            log.info(f"  3Days CMS (Stage 2): {len(therapists)} 名抽出")

                            therapist_count = 0
                            for t_data in therapists:
                                t_id = insert_therapist_new(cur, sid, t_data)
                                if t_id:
                                    therapist_count += 1
                                    log.info(f"    → {t_data['name']} (id={t_id})")
                                else:
                                    log.info(f"    → {t_data['name']} (INSERT失敗/重複)")

                            stats["therapists_inserted"] += therapist_count
                            row["therapists_found"] = therapist_count
                            row["individual_count"] = len(therapists)
                            row["page_type"] = "3days_cms"
                            row["status"] = "OK" if therapist_count > 0 else "NO_DATA"
                            results.append(row)
                            conn.commit()
                            continue

                    result2 = haiku_analyze_page(list_html, name, listing_url)
                    if result2:
                        _reanchor_stage1_urls(result2, listing_url)
                        stats["total_input_tokens"] += result2.get("input_tokens", 0)
                        stats["total_output_tokens"] += result2.get("output_tokens", 0)
                        individual_urls = result2.get("individual_urls", [])
                        log.info(f"  Stage 2 結果: {len(individual_urls)} 個別URL")

                    # Stage 2で個別URLが取れない → 一覧ページ自体をsingle_page抽出
                    if not individual_urls and list_html:
                        log.info("  Stage 2 個別URLなし → 一覧ページからsingle_page抽出")
                        therapists = haiku_extract_single_page(list_html, name, listing_url)
                        log.info(f"  single_page fallback: {len(therapists)} 名抽出")

                        therapist_count = 0
                        for t_data in therapists:
                            t_data["source_url"] = listing_url
                            stats["total_input_tokens"] += t_data.pop("input_tokens", 0)
                            stats["total_output_tokens"] += t_data.pop("output_tokens", 0)
                            t_id = insert_therapist_new(cur, sid, t_data)
                            if t_id:
                                therapist_count += 1
                                log.info(f"    → {t_data['name']} (id={t_id})")
                            else:
                                log.info(f"    → {t_data['name']} (INSERT失敗/重複)")

                        stats["therapists_inserted"] += therapist_count
                        row["therapists_found"] = therapist_count
                        row["individual_count"] = len(therapists)
                        row["status"] = "OK" if therapist_count > 0 else "NO_DATA"
                        results.append(row)
                        conn.commit()
                        continue
                else:
                    log.info("  一覧ページ fetch失敗")

        elif page_type == "single_page":
            # TOPページ自体から複数セラピストを一括抽出
            stats["single_page"] += 1
            log.info("  single_page: TOPページから一括抽出")
            therapists = haiku_extract_single_page(html, name, url)
            log.info(f"  single_page: {len(therapists)} 名抽出")

            therapist_count = 0
            for t_data in therapists:
                t_data["source_url"] = url
                stats["total_input_tokens"] += t_data.pop("input_tokens", 0)
                stats["total_output_tokens"] += t_data.pop("output_tokens", 0)

                t_id = insert_therapist_new(cur, sid, t_data)
                if t_id:
                    therapist_count += 1
                    log.info(f"    → {t_data['name']} (id={t_id})")
                else:
                    log.info(f"    → {t_data['name']} (INSERT失敗/重複)")

            stats["therapists_inserted"] += therapist_count
            row["therapists_found"] = therapist_count
            row["individual_count"] = len(therapists)
            row["status"] = "OK" if therapist_count > 0 else "NO_DATA"
            results.append(row)
            conn.commit()
            continue

        elif page_type == "no_therapists":
            stats["no_therapists"] += 1
            row["status"] = "NO_THERAPISTS"
            row["fail_reason"] = "no_therapist_info"
            results.append(row)
            continue

        else:
            stats["no_therapists"] += 1
            row["status"] = "UNKNOWN_TYPE"
            row["fail_reason"] = "unknown_page_type"
            results.append(row)
            continue

        # listing_html fallback: TOP page
        if listing_html is None:
            listing_html = html
            listing_url_for_fallback = url

        # --- URL補完: TOP+一覧の全HTMLから同パターンのURLを追加抽出 ---
        if individual_urls:
            html_sources = [h for h in [html, listing_html] if h]
            individual_urls = expand_individual_urls(html_sources, url, individual_urls)

        # --- ページネーション: 一覧ページにpage 2以降があれば全ページからURL収集 ---
        if individual_urls and listing_html and listing_url_for_fallback:
            individual_urls = fetch_paginated_listing(
                listing_html, listing_url_for_fallback,
                individual_urls, salon_name=name
            )

        # --- プラットフォーム検知 + Wix外部URL除外 ---
        platform = detect_platform(url, html)
        if platform == 'wix' and individual_urls:
            salon_domain = urlparse(url).netloc.lower()
            internal_urls = [u for u in individual_urls
                             if urlparse(u).netloc.lower() == salon_domain
                             or salon_domain in urlparse(u).netloc.lower()]
            if not internal_urls:
                log.info(f"  Wix: 外部URLのみ ({len(individual_urls)}件) → single_page fallbackへ")
                individual_urls = []
            else:
                removed = len(individual_urls) - len(internal_urls)
                if removed > 0:
                    log.info(f"  Wix: 外部URL {removed}件除外 → {len(internal_urls)}件")
                individual_urls = internal_urls

        row["individual_count"] = len(individual_urls)

        if not individual_urls:
            # 個別URLなし → 一覧ページからsingle_page抽出を試みる
            if listing_html:
                log.info("  個別URLなし → 一覧ページからsingle_page抽出")
                therapists = haiku_extract_single_page(listing_html, name, listing_url_for_fallback)
                log.info(f"  single_page fallback (no URLs): {len(therapists)} 名抽出")
                therapist_count = 0
                for t_data in therapists:
                    t_data["source_url"] = listing_url_for_fallback
                    stats["total_input_tokens"] += t_data.pop("input_tokens", 0)
                    stats["total_output_tokens"] += t_data.pop("output_tokens", 0)
                    t_id = insert_therapist_new(cur, sid, t_data)
                    if t_id:
                        therapist_count += 1
                        log.info(f"    → {t_data['name']} (id={t_id})")
                    else:
                        log.info(f"    → {t_data['name']} (INSERT失敗/重複)")
                stats["therapists_inserted"] += therapist_count
                row["therapists_found"] = therapist_count
                if therapist_count > 0:
                    row["status"] = "OK"
                else:
                    row["status"] = "NO_URLS"
                    row["fail_reason"] = "no_valid_urls"
            else:
                row["status"] = "NO_URLS"
                row["fail_reason"] = "no_valid_urls"
            results.append(row)
            continue

        # --- アンカーリンク検出: 全URLが同一base URLのアンカーなら single_page ---
        anchor_urls = [u for u in individual_urls if "#" in urlparse(u).fragment or "#" in u]
        if anchor_urls and len(anchor_urls) == len(individual_urls):
            # base URLを取得（アンカー除去）
            base_url = individual_urls[0].split("#")[0]
            all_same_base = all(u.split("#")[0] == base_url for u in individual_urls)
            if all_same_base:
                log.info(f"  アンカーリンク検出 → {base_url} をsingle_page抽出")
                anchor_html = fetch_page(base_url)
                if anchor_html:
                    _cache.save("salon_list", f"{sid}_anchor", anchor_html)
                    therapists = haiku_extract_single_page(anchor_html, name, base_url)
                    log.info(f"  single_page (anchor): {len(therapists)} 名抽出")

                    therapist_count = 0
                    for t_data in therapists:
                        t_data["source_url"] = base_url
                        stats["total_input_tokens"] += t_data.pop("input_tokens", 0)
                        stats["total_output_tokens"] += t_data.pop("output_tokens", 0)
                        t_id = insert_therapist_new(cur, sid, t_data)
                        if t_id:
                            therapist_count += 1
                            log.info(f"    → {t_data['name']} (id={t_id})")
                        else:
                            log.info(f"    → {t_data['name']} (INSERT失敗/重複)")

                    stats["therapists_inserted"] += therapist_count
                    row["therapists_found"] = therapist_count
                    row["status"] = "OK" if therapist_count > 0 else "NO_DATA"
                    results.append(row)
                    conn.commit()
                    continue

        # --- source_url dedup: 既存セラピストのURLを除外 ---
        cur.execute(
            "SELECT source_url FROM therapists WHERE salon_id = %s AND source_url IS NOT NULL",
            (sid,))
        existing_urls = {r['source_url'] for r in cur.fetchall()}
        if existing_urls:
            before = len(individual_urls)
            individual_urls = [u for u in individual_urls if u not in existing_urls]
            log.info(f"  dedup: {len(existing_urls)}件既存 → {before}→{len(individual_urls)}件")

        if not individual_urls:
            row["status"] = "DEDUP_ALL_EXISTING"
            row["notes"] += " (全URLが既存)"
            results.append(row)
            conn.commit()
            continue

        # --- Stage 3: 個別ページ抽出 ---
        therapist_count = 0
        for t_url in individual_urls:
            log.info(f"    Stage 3: {t_url}")
            t_html = fetch_page_smart(t_url, label="Stage3: ")
            if not t_html:
                log.info(f"      fetch失敗")
                continue

            data = extract_therapist_info(
                t_html,
                salon_name=salon["salon_name"] or "",
                salon_display=name,
                url=t_url,
            )
            if data and data.get("name"):
                data["source_url"] = t_url
                stats["total_input_tokens"] += data.get("input_tokens", 0)
                stats["total_output_tokens"] += data.get("output_tokens", 0)

                t_id = insert_therapist_new(cur, sid, data)
                if t_id:
                    therapist_count += 1
                    log.info(f"      → {data['name']} (id={t_id})")
                else:
                    log.info(f"      → {data['name']} (INSERT失敗/重複)")
            else:
                log.info(f"      抽出失敗")

            time.sleep(0.5)  # rate limit

        # --- Stage 3 全件失敗 → 一覧ページからsingle_page fallback ---
        if therapist_count == 0 and listing_html:
            log.info("  Stage 3 全件失敗 → 一覧ページからsingle_page抽出")
            therapists = haiku_extract_single_page(listing_html, name, listing_url_for_fallback)
            log.info(f"  single_page fallback: {len(therapists)} 名抽出")
            for t_data in therapists:
                t_data["source_url"] = listing_url_for_fallback
                stats["total_input_tokens"] += t_data.pop("input_tokens", 0)
                stats["total_output_tokens"] += t_data.pop("output_tokens", 0)
                t_id = insert_therapist_new(cur, sid, t_data)
                if t_id:
                    therapist_count += 1
                    log.info(f"    → {t_data['name']} (id={t_id})")
                else:
                    log.info(f"    → {t_data['name']} (INSERT失敗/重複)")

        stats["therapists_inserted"] += therapist_count
        row["therapists_found"] = therapist_count
        row["status"] = "OK" if therapist_count > 0 else "NO_DATA"
        results.append(row)

        # バッチコミット
        conn.commit()

    # 最終コミット
    conn.commit()
    conn.close()

    # CSV出力
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "salon_id", "salon_name", "official_url", "page_type",
            "listing_url", "individual_count", "therapists_found",
            "status", "fail_reason", "notes",
        ])
        writer.writeheader()
        writer.writerows(results)

    # サマリー
    log.info(f"\n{'='*60}")
    log.info(f"テスト完了 ({len(salons)} サロン)")
    log.info(f"{'='*60}")
    log.info(f"  fetch失敗:       {stats['fetch_failed']}")
    log.info(f"  no_therapists:   {stats['no_therapists']}")
    log.info(f"  listing:         {stats['listing']}")
    log.info(f"  has_individuals: {stats['has_individuals']}")
    log.info(f"  single_page:     {stats['single_page']}")
    log.info(f"  age_gate:        {stats['age_gate']}")
    log.info(f"  セラピスト登録:  {stats['therapists_inserted']}")
    log.info(f"  入力トークン:    {stats['total_input_tokens']:,}")
    log.info(f"  出力トークン:    {stats['total_output_tokens']:,}")
    log.info(f"  CSV: {csv_path}")

    # Playwright ブラウザ解放
    if HAS_PLAYWRIGHT:
        cleanup_browser()


# =============================================================================
# Batch API パイプライン
# =============================================================================

def _get_client():
    import anthropic
    return anthropic.Anthropic()


def _stage_paths(stage: str) -> dict:
    return {
        "requests": os.path.join(DATA_DIR, f"{stage}_requests.jsonl"),
        "batch_id": os.path.join(DATA_DIR, f"{stage}_batch_id.txt"),
        "results": os.path.join(DATA_DIR, f"{stage}_results.json"),
        "metadata": os.path.join(DATA_DIR, f"{stage}_metadata.json"),
    }


def _iter_jsonl(path: str) -> list:
    requests = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                requests.append(json.loads(line))
    return requests


def _split_jsonl(path: str, max_mb: int = 200) -> list[str]:
    max_bytes = max_mb * 1024 * 1024
    chunks = []
    chunk_idx = 0
    current_size = 0
    current_f = None

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line_bytes = len(line.encode("utf-8"))
            if current_f is None or current_size + line_bytes > max_bytes:
                if current_f:
                    current_f.close()
                chunk_idx += 1
                chunk_path = path.replace(".jsonl", f"_part{chunk_idx}.jsonl")
                chunks.append(chunk_path)
                current_f = open(chunk_path, "w", encoding="utf-8")
                current_size = 0
            current_f.write(line)
            current_size += line_bytes

    if current_f:
        current_f.close()
    return chunks


# --- Stage 1: prepare ---

def cmd_stage1_prepare(args):
    """失敗サロンのTOPページをfetch → Stage 1 プロンプト → JSONL"""
    os.makedirs(DATA_DIR, exist_ok=True)

    salons = get_failed_salons(limit=args.limit)
    log.info(f"Stage 1 prepare: {len(salons)} サロン")

    written = 0
    fetch_failed = 0
    metadata = {}
    paths = _stage_paths("stage1")

    with open(paths["requests"], "w", encoding="utf-8") as f:
        for i, salon in enumerate(salons):
            sid = salon["salon_id"]
            name = salon["salon_display"] or salon["salon_name"] or ""
            url = salon["official_url"]

            # fetch (Playwright fallback for thin HTML)
            html = fetch_page_smart(url, label=f"[{i+1}] ")
            if not html:
                fetch_failed += 1
                continue

            _cache.save("salon_top", sid, html)

            prompt = build_stage1_prompt(html, name, url)
            custom_id = f"s1_{sid}"
            request = {
                "custom_id": custom_id,
                "params": {
                    "model": MODEL,
                    "max_tokens": 8000,
                    "messages": [{"role": "user", "content": prompt}],
                }
            }
            f.write(json.dumps(request, ensure_ascii=False) + "\n")
            metadata[custom_id] = {
                "salon_id": sid,
                "salon_name": name,
                "official_url": url,
            }
            written += 1

            if (i + 1) % 100 == 0:
                log.info(f"  {i+1}/{len(salons)} fetch済み (written={written}, failed={fetch_failed})")

            time.sleep(0.3)  # fetch間隔

    with open(paths["metadata"], "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False)

    file_mb = os.path.getsize(paths["requests"]) / 1024 / 1024 if written > 0 else 0
    log.info(f"\n{'='*60}")
    log.info(f"Stage 1 prepare 完了")
    log.info(f"  JSONL: {paths['requests']} ({file_mb:.1f}MB)")
    log.info(f"  リクエスト数: {written}")
    log.info(f"  fetch失敗: {fetch_failed}")
    log.info(f"{'='*60}")


# --- Stage 1: submit ---

def cmd_submit(stage: str):
    """JSONL を Batch API に投入"""
    paths = _stage_paths(stage)
    if not os.path.exists(paths["requests"]):
        log.error(f"{paths['requests']} が見つかりません。先に prepare を実行してください。")
        sys.exit(1)

    client = _get_client()
    file_mb = os.path.getsize(paths["requests"]) / 1024 / 1024

    if file_mb <= 200:
        chunks = [paths["requests"]]
    else:
        chunks = _split_jsonl(paths["requests"], 200)
        log.info(f"JSONL {file_mb:.0f}MB → {len(chunks)} 分割")

    batch_ids = []
    for i, chunk_path in enumerate(chunks):
        label = f"[{i+1}/{len(chunks)}] " if len(chunks) > 1 else ""
        log.info(f"{label}Batch API に投入中...")
        batch = client.messages.batches.create(
            requests=_iter_jsonl(chunk_path),
        )
        batch_ids.append(batch.id)
        log.info(f"{label}Batch ID: {batch.id} / Status: {batch.processing_status}")

    with open(paths["batch_id"], "w") as f:
        f.write("\n".join(batch_ids))

    log.info(f"\n{stage} submit 完了 ({len(batch_ids)} バッチ)")


# --- status ---

def cmd_status(stage: str, batch_id: str | None = None):
    """バッチ状態確認"""
    paths = _stage_paths(stage)
    if batch_id:
        batch_ids = [batch_id]
    elif os.path.exists(paths["batch_id"]):
        with open(paths["batch_id"]) as f:
            batch_ids = [line.strip() for line in f if line.strip()]
    else:
        log.error(f"{paths['batch_id']} が見つかりません。")
        sys.exit(1)

    client = _get_client()
    all_ended = True
    for bid in batch_ids:
        batch = client.messages.batches.retrieve(bid)
        counts = batch.request_counts
        log.info(f"Batch {bid}: {batch.processing_status}")
        log.info(f"  processing={counts.processing} succeeded={counts.succeeded} errored={counts.errored}")
        if batch.processing_status != "ended":
            all_ended = False

    if all_ended:
        log.info(f"\n全バッチ完了！ 次: python {__file__} {stage} process")
    else:
        log.info(f"\nまだ処理中...")


# --- Stage 1: process ---

def cmd_stage1_process(args):
    """Stage 1 結果をパース → stage1_results.json に保存"""
    paths = _stage_paths("stage1")

    if not os.path.exists(paths["metadata"]):
        log.error(f"{paths['metadata']} が見つかりません。")
        sys.exit(1)
    with open(paths["metadata"]) as f:
        metadata = json.load(f)

    batch_ids = []
    if args.batch_id:
        batch_ids = [args.batch_id]
    elif os.path.exists(paths["batch_id"]):
        with open(paths["batch_id"]) as f:
            batch_ids = [line.strip() for line in f if line.strip()]
    if not batch_ids:
        log.error("batch IDが見つかりません。")
        sys.exit(1)

    client = _get_client()
    results = {}
    stats = {"total": 0, "succeeded": 0, "api_error": 0, "parse_failed": 0}

    for bid in batch_ids:
        log.info(f"Batch {bid} の結果をダウンロード中...")
        for result in client.messages.batches.results(bid):
            stats["total"] += 1
            custom_id = result.custom_id
            meta = metadata.get(custom_id)
            if not meta:
                continue

            if result.result.type != "succeeded":
                stats["api_error"] += 1
                continue

            result_text = result.result.message.content[0].text if result.result.message.content else ""
            parsed = parse_stage1_response(result_text)
            if not parsed:
                stats["parse_failed"] += 1
                continue

            stats["succeeded"] += 1
            results[str(meta["salon_id"])] = {
                **meta,
                **parsed,
            }

    with open(paths["results"], "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # 分類集計
    type_counts = {}
    for r in results.values():
        pt = r.get("page_type", "unknown")
        type_counts[pt] = type_counts.get(pt, 0) + 1

    log.info(f"\n{'='*60}")
    log.info(f"Stage 1 process 完了")
    log.info(f"  合計:        {stats['total']}")
    log.info(f"  成功:        {stats['succeeded']}")
    log.info(f"  APIエラー:   {stats['api_error']}")
    log.info(f"  パース失敗:  {stats['parse_failed']}")
    for pt, cnt in sorted(type_counts.items()):
        log.info(f"    {pt}: {cnt}")
    log.info(f"  結果: {paths['results']}")
    log.info(f"{'='*60}")


# --- Stage 2: prepare ---

def cmd_stage2_prepare(args):
    """Stage 1 の listing 結果から一覧ページをfetch → Stage 2 JSONL"""
    os.makedirs(DATA_DIR, exist_ok=True)

    stage1_results_path = _stage_paths("stage1")["results"]
    if not os.path.exists(stage1_results_path):
        log.error(f"{stage1_results_path} が見つかりません。先に stage1 process を実行してください。")
        sys.exit(1)

    with open(stage1_results_path) as f:
        stage1_results = json.load(f)

    # listing型 + age_gate のredirect先をStage 2 対象にする
    targets = []
    for sid, data in stage1_results.items():
        pt = data.get("page_type")
        if pt == "listing" and data.get("listing_url"):
            targets.append({
                "salon_id": int(sid),
                "salon_name": data.get("salon_name", ""),
                "url": data["listing_url"],
            })
        elif pt == "age_gate" and data.get("redirect_url"):
            targets.append({
                "salon_id": int(sid),
                "salon_name": data.get("salon_name", ""),
                "url": data["redirect_url"],
            })

    if args.limit:
        targets = targets[:args.limit]

    log.info(f"Stage 2 prepare: {len(targets)} サロン（listing + age_gate redirect）")

    written = 0
    fetch_failed = 0
    metadata = {}
    paths = _stage_paths("stage2")

    with open(paths["requests"], "w", encoding="utf-8") as f:
        for i, target in enumerate(targets):
            sid = target["salon_id"]
            name = target["salon_name"]
            url = target["url"]

            html = fetch_page_smart(url, label=f"[{i+1}] ")
            if not html:
                fetch_failed += 1
                continue

            _cache.save("salon_list", sid, html)

            prompt = build_stage1_prompt(html, name, url)
            custom_id = f"s2_{sid}"
            request = {
                "custom_id": custom_id,
                "params": {
                    "model": MODEL,
                    "max_tokens": 8000,
                    "messages": [{"role": "user", "content": prompt}],
                }
            }
            f.write(json.dumps(request, ensure_ascii=False) + "\n")
            metadata[custom_id] = {
                "salon_id": sid,
                "salon_name": name,
                "url": url,
            }
            written += 1

            if (i + 1) % 100 == 0:
                log.info(f"  {i+1}/{len(targets)} fetch済み")

            time.sleep(0.3)

    with open(paths["metadata"], "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False)

    file_mb = os.path.getsize(paths["requests"]) / 1024 / 1024 if written > 0 else 0
    log.info(f"\nStage 2 prepare 完了: {written} リクエスト, fetch失敗 {fetch_failed}")


# --- Stage 2: process ---

def cmd_stage2_process(args):
    """Stage 2 結果をパース → stage2_results.json に保存"""
    paths = _stage_paths("stage2")

    if not os.path.exists(paths["metadata"]):
        log.error(f"{paths['metadata']} が見つかりません。")
        sys.exit(1)
    with open(paths["metadata"]) as f:
        metadata = json.load(f)

    batch_ids = []
    if args.batch_id:
        batch_ids = [args.batch_id]
    elif os.path.exists(paths["batch_id"]):
        with open(paths["batch_id"]) as f:
            batch_ids = [line.strip() for line in f if line.strip()]
    if not batch_ids:
        log.error("batch IDが見つかりません。")
        sys.exit(1)

    client = _get_client()
    results = {}
    stats = {"total": 0, "succeeded": 0, "api_error": 0, "parse_failed": 0}

    for bid in batch_ids:
        for result in client.messages.batches.results(bid):
            stats["total"] += 1
            custom_id = result.custom_id
            meta = metadata.get(custom_id)
            if not meta:
                continue

            if result.result.type != "succeeded":
                stats["api_error"] += 1
                continue

            result_text = result.result.message.content[0].text if result.result.message.content else ""
            parsed = parse_stage1_response(result_text)
            if not parsed:
                stats["parse_failed"] += 1
                continue

            stats["succeeded"] += 1
            results[str(meta["salon_id"])] = {
                **meta,
                **parsed,
            }

    with open(paths["results"], "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    log.info(f"\nStage 2 process 完了: {stats['succeeded']}/{stats['total']} 成功")


# --- Stage 3: prepare ---

def cmd_stage3_prepare(args):
    """Stage 1+2 の individual_urls を集約 → 個別ページ fetch → Stage 3 JSONL"""
    os.makedirs(DATA_DIR, exist_ok=True)

    # Stage 1 + Stage 2 の結果を統合して individual_urls を集める
    stage1_path = _stage_paths("stage1")["results"]
    stage2_path = _stage_paths("stage2")["results"]

    if not os.path.exists(stage1_path):
        log.error(f"{stage1_path} が見つかりません。")
        sys.exit(1)

    with open(stage1_path) as f:
        stage1_results = json.load(f)

    stage2_results = {}
    if os.path.exists(stage2_path):
        with open(stage2_path) as f:
            stage2_results = json.load(f)

    # salon_id → individual_urls のマッピング
    salon_urls = {}  # {salon_id: {"salon_name": ..., "urls": [...]}}

    for sid, data in stage1_results.items():
        pt = data.get("page_type")
        name = data.get("salon_name", "")
        salon_name_raw = data.get("salon_name", "")

        if pt == "has_individuals" and data.get("individual_urls"):
            salon_urls[sid] = {
                "salon_name": salon_name_raw,
                "salon_display": name,
                "urls": data["individual_urls"],
            }

    # Stage 2 で見つかった individual_urls を追加
    for sid, data in stage2_results.items():
        if data.get("individual_urls"):
            if sid in salon_urls:
                # 既存に追加（重複除去）
                existing = set(salon_urls[sid]["urls"])
                for u in data["individual_urls"]:
                    if u not in existing:
                        salon_urls[sid]["urls"].append(u)
            else:
                salon_urls[sid] = {
                    "salon_name": data.get("salon_name", ""),
                    "salon_display": data.get("salon_name", ""),
                    "urls": data["individual_urls"],
                }

    total_urls = sum(len(v["urls"]) for v in salon_urls.values())
    log.info(f"Stage 3 prepare: {len(salon_urls)} サロン, {total_urls} 個別URL")

    # source_url dedup 用DB接続
    dedup_conn = psycopg2.connect(DB_DSN)
    dedup_cur = dedup_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    written = 0
    fetch_failed = 0
    dedup_skipped = 0
    metadata = {}
    paths = _stage_paths("stage3")

    url_count = 0
    with open(paths["requests"], "w", encoding="utf-8") as f:
        for sid, info in salon_urls.items():
            salon_name = info["salon_name"]
            salon_display = info["salon_display"]
            urls = info["urls"]

            # source_url dedup: 既存セラピストのURLを除外
            dedup_cur.execute(
                "SELECT source_url FROM therapists WHERE salon_id = %s AND source_url IS NOT NULL",
                (int(sid),))
            existing_urls = {r['source_url'] for r in dedup_cur.fetchall()}
            if existing_urls:
                before = len(urls)
                urls = [u for u in urls if u not in existing_urls]
                if before != len(urls):
                    dedup_skipped += before - len(urls)
                    log.info(f"  salon {sid}: dedup {before}→{len(urls)} URLs")

            for t_url in urls:
                url_count += 1
                if args.limit and url_count > args.limit:
                    break

                html = fetch_page(t_url)
                if not html:
                    fetch_failed += 1
                    continue

                prompt = build_extract_prompt(
                    html, salon_name=salon_name,
                    salon_display=salon_display, url=t_url
                )
                custom_id = f"s3_{sid}_{written}"
                request = {
                    "custom_id": custom_id,
                    "params": {
                        "model": MODEL,
                        "max_tokens": 800,
                        "messages": [{"role": "user", "content": prompt}],
                    }
                }
                f.write(json.dumps(request, ensure_ascii=False) + "\n")
                metadata[custom_id] = {
                    "salon_id": int(sid),
                    "salon_name": salon_name,
                    "source_url": t_url,
                }
                written += 1

                if written % 500 == 0:
                    log.info(f"  {written} 件準備済み (fetch失敗 {fetch_failed})")

                time.sleep(0.3)

            if args.limit and url_count > args.limit:
                break

    with open(paths["metadata"], "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False)

    dedup_conn.close()

    file_mb = os.path.getsize(paths["requests"]) / 1024 / 1024 if written > 0 else 0
    log.info(f"\nStage 3 prepare 完了: {written} リクエスト ({file_mb:.1f}MB), fetch失敗 {fetch_failed}, dedup除外 {dedup_skipped}")


# --- Stage 3: process ---

def cmd_stage3_process(args):
    """Stage 3 結果をパース → therapists INSERT"""
    paths = _stage_paths("stage3")

    if not os.path.exists(paths["metadata"]):
        log.error(f"{paths['metadata']} が見つかりません。")
        sys.exit(1)
    with open(paths["metadata"]) as f:
        metadata = json.load(f)

    batch_ids = []
    if args.batch_id:
        batch_ids = [args.batch_id]
    elif os.path.exists(paths["batch_id"]):
        with open(paths["batch_id"]) as f:
            batch_ids = [line.strip() for line in f if line.strip()]
    if not batch_ids:
        log.error("batch IDが見つかりません。")
        sys.exit(1)

    client = _get_client()
    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    stats = {
        "total": 0, "inserted": 0, "no_name": 0,
        "parse_failed": 0, "api_error": 0, "db_error": 0,
    }

    for bid in batch_ids:
        log.info(f"Batch {bid} の結果を処理中...")
        for result in client.messages.batches.results(bid):
            stats["total"] += 1
            custom_id = result.custom_id
            meta = metadata.get(custom_id)
            if not meta:
                continue

            sid = meta["salon_id"]

            if result.result.type != "succeeded":
                stats["api_error"] += 1
                continue

            result_text = result.result.message.content[0].text if result.result.message.content else ""
            data = parse_extract_response(
                result_text,
                salon_name=meta.get("salon_name", ""),
                url=meta.get("source_url", ""),
            )

            if not data or not data.get("name"):
                stats["no_name" if data else "parse_failed"] += 1
                continue

            data["source_url"] = meta.get("source_url")

            if not args.dry_run:
                t_id = insert_therapist_new(cur, sid, data)
                if t_id:
                    stats["inserted"] += 1
                else:
                    stats["db_error"] += 1
            else:
                stats["inserted"] += 1

            if stats["total"] % 1000 == 0:
                if not args.dry_run:
                    conn.commit()
                log.info(
                    f"  [{stats['total']}] inserted={stats['inserted']} "
                    f"no_name={stats['no_name']} parse_fail={stats['parse_failed']}"
                )

    if not args.dry_run:
        conn.commit()
    conn.close()

    log.info(f"\n{'='*60}")
    log.info(f"Stage 3 process 完了")
    log.info(f"  合計:        {stats['total']}")
    log.info(f"  INSERT成功:  {stats['inserted']}")
    log.info(f"  名前なし:    {stats['no_name']}")
    log.info(f"  パース失敗:  {stats['parse_failed']}")
    log.info(f"  APIエラー:   {stats['api_error']}")
    log.info(f"  DBエラー:    {stats['db_error']}")
    log.info(f"{'='*60}")


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="失敗サロン Haiku適応型スクレイピングパイプライン")

    parser.add_argument("--test", type=int, metavar="N",
                        help="N件テスト（直接API呼び出し、CSV出力）")
    parser.add_argument("--retest", action="store_true",
                        help="前回のCSV結果と同じサロンを再テスト（CSV→デスクトップ出力）")
    parser.add_argument("stage", nargs="?",
                        choices=["stage1", "stage2", "stage3"],
                        help="Batch APIステージ")
    parser.add_argument("action", nargs="?",
                        choices=["prepare", "submit", "status", "process"],
                        help="Batch APIアクション")
    parser.add_argument("--limit", type=int, help="処理件数上限")
    parser.add_argument("--dry-run", action="store_true", help="DB書き込みなし")
    parser.add_argument("--batch-id", type=str, help="特定のバッチIDを指定")

    args = parser.parse_args()

    if args.retest:
        # 前回CSVからsalon_idsを読み取り、同じサロンを再テスト
        prev_csv = os.path.join(SCRIPT_DIR, "failed_salons_test_result.csv")
        if not os.path.exists(prev_csv):
            log.error(f"前回の結果CSVが見つかりません: {prev_csv}")
            sys.exit(1)
        salon_ids = []
        with open(prev_csv, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                salon_ids.append(int(row['salon_id']))
        salons = get_salons_by_ids(salon_ids)
        desktop_csv = os.path.expanduser("~/Desktop/failed_salons_retest_v4_result.csv")
        run_test(salons, csv_path=desktop_csv)
        return

    if args.test:
        salons = get_failed_salons(limit=args.test)
        run_test(salons)
        return

    if not args.stage or not args.action:
        parser.print_help()
        sys.exit(1)

    stage = args.stage
    action = args.action

    if action == "submit":
        cmd_submit(stage)
    elif action == "status":
        cmd_status(stage, args.batch_id)
    elif stage == "stage1" and action == "prepare":
        cmd_stage1_prepare(args)
    elif stage == "stage1" and action == "process":
        cmd_stage1_process(args)
    elif stage == "stage2" and action == "prepare":
        cmd_stage2_prepare(args)
    elif stage == "stage2" and action == "process":
        cmd_stage2_process(args)
    elif stage == "stage3" and action == "prepare":
        cmd_stage3_prepare(args)
    elif stage == "stage3" and action == "process":
        cmd_stage3_process(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
