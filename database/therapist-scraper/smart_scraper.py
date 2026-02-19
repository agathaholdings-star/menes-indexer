#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smart Scraper: 自己学習型セラピストスクレイパー
キャッシュ・CMS指紋判定・ルールベース抽出・LLMフォールバック・自動学習

使い方:
    scraper = SmartScraper(db_conn=conn)
    therapists = scraper.scrape_salon(salon_id, salon_url, salon_name, max_therapists=0)
"""

import hashlib
import json
import logging
import re
import time

import requests
import psycopg2.extras
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

from therapist_scraper import TherapistScraper, REQUEST_DELAY
from fetch_utils import fetch_page, HEADERS
from html_cache_utils import HtmlCache
from cms_fingerprinter import CMSFingerprinter
from rule_extractor import RuleExtractor
from pattern_validator import PatternValidator
from rule_miner import RuleMiner

log = logging.getLogger(__name__)


class SmartScraper:
    """自己学習型セラピストスクレイパー"""

    def __init__(self, db_conn=None):
        """
        Args:
            db_conn: psycopg2 connection（ローカルSupabase）
        """
        self.db_conn = db_conn
        self._cache = HtmlCache()
        self.llm_scraper = TherapistScraper()
        self.rule_extractor = RuleExtractor()
        self.validator = PatternValidator()
        self.rule_miner = RuleMiner()

        # DB上のCMSパターンをロード
        self.cms_patterns = []
        self.fingerprinter = CMSFingerprinter()
        if db_conn:
            self._load_cms_patterns()

        # 統計
        self.stats = {
            'rule_success': 0,
            'llm_fallback': 0,
            'new_patterns': 0,
            'cache_hits': 0,
            'errors': 0,
        }

    def _load_cms_patterns(self):
        """DBからCMSパターンをロード"""
        try:
            cur = self.db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("""
                SELECT id, cms_name, fingerprint, list_url_rules,
                       therapist_list_rules, therapist_data_rules,
                       ajax_pagination, list_data_rules,
                       confidence, success_count, fail_count
                FROM cms_patterns
            """)
            self.cms_patterns = [dict(row) for row in cur.fetchall()]
            self.fingerprinter = CMSFingerprinter(self.cms_patterns)
            cur.close()
            log.info(f"CMSパターン {len(self.cms_patterns)}件をロード")
        except Exception as e:
            log.warning(f"CMSパターンロード失敗: {e}")

    def _get_cache(self, salon_id):
        """salon_scrape_cacheからキャッシュ取得"""
        if not self.db_conn:
            return None
        try:
            cur = self.db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("""
                SELECT salon_id, cms_pattern_id, therapist_list_url,
                       extraction_method, last_therapist_count, fail_streak
                FROM salon_scrape_cache
                WHERE salon_id = %s AND fail_streak < 3
            """, (salon_id,))
            row = cur.fetchone()
            cur.close()
            return dict(row) if row else None
        except Exception:
            return None

    def _update_cache(self, salon_id, cms_pattern_id, list_url, method, therapist_count, success):
        """salon_scrape_cacheを更新"""
        if not self.db_conn:
            return
        try:
            cur = self.db_conn.cursor()
            if success:
                cur.execute("""
                    INSERT INTO salon_scrape_cache
                        (salon_id, cms_pattern_id, therapist_list_url,
                         extraction_method, last_therapist_count, fail_streak, last_scraped_at)
                    VALUES (%s, %s, %s, %s, %s, 0, now())
                    ON CONFLICT (salon_id) DO UPDATE SET
                        cms_pattern_id = EXCLUDED.cms_pattern_id,
                        therapist_list_url = EXCLUDED.therapist_list_url,
                        extraction_method = EXCLUDED.extraction_method,
                        last_therapist_count = EXCLUDED.last_therapist_count,
                        fail_streak = 0,
                        last_scraped_at = now()
                """, (salon_id, cms_pattern_id, list_url, method, therapist_count))
            else:
                cur.execute("""
                    INSERT INTO salon_scrape_cache
                        (salon_id, cms_pattern_id, therapist_list_url,
                         extraction_method, last_therapist_count, fail_streak, last_scraped_at)
                    VALUES (%s, %s, %s, %s, 0, 1, now())
                    ON CONFLICT (salon_id) DO UPDATE SET
                        fail_streak = salon_scrape_cache.fail_streak + 1,
                        last_scraped_at = now()
                """, (salon_id, cms_pattern_id, list_url, method))
            cur.close()
        except Exception as e:
            log.warning(f"キャッシュ更新失敗: {e}")

    def _log_scrape(self, salon_id, step, method, success, html=None, detail=None):
        """scrape_logにログ書き込み"""
        if not self.db_conn:
            return
        try:
            html_hash = hashlib.sha256(html.encode()).hexdigest()[:16] if html else None
            cur = self.db_conn.cursor()
            cur.execute("""
                INSERT INTO scrape_log (salon_id, step, method, success, html_hash, detail)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (salon_id, step, method, success, html_hash, detail))
            cur.close()
        except Exception as e:
            log.warning(f"ログ書き込み失敗: {e}")

    def _update_cms_confidence(self, pattern_id, success):
        """CMS パターンの信頼度を更新"""
        if not self.db_conn or not pattern_id:
            return
        try:
            cur = self.db_conn.cursor()
            if success:
                cur.execute("""
                    UPDATE cms_patterns
                    SET success_count = success_count + 1,
                        confidence = (success_count + 1)::float
                            / (success_count + 1 + fail_count * 2)
                    WHERE id = %s
                """, (pattern_id,))
            else:
                cur.execute("""
                    UPDATE cms_patterns
                    SET fail_count = fail_count + 1,
                        confidence = success_count::float
                            / (success_count + (fail_count + 1) * 2)
                    WHERE id = %s
                """, (pattern_id,))
            cur.close()
        except Exception as e:
            log.warning(f"信頼度更新失敗: {e}")

    def _get_pattern_by_id(self, pattern_id):
        """IDでCMSパターンを取得"""
        for p in self.cms_patterns:
            if p['id'] == pattern_id:
                return p
        return None

    # =========================================================================
    # ヒューリスティック抽出メソッド（LLM不要）
    # =========================================================================

    def _find_list_url_heuristic(self, html, base_url):
        """
        LLM不要のヒューリスティックでセラピスト一覧URLを特定

        1. リンクテキストにキーワード含む
        2. URL自体にキーワード含む
        3. よくあるパスをHTTPプローブ（HEAD）

        Returns:
            (url, detail_reason) or (None, None)
        """
        soup = BeautifulSoup(html, 'html.parser')
        domain = urlparse(base_url).netloc

        # パターン1: リンクテキストにキーワード含む
        text_keywords = ['セラピスト', 'キャスト', 'スタッフ', '在籍', 'ガール',
                         'セラピスト一覧', 'キャスト一覧', 'スタッフ紹介',
                         'THERAPIST', 'CAST', 'STAFF']
        for a in soup.find_all('a', href=True):
            text = a.get_text(strip=True)
            href = a['href']
            # fragment-only links (#staff) are handled separately
            if href.startswith('#'):
                continue
            if any(kw.lower() in text.lower() for kw in text_keywords):
                url = urljoin(base_url, href)
                if urlparse(url).netloc == domain:
                    return url, f'text_keyword: {text[:30]}'

        # パターン2: URL自体にキーワード含む
        url_keywords = ['/cast', '/staff', '/therapist', '/girl',
                        'staff.html', 'cast.html', 'therapist.html',
                        '/item_list', '/member']
        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.startswith('#'):
                continue
            href_lower = href.lower()
            for kw in url_keywords:
                if kw in href_lower:
                    url = urljoin(base_url, href)
                    if urlparse(url).netloc == domain:
                        return url, f'url_keyword: {kw}'

        # パターン3: よくあるパスをHTTPプローブ
        common_paths = ['/cast/', '/staff/', '/therapist/', '/girl/',
                        '/cast', '/staff', '/therapist']
        for path in common_paths:
            url = urljoin(base_url, path)
            try:
                resp = requests.head(url, headers=HEADERS, timeout=5,
                                     allow_redirects=True)
                if resp.status_code == 200:
                    # Redirect先が別ドメインでないか確認
                    final_domain = urlparse(resp.url).netloc
                    if final_domain == domain:
                        return resp.url, f'http_probe: {path}'
            except Exception:
                pass

        return None, None

    def _detect_anchor_list(self, html, base_url):
        """
        アンカーリンク(#staff, #cast等)でセラピスト一覧がトップページ内にある場合を検出

        Returns:
            anchor_id or None
        """
        soup = BeautifulSoup(html, 'html.parser')
        anchor_keywords = ['staff', 'cast', 'therapist', 'girl', 'member']

        for a in soup.find_all('a', href=True):
            href = a['href']
            if not href.startswith('#'):
                continue
            anchor_id = href[1:]
            if any(kw in anchor_id.lower() for kw in anchor_keywords):
                # アンカー先が実際にHTMLに存在するか確認
                target = soup.find(id=anchor_id) or soup.find(attrs={'name': anchor_id})
                if target:
                    return anchor_id

        return None

    def _extract_therapist_urls_heuristic(self, html, list_url):
        """
        URLパターンでセラピスト個別URLを抽出（LLM不要）

        一覧ページのリンクから、URLパターンだけでセラピスト個別URLを特定。

        Returns:
            [{"name": "...", "url": "...", "list_image_url": None}, ...]
        """
        soup = BeautifulSoup(html, 'html.parser')
        domain = urlparse(list_url).netloc
        list_path = urlparse(list_url).path.rstrip('/')

        # セラピスト個別URLパターン
        profile_patterns = [
            r'/cast/[^/]+/?$',
            r'/staff/[^/]+/?$',
            r'/therapist/[^/]+/?$',
            r'/girl/[^/]+/?$',
            r'/profile[/?]',
            r'/item_\d+',
            r'/item/\d+',
            r'/member/[^/]+/?$',
            r'/detail/[^/]+/?$',
        ]

        candidates = []
        seen = set()

        for a in soup.find_all('a', href=True):
            url = urljoin(list_url, a['href'])
            parsed = urlparse(url)
            if parsed.netloc != domain or url in seen:
                continue
            seen.add(url)

            path = parsed.path.rstrip('/')

            # 一覧ページ自身は除外
            if path == list_path:
                continue

            # ページネーションは除外
            if re.search(r'[?&]page=\d+|/page/\d+|[?&]p=\d+', url):
                continue

            # プロフィールURLパターンにマッチするか
            if any(re.search(p, path) for p in profile_patterns):
                name = a.get_text(strip=True) or ''
                # 画像取得を試みる（リンク内のimg）
                img = a.find('img')
                img_url = None
                if img:
                    src = (img.get('src') or img.get('data-src')
                           or img.get('data-lazy-src') or '')
                    if src:
                        img_url = urljoin(list_url, src)
                candidates.append({
                    'name': name,
                    'url': url,
                    'list_image_url': img_url,
                })

        # フォールバック1: flat .html構造（staff.htmlから/名前.htmlへのリンク）
        if not candidates and list_path.endswith('.html'):
            nav_pages = {
                'index', 'staff', 'therapist', 'cast', 'system', 'access',
                'recruit', 'interior', 'guide', 'info', 'coupon', 'service',
                'map', 'contact', 'reserve', 'schedule', 'news', 'blog',
                'price', 'menu', 'top', 'home', 'about', 'concept', 'hotel',
                'faq', 'link', 'sitemap', 'privacy', 'terms',
            }
            seen_fb1 = set()
            for a in soup.find_all('a', href=True):
                url = urljoin(list_url, a['href'])
                parsed = urlparse(url)
                if parsed.netloc != domain or url in seen_fb1:
                    continue
                seen_fb1.add(url)
                path = parsed.path.rstrip('/')
                # ルート直下の .html ファイルのみ（/xxx.html）
                m = re.match(r'^/([^/]+)\.html?$', path)
                if not m:
                    continue
                stem = m.group(1).lower()
                if stem in nav_pages:
                    continue
                # 数字だけのファイル名も除外（ページネーション等）
                if stem.isdigit():
                    continue
                name = a.get_text(strip=True) or ''
                img = a.find('img')
                img_url = None
                if img:
                    src = (img.get('src') or img.get('data-src') or '')
                    if src:
                        img_url = urljoin(list_url, src)
                candidates.append({
                    'name': name,
                    'url': url,
                    'list_image_url': img_url,
                })

        # フォールバック2: 共通サブパスパターン検出（/staff/ → /prof/profXX/等）
        if not candidates and list_path:
            # 一覧ページ以外の内部リンクを全収集
            all_links = []
            for a in soup.find_all('a', href=True):
                url = urljoin(list_url, a['href'])
                parsed = urlparse(url)
                if parsed.netloc != domain:
                    continue
                path = parsed.path.rstrip('/')
                if path and path != list_path:
                    all_links.append((path, a))

            # パスの先頭ディレクトリでグループ化、最多グループを候補とする
            from collections import Counter
            dir_counts = Counter()
            dir_links = {}
            nav_dirs = {'/news', '/blog', '/schedule', '/access', '/price',
                        '/menu', '/contact', '/reserve', '/hotel', '/recruit',
                        '/system', '/concept', '/about', '/faq'}
            for path, a in all_links:
                parts = path.split('/')
                if len(parts) >= 3:  # /dir/something 以上
                    dir_key = '/' + parts[1]
                    if dir_key.lower() not in nav_dirs and dir_key != list_path.split('/')[1:2]:
                        dir_counts[dir_key] += 1
                        if dir_key not in dir_links:
                            dir_links[dir_key] = []
                        dir_links[dir_key].append((path, a))

            # 3件以上あるグループで、一覧パスと異なるものを候補とする
            if dir_counts:
                top_dir, top_count = dir_counts.most_common(1)[0]
                list_dir = '/' + list_path.strip('/').split('/')[0] if list_path.strip('/') else ''
                if top_count >= 3 and top_dir != list_dir:
                    seen_paths = set()
                    for path, a in dir_links[top_dir]:
                        url = urljoin(list_url, path)
                        if path in seen_paths:
                            continue
                        seen_paths.add(path)
                        name = a.get_text(strip=True) or ''
                        img = a.find('img')
                        img_url = None
                        if img:
                            src = (img.get('src') or img.get('data-src') or '')
                            if src:
                                img_url = urljoin(list_url, src)
                        candidates.append({
                            'name': name,
                            'url': url,
                            'list_image_url': img_url,
                        })

        # フォールバック3: 一覧URLの直下サブパス
        if not candidates and list_path:
            for a in soup.find_all('a', href=True):
                url = urljoin(list_url, a['href'])
                parsed = urlparse(url)
                if parsed.netloc != domain or url in seen:
                    continue
                seen.add(url)

                path = parsed.path.rstrip('/')
                if path == list_path:
                    continue

                # 一覧URLの直下のサブパスのみ
                if path.startswith(list_path + '/') and path.count('/') == list_path.count('/') + 1:
                    # ブログ・ニュース等を除外
                    exclude = ['/blog', '/news', '/schedule', '/access',
                               '/price', '/menu', '/contact', '/reserve']
                    if any(excl in path.lower() for excl in exclude):
                        continue

                    name = a.get_text(strip=True) or ''
                    img = a.find('img')
                    img_url = None
                    if img:
                        src = (img.get('src') or img.get('data-src') or '')
                        if src:
                            img_url = urljoin(list_url, src)
                    candidates.append({
                        'name': name,
                        'url': url,
                        'list_image_url': img_url,
                    })

        return candidates

    def _extract_data_from_list_cards(self, html, list_url, entries):
        """
        一覧ページのカードHTMLからセラピストデータを抽出（LLM不要）

        個別ページに飛ぶ前に、一覧ページのカード情報からデータを直接取得する。
        成功した場合、entriesにデータをマージして返す。

        Returns:
            [therapist_data_dict, ...] — 抽出成功分のみ
        """
        soup = BeautifulSoup(html, 'html.parser')
        results = []

        for entry in entries:
            entry_path = urlparse(entry['url']).path
            # このURLに対応するリンク要素を探す
            a_tag = None
            for a in soup.find_all('a', href=True):
                href = urljoin(list_url, a['href'])
                if href.rstrip('/') == entry['url'].rstrip('/'):
                    a_tag = a
                    break

            if not a_tag:
                continue

            # カード = リンクの親要素を辿って意味のある範囲を見つける
            card = a_tag.parent
            # 親が body/html なら小さすぎ → スキップ
            if card and card.name in ('body', 'html', '[document]'):
                continue

            # 更に親を試す（li > a パターンなど）
            if card and card.name == 'a':
                card = card.parent

            if not card:
                continue

            text = card.get_text(' ', strip=True)

            data = {
                'name': entry.get('name', ''),
                'source_url': entry['url'],
                'image_urls': [entry['list_image_url']] if entry.get('list_image_url') else None,
            }

            # 正規表現でデータ抽出
            age_m = re.search(r'(\d{2})歳|AGE\s*(\d{2})', text, re.IGNORECASE)
            if age_m:
                data['age'] = int(age_m.group(1) or age_m.group(2))

            height_m = re.search(r'T(\d{3})|(\d{3})\s*cm|身長\s*(\d{3})', text)
            if height_m:
                data['height'] = int(height_m.group(1) or height_m.group(2) or height_m.group(3))

            bwh_m = re.search(r'B[:\s]*(\d{2,3})[^\d]*W[:\s]*(\d{2,3})[^\d]*H[:\s]*(\d{2,3})', text)
            if bwh_m:
                data['bust'] = int(bwh_m.group(1))
                data['waist'] = int(bwh_m.group(2))
                data['hip'] = int(bwh_m.group(3))

            # 画像取得（カード内のimg）
            if not data.get('image_urls'):
                imgs = card.find_all('img')
                for img in imgs:
                    src = (img.get('src') or img.get('data-src')
                           or img.get('data-lazy-src') or '')
                    if src and 'logo' not in src.lower() and 'icon' not in src.lower():
                        data['image_urls'] = [urljoin(list_url, src)]
                        break

            # バリデーション: nameが必須
            if data.get('name') and self.validator.validate_therapist(data):
                results.append(data)

        return results

    def scrape_salon(self, salon_id, salon_url, salon_name="", max_therapists=0):
        """
        サロン1件分のセラピストデータを取得（Smart版）

        フロー:
        1. キャッシュ確認（一覧URL・CMSパターン）
        2. CMS指紋判定
        3. ルールベース抽出を試行
        4. 失敗 → LLMフォールバック
        5. LLM成功 → パターン自動学習
        6. キャッシュ・ログ更新

        Args:
            salon_id: salons.id
            salon_url: 公式URL
            salon_name: 表示名
            max_therapists: 最大取得人数（0=無制限）

        Returns:
            [therapist_data_dict, ...]
        """
        print(f"\n{'='*60}")
        print(f" {salon_name or salon_url}")
        print(f"{'='*60}")

        # === Step 1: トップページ取得 ===
        print(f"  [1/3] トップページ取得...")
        html = fetch_page(salon_url)
        if not html:
            self._log_scrape(salon_id, 'fetch_top', 'http', False, detail='fetch failed')
            self.stats['errors'] += 1
            return []

        self._cache.save("salon", salon_id, html)

        # === キャッシュ確認 ===
        cache = self._get_cache(salon_id)
        cached_list_url = cache['therapist_list_url'] if cache else None
        cached_pattern_id = cache['cms_pattern_id'] if cache else None

        # === CMS指紋判定 ===
        cms_name, cms_confidence, pattern_id = self.fingerprinter.identify(html, salon_url)
        if not pattern_id and cached_pattern_id:
            pattern_id = cached_pattern_id
            pattern = self._get_pattern_by_id(pattern_id)
            if pattern:
                cms_name = pattern['cms_name']
                cms_confidence = pattern.get('confidence', 0.0)

        pattern = self._get_pattern_by_id(pattern_id) if pattern_id else None

        if cms_name:
            print(f"  CMS判定: {cms_name} (confidence={cms_confidence:.2f})")

        # === Step 2: セラピスト一覧ページを発見 ===
        list_url = None
        list_html = None
        step2_method = 'cache'
        is_anchor_list = False  # トップページ内アンカーの場合True

        # 1. キャッシュ済み一覧URLを優先
        if cached_list_url:
            print(f"  [2/3] 一覧URL（キャッシュ）: {cached_list_url}")
            list_url = cached_list_url
            self.stats['cache_hits'] += 1

        # 2. CMSルールベースで一覧URLを探す
        if not list_url and pattern and cms_confidence >= 0.4:
            list_url = self.rule_extractor.find_list_url(
                html, salon_url, pattern.get('list_url_rules', {}))
            if list_url:
                step2_method = 'rule'
                print(f"  [2/3] 一覧URL（ルール）: {list_url}")

        # 3. ヒューリスティック（LLM不要）
        if not list_url:
            heuristic_url, heuristic_detail = self._find_list_url_heuristic(html, salon_url)
            if heuristic_url:
                list_url = heuristic_url
                step2_method = 'heuristic'
                print(f"  [2/3] 一覧URL（ヒューリスティック）: {list_url}")
                self._log_scrape(salon_id, 'find_list_url', 'heuristic', True,
                                 detail=heuristic_detail)

        # 4. アンカーリンク検出（#staff等 → トップページ内に一覧がある場合）
        if not list_url:
            anchor_id = self._detect_anchor_list(html, salon_url)
            if anchor_id:
                list_url = salon_url
                is_anchor_list = True
                step2_method = 'heuristic'
                print(f"  [2/3] 一覧URL（アンカー #{anchor_id}）: トップページ内")

        # 5. LLMフォールバック
        if not list_url:
            step2_method = 'llm'
            print(f"  [2/3] 一覧ページを探索（LLM）...")
            list_url = self.llm_scraper.find_therapist_list_url(salon_url, html)

        if not list_url:
            print(f"  x 一覧ページが見つかりません")
            self._log_scrape(salon_id, 'find_list_url', step2_method, False, html,
                             detail='no_match')
            self._update_cache(salon_id, pattern_id, None, step2_method, 0, False)
            self.stats['errors'] += 1
            return []

        if step2_method != 'heuristic':
            self._log_scrape(salon_id, 'find_list_url', step2_method, True, html)
        print(f"  -> {list_url}")

        # 一覧ページ取得
        if is_anchor_list:
            # アンカーリンクの場合はトップページHTMLをそのまま使用
            list_html = html
        elif list_url.rstrip('/') != salon_url.rstrip('/'):
            time.sleep(REQUEST_DELAY)
            list_html = fetch_page(list_url)
            if not list_html:
                self._log_scrape(salon_id, 'fetch_list', 'http', False,
                                 detail=f'fetch failed: {list_url}')
                self._update_cache(salon_id, pattern_id, list_url, step2_method, 0, False)
                self.stats['errors'] += 1
                return []
            self._cache.save("salon_list", salon_id, list_html)
        else:
            list_html = html

        # === AJAX高速パス: 一覧カードから直接データ抽出 ===
        ajax_rules = pattern.get('ajax_pagination') if pattern else None
        list_data_rules = pattern.get('list_data_rules') if pattern else None

        if ajax_rules and list_data_rules and cms_confidence >= 0.4:
            therapists = self._extract_via_ajax_list(
                salon_id, list_html, list_url, pattern, ajax_rules,
                list_data_rules, max_therapists)

            if therapists:
                # 成功 → キャッシュ・ログ更新して返す
                self.stats['rule_success'] += 1
                if pattern_id:
                    self._update_cms_confidence(pattern_id, True)
                self._update_cache(salon_id, pattern_id, list_url, 'rule',
                                  len(therapists), True)
                if self.db_conn:
                    try:
                        self.db_conn.commit()
                    except Exception:
                        pass
                print(f"\n  完了: {len(therapists)}名 (method=ajax_rule)")
                return therapists
            else:
                log.info("  AJAX高速パス失敗、通常フローにフォールバック")

        # === Step 3: セラピスト個別URL抽出（通常フロー） ===
        entries = []
        step3_method = 'llm'

        # 1. CMSルールベースで抽出試行
        if pattern and cms_confidence >= 0.4:
            entries = self.rule_extractor.extract_therapist_urls(
                list_html, list_url, pattern.get('therapist_list_rules', {}))
            if entries:
                step3_method = 'rule'
                print(f"  [3/3] セラピストURL抽出（ルール）: {len(entries)}名")

        # 2. ヒューリスティックでURL抽出（LLM不要）
        if not entries:
            entries = self._extract_therapist_urls_heuristic(list_html, list_url)
            if entries:
                step3_method = 'heuristic'
                print(f"  [3/3] セラピストURL抽出（ヒューリスティック）: {len(entries)}名")

        # 3. LLMフォールバック
        if not entries:
            step3_method = 'llm'
            print(f"  [3/3] セラピスト情報を抽出（LLM）...")
            entries = self.llm_scraper.extract_therapist_urls(list_url, list_html)

        # ページネーション対応（ヒューリスティックでも使える）
        next_pages = self.llm_scraper.find_next_pages(list_url, list_html)
        for page_url in next_pages[:5]:
            time.sleep(REQUEST_DELAY)
            page_html = fetch_page(page_url)
            if page_html:
                if step3_method == 'rule' and pattern:
                    more = self.rule_extractor.extract_therapist_urls(
                        page_html, page_url, pattern.get('therapist_list_rules', {}))
                elif step3_method == 'heuristic':
                    more = self._extract_therapist_urls_heuristic(page_html, page_url)
                else:
                    more = self.llm_scraper.extract_therapist_urls(page_url, page_html)
                entries.extend(more)

        # 重複除去
        seen = set()
        unique = []
        for e in entries:
            if e['url'] not in seen:
                seen.add(e['url'])
                unique.append(e)
        entries = unique

        self._log_scrape(salon_id, 'extract_urls', step3_method, bool(entries), list_html,
                         detail=f'{len(entries)} urls')

        if not entries:
            print(f"  x セラピスト0名")
            self._update_cache(salon_id, pattern_id, list_url, step3_method, 0, False)
            if pattern_id:
                self._update_cms_confidence(pattern_id, False)
            self.stats['errors'] += 1
            return []

        # max_therapists制限
        if max_therapists > 0:
            entries = entries[:max_therapists]

        print(f"  -> {len(entries)}名のセラピストを検出")

        # === Step 4: 各セラピストの詳細取得 ===
        therapists = []
        step4_method = 'llm'

        # まず一覧ページのカードから直接データ抽出を試みる（LLM不要・個別fetch不要）
        if step3_method in ('heuristic', 'rule') and entries:
            list_card_results = self._extract_data_from_list_cards(
                list_html, list_url, entries)
            if list_card_results and len(list_card_results) >= len(entries) * 0.5:
                # 半数以上の抽出成功 → 一覧カードから十分なデータが取れた
                step4_method = 'heuristic_list'
                print(f"  [4] 一覧カードから直接抽出: {len(list_card_results)}/{len(entries)}名")
                self._log_scrape(salon_id, 'extract_data', 'heuristic_list',
                                 True, detail=f'{len(list_card_results)}/{len(entries)} from list cards')
                self._update_cache(salon_id, pattern_id, list_url, 'heuristic',
                                  len(list_card_results), True)
                if self.db_conn:
                    try:
                        self.db_conn.commit()
                    except Exception:
                        pass
                self.stats['rule_success'] += 1
                print(f"\n  完了: {len(list_card_results)}名 (method=heuristic_list)")
                return list_card_results

        # ルールベース抽出が使えるか判定
        use_rule_for_data = (
            pattern and cms_confidence >= 0.4
            and pattern.get('therapist_data_rules')
        )

        # ハイブリッドモード: confidence 0.4-0.7 では最初の1名でLLM検証
        need_hybrid_check = (
            use_rule_for_data
            and 0.4 <= cms_confidence < 0.7
        )

        if use_rule_for_data:
            step4_method = 'rule'

        # HTMLキャッシュ（rule_miner用）
        sample_htmls = []

        for i, entry in enumerate(entries):
            name_hint = entry.get('name', '?')
            print(f"  [{i+1}/{len(entries)}] {name_hint}")

            time.sleep(REQUEST_DELAY)
            t_html = fetch_page(entry['url'])
            if not t_html:
                continue

            data = None

            if use_rule_for_data:
                # ルールベース抽出
                data = self.rule_extractor.extract_therapist_data(
                    t_html, entry['url'], pattern.get('therapist_data_rules', {}))

                if data and self.validator.validate_therapist(data):
                    # ハイブリッドチェック: 最初の1名はLLMでも抽出して比較
                    if need_hybrid_check and i == 0:
                        llm_data = self.llm_scraper.extract_therapist_data(entry['url'], t_html)
                        if llm_data and llm_data.get('name') and data.get('name') != llm_data.get('name'):
                            log.warning(f"  ハイブリッドチェック: ルール({data.get('name')}) vs LLM({llm_data.get('name')})")
                            # 名前不一致 → ルール信頼度が低い、LLMに切り替え
                            use_rule_for_data = False
                            step4_method = 'llm'
                            data = llm_data
                        else:
                            need_hybrid_check = False  # 検証OK、以降はルールのみ
                else:
                    # ルール抽出失敗 → LLMフォールバック
                    data = self.llm_scraper.extract_therapist_data(entry['url'], t_html)
                    if i < 3:
                        # 最初の数件で失敗し続ける → 全面LLMに切り替え
                        use_rule_for_data = False
                        step4_method = 'llm'
            else:
                # LLM抽出
                data = self.llm_scraper.extract_therapist_data(entry['url'], t_html)

            if data:
                # 一覧ページ画像のフォールバック
                imgs = data.get('image_urls') or []
                if not imgs and entry.get('list_image_url'):
                    data['image_urls'] = [entry['list_image_url']]

                n = data.get('name', '?')
                a = data.get('age', '?')
                h = data.get('height', '?')
                sizes = f"B{data.get('bust','?')}/W{data.get('waist','?')}/H{data.get('hip','?')}"
                print(f"       -> {n} ({a}, {h}cm, {sizes})")

                # バリデーション: 無効データはスキップ
                if not self.validator.validate_therapist(data):
                    print(f"       -> (無効: スキップ)")
                    continue

                therapists.append(data)

                # rule_miner用にサンプルHTMLを保存（有効データのみ、最大5件）
                if len(sample_htmls) < 5:
                    sample_htmls.append({
                        'html': t_html,
                        'url': entry['url'],
                        'data': data,
                    })
            else:
                print(f"       -> 抽出失敗")

        self._log_scrape(salon_id, 'extract_data', step4_method, bool(therapists),
                         detail=f'{len(therapists)}/{len(entries)} extracted')

        # === 統計更新 ===
        if step3_method in ('rule', 'heuristic') or step4_method in ('rule', 'heuristic_list'):
            self.stats['rule_success'] += 1
        if step3_method == 'llm' or step4_method == 'llm':
            self.stats['llm_fallback'] += 1

        # === 信頼度更新 ===
        if pattern_id:
            batch_valid, _ = self.validator.validate_batch(therapists)
            self._update_cms_confidence(pattern_id, batch_valid)

        # === 自動学習: LLMで抽出した場合、パターンを学習 ===
        if step4_method == 'llm' and therapists and sample_htmls and self.db_conn:
            self._try_learn_pattern(salon_id, salon_url, html, sample_htmls, pattern_id)

        # === キャッシュ更新 ===
        if step4_method in ('rule', 'heuristic_list'):
            overall_method = 'rule'
        elif step3_method == 'heuristic':
            overall_method = 'heuristic'
        else:
            overall_method = 'llm'
        self._update_cache(salon_id, pattern_id, list_url, overall_method,
                          len(therapists), bool(therapists))

        if self.db_conn:
            try:
                self.db_conn.commit()
            except Exception:
                pass

        print(f"\n  完了: {len(therapists)}/{len(entries)}名 (method={overall_method})")
        return therapists

    def _extract_via_ajax_list(self, salon_id, list_html, list_url, pattern,
                                ajax_rules, list_data_rules, max_therapists):
        """
        AJAX一覧ページから直接セラピストデータを抽出（個別ページ訪問不要）

        estama等のCMSで、一覧カードに全情報（名前、年齢、身長、BWH、画像）が含まれる場合、
        個別プロフィールページへのリクエストを省略して高速抽出。

        Returns:
            [therapist_data_dict, ...] or []
        """
        print(f"  [AJAX] 一覧カードから直接データ抽出...")

        # AJAXページネーション検出
        ajax_path, start_page = self.rule_extractor.detect_ajax_pagination(
            list_html, ajax_rules)

        ajax_snippets = []
        if ajax_path:
            print(f"  [AJAX] ページネーション検出: {ajax_path} (page={start_page}〜)")
            ajax_snippets = self.rule_extractor.fetch_ajax_pages(
                list_url, ajax_path, start_page, ajax_rules)
            print(f"  [AJAX] 追加取得: {len(ajax_snippets)}件のスニペット")
        else:
            print(f"  [AJAX] ページネーションなし（全件SSR）")

        # 一覧カードからデータ抽出
        therapists = self.rule_extractor.extract_therapists_from_list(
            list_html, list_url, list_data_rules, ajax_snippets)

        if not therapists:
            return []

        # max_therapists制限
        if max_therapists > 0:
            therapists = therapists[:max_therapists]

        # 結果表示
        for i, t in enumerate(therapists):
            n = t.get('name', '?')
            a = t.get('age', '?')
            h = t.get('height', '?')
            sizes = f"B{t.get('bust','?')}/W{t.get('waist','?')}/H{t.get('hip','?')}"
            if i < 10 or i == len(therapists) - 1:
                print(f"  [{i+1}/{len(therapists)}] {n} ({a}, {h}cm, {sizes})")
            elif i == 10:
                print(f"  ... (残り{len(therapists) - 10}名)")

        self._log_scrape(salon_id, 'extract_ajax_list', 'rule', True,
                         detail=f'{len(therapists)} from ajax list')

        return therapists

    def _try_learn_pattern(self, salon_id, salon_url, top_html, sample_htmls, existing_pattern_id):
        """LLM抽出結果からパターンを自動学習"""
        try:
            mined_rules = self.rule_miner.mine_therapist_data_rules(sample_htmls)
            if not mined_rules:
                return

            # ルールの検証: 全サンプルで再抽出して成功率チェック
            success_count = 0
            for sample in sample_htmls:
                re_extracted = self.rule_extractor.extract_therapist_data(
                    sample['html'], sample['url'], mined_rules)
                if re_extracted and self.validator.validate_therapist(re_extracted):
                    # 名前が一致するか
                    if re_extracted.get('name') != sample['data'].get('name'):
                        continue
                    # 数値フィールドも一致するか確認（セレクタ衝突の検出）
                    fields_ok = True
                    for field in ('age', 'height'):
                        expected = sample['data'].get(field)
                        actual = re_extracted.get(field)
                        if expected is not None and actual is not None:
                            try:
                                if int(expected) != int(actual):
                                    fields_ok = False
                                    break
                            except (ValueError, TypeError):
                                pass
                    if fields_ok:
                        success_count += 1

            success_rate = success_count / len(sample_htmls) if sample_htmls else 0

            if success_rate < 0.8:
                log.info(f"  パターン学習: 成功率{success_rate:.0%}（閾値80%未満）→ 保留")
                return

            # 既存パターンに追加 or 新規パターン作成
            if existing_pattern_id:
                # 既存パターンのデータ抽出ルールを更新
                self._update_pattern_rules(existing_pattern_id, mined_rules)
                log.info(f"  パターン学習: 既存パターン(id={existing_pattern_id})のデータルール更新")
            else:
                # 新規CMSパターンとして登録
                cms_name = self._generate_cms_name(salon_url)
                new_fp = self.rule_miner.mine_fingerprint(top_html, salon_url)
                pattern_id = self._insert_new_pattern(cms_name, new_fp, mined_rules)
                if pattern_id:
                    log.info(f"  パターン学習: 新規パターン '{cms_name}' (id={pattern_id}) 登録")
                    self.stats['new_patterns'] += 1
                    # パターンリストを再ロード
                    self._load_cms_patterns()

        except Exception as e:
            log.warning(f"  パターン学習エラー: {e}")

    def _update_pattern_rules(self, pattern_id, data_rules):
        """既存パターンのtherapist_data_rulesを更新"""
        try:
            cur = self.db_conn.cursor()
            cur.execute("""
                UPDATE cms_patterns
                SET therapist_data_rules = %s,
                    version = version + 1
                WHERE id = %s
            """, (json.dumps(data_rules, ensure_ascii=False), pattern_id))
            cur.close()
        except Exception as e:
            log.warning(f"パターンルール更新失敗: {e}")

    def _generate_cms_name(self, url):
        """URLからCMS名を自動生成"""
        from urllib.parse import urlparse
        domain = urlparse(url).netloc
        # ドメインをCMS名に（例: aromamore.tokyo → aromamore_tokyo）
        name = domain.replace('.', '_').replace('-', '_')
        # 短縮
        if len(name) > 30:
            name = name[:30]
        return f"auto_{name}"

    def _insert_new_pattern(self, cms_name, fingerprint, data_rules):
        """新規CMSパターンをDBに登録"""
        try:
            cur = self.db_conn.cursor()
            cur.execute("""
                INSERT INTO cms_patterns (cms_name, fingerprint, therapist_data_rules, confidence)
                VALUES (%s, %s, %s, 0.5)
                ON CONFLICT (cms_name) DO UPDATE SET
                    therapist_data_rules = EXCLUDED.therapist_data_rules,
                    version = cms_patterns.version + 1
                RETURNING id
            """, (
                cms_name,
                json.dumps(fingerprint, ensure_ascii=False),
                json.dumps(data_rules, ensure_ascii=False),
            ))
            row = cur.fetchone()
            cur.close()
            return row[0] if row else None
        except Exception as e:
            log.warning(f"新規パターン登録失敗: {e}")
            return None

    def print_stats(self):
        """統計サマリーを表示"""
        print(f"\n{'='*60}")
        print(f" Smart Scraper 統計")
        print(f"{'='*60}")
        print(f"  ルール成功:       {self.stats['rule_success']}")
        print(f"  LLMフォールバック: {self.stats['llm_fallback']}")
        print(f"  新規パターン:     {self.stats['new_patterns']}")
        print(f"  キャッシュヒット: {self.stats['cache_hits']}")
        print(f"  エラー:           {self.stats['errors']}")
        total = self.stats['rule_success'] + self.stats['llm_fallback']
        if total > 0:
            rule_rate = self.stats['rule_success'] / total * 100
            print(f"  ルール率:         {rule_rate:.1f}%")
        print(f"{'='*60}")
