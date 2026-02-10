#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ルールベース抽出モジュール
CSSセレクタと正規表現でセラピスト情報を抽出（LLM不要）

使い方:
    extractor = RuleExtractor()
    list_url = extractor.find_list_url(html, base_url, rules)
    therapist_urls = extractor.extract_therapist_urls(html, base_url, rules)
    data = extractor.extract_therapist_data(html, base_url, rules)
"""

import re
import json
import logging
import time

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


class RuleExtractor:
    """CSSセレクタ+正規表現によるルールベース抽出"""

    def find_list_url(self, html, base_url, rules):
        """
        一覧ページURLを発見

        Args:
            html: トップページHTML
            base_url: サロンURL
            rules: list_url_rules (jsonb)
                {
                    "link_selectors": ["a[href*='/cast']", "a[href*='/therapist']"],
                    "link_text_patterns": ["セラピスト", "キャスト", "在籍"],
                    "url_patterns": ["/cast", "/therapist", "/staff"]
                }

        Returns:
            URL文字列 or None
        """
        if not rules:
            return None

        soup = BeautifulSoup(html, 'html.parser')
        domain = urlparse(base_url).netloc

        # 1. CSSセレクタでリンクを検索
        for selector in rules.get('link_selectors', []):
            try:
                elements = soup.select(selector)
                for el in elements:
                    href = el.get('href')
                    if href:
                        full_url = urljoin(base_url, href)
                        if urlparse(full_url).netloc == domain:
                            return full_url
            except Exception:
                continue

        # 2. テキストパターンでリンクを検索
        for pattern in rules.get('link_text_patterns', []):
            for a in soup.find_all('a', href=True):
                text = a.get_text(strip=True)
                if pattern in text:
                    full_url = urljoin(base_url, a['href'])
                    if urlparse(full_url).netloc == domain:
                        return full_url

        # 3. URLパターンでリンクを検索
        for pattern in rules.get('url_patterns', []):
            for a in soup.find_all('a', href=True):
                href = a.get('href', '')
                if pattern in href:
                    full_url = urljoin(base_url, href)
                    if urlparse(full_url).netloc == domain:
                        return full_url

        return None

    def extract_therapist_urls(self, html, base_url, rules):
        """
        一覧ページからセラピスト個別URLを抽出

        Args:
            html: 一覧ページHTML
            base_url: 一覧ページURL
            rules: therapist_list_rules (jsonb)
                {
                    "item_selector": ".cast-item",
                    "link_selector": "a",
                    "name_selector": ".cast-name",
                    "image_selector": "img",
                    "url_pattern": "/cast/\\d+",
                    "exclude_patterns": ["/blog", "/news"]
                }

        Returns:
            [{"name": "...", "url": "...", "list_image_url": "..."}]
        """
        if not rules:
            return []

        soup = BeautifulSoup(html, 'html.parser')
        domain = urlparse(base_url).netloc
        results = []
        seen_urls = set()

        item_selector = rules.get('item_selector')
        link_selector = rules.get('link_selector', 'a')
        name_selector = rules.get('name_selector')
        image_selector = rules.get('image_selector', 'img')
        url_pattern = rules.get('url_pattern')
        exclude_patterns = rules.get('exclude_patterns', [])

        if item_selector:
            # アイテムコンテナベースの抽出
            items = soup.select(item_selector)
            for item in items:
                link_el = item.select_one(link_selector)
                if not link_el or not link_el.get('href'):
                    continue

                url = urljoin(base_url, link_el['href'])
                parsed = urlparse(url)

                if parsed.netloc != domain:
                    continue
                if url in seen_urls:
                    continue
                if any(excl in url for excl in exclude_patterns):
                    continue
                if url_pattern and not re.search(url_pattern, url):
                    continue

                seen_urls.add(url)

                # 名前抽出
                name = ''
                if name_selector:
                    name_el = item.select_one(name_selector)
                    if name_el:
                        name = name_el.get_text(strip=True)

                # 画像URL抽出
                list_image_url = None
                if image_selector:
                    img_el = item.select_one(image_selector)
                    if img_el:
                        src = (img_el.get('src') or img_el.get('data-src')
                               or img_el.get('data-lazy-src') or '')
                        if src:
                            list_image_url = urljoin(base_url, src)

                results.append({
                    'name': name,
                    'url': url,
                    'list_image_url': list_image_url,
                })
        else:
            # URLパターンベースの抽出（item_selectorなし）
            if not url_pattern:
                return []

            for a in soup.find_all('a', href=True):
                url = urljoin(base_url, a['href'])
                parsed = urlparse(url)

                if parsed.netloc != domain:
                    continue
                if url in seen_urls:
                    continue
                if any(excl in url for excl in exclude_patterns):
                    continue
                if not re.search(url_pattern, url):
                    continue

                seen_urls.add(url)
                name = a.get_text(strip=True)

                results.append({
                    'name': name,
                    'url': url,
                    'list_image_url': None,
                })

        return results

    def extract_therapist_data(self, html, base_url, rules):
        """
        個別ページからセラピスト詳細データを抽出

        Args:
            html: プロフィールページHTML
            base_url: プロフィールURL
            rules: therapist_data_rules (jsonb)
                {
                    "name": {"selector": "h1.cast-name", "regex": null},
                    "age": {"selector": ".age", "regex": "(\\d+)"},
                    "height": {"selector": ".height", "regex": "(\\d+)"},
                    "bust": {"selector": ".bust", "regex": "(\\d+)"},
                    "waist": {"selector": ".waist", "regex": "(\\d+)"},
                    "hip": {"selector": ".hip", "regex": "(\\d+)"},
                    "blood_type": {"selector": ".blood", "regex": null},
                    "images": {"selector": ".profile-img img", "attr": "src"},
                    "profile_text": {"selector": ".profile-text", "regex": null}
                }

        Returns:
            dict or None
        """
        if not rules:
            return None

        soup = BeautifulSoup(html, 'html.parser')
        data = {'source_url': base_url}

        # テキストフィールド抽出
        text_fields = ['name', 'age', 'height', 'bust', 'waist', 'hip',
                        'blood_type', 'profile_text']

        for field in text_fields:
            rule = rules.get(field)
            if not rule:
                continue

            selector = rule.get('selector')
            regex = rule.get('regex')

            if not selector:
                continue

            try:
                el = soup.select_one(selector)
                if not el:
                    data[field] = None
                    continue

                text = el.get_text(strip=True)

                if regex:
                    m = re.search(regex, text)
                    if m:
                        val = m.group(1) if m.lastindex else m.group(0)
                        # 数値フィールドは整数化
                        if field in ('age', 'height', 'waist', 'hip'):
                            try:
                                val = int(val)
                            except ValueError:
                                pass
                        data[field] = val
                    else:
                        data[field] = None
                else:
                    data[field] = text
            except Exception:
                data[field] = None

        # 画像フィールド抽出
        images_rule = rules.get('images')
        if images_rule:
            selector = images_rule.get('selector')
            attr = images_rule.get('attr', 'src')

            if selector:
                try:
                    img_els = soup.select(selector)
                    image_urls = []
                    for img in img_els:
                        src = img.get(attr) or img.get('data-src') or ''
                        if src:
                            image_urls.append(urljoin(base_url, src))
                    data['image_urls'] = image_urls if image_urls else None
                except Exception:
                    data['image_urls'] = None
        else:
            data['image_urls'] = None

        # 名前が取れなければ失敗
        if not data.get('name'):
            return None

        return data

    # =========================================================================
    # AJAX一覧ページから直接データ抽出（estama等）
    # =========================================================================

    def detect_ajax_pagination(self, html, ajax_rules):
        """
        HTMLにAJAXページネーションのトリガーがあるか検出

        Returns:
            (ajax_path, start_page) or (None, None)
        """
        if not ajax_rules:
            return None, None

        soup = BeautifulSoup(html, 'html.parser')
        trigger_selector = ajax_rules.get('trigger_selector', '.js-scrl-reading-point')
        url_attr = ajax_rules.get('url_attr', 'data-ajax-url')
        page_attr = ajax_rules.get('page_attr', 'data-page')

        trigger = soup.select_one(trigger_selector)
        if not trigger:
            return None, None

        ajax_path = trigger.get(url_attr)
        start_page = trigger.get(page_attr)

        if not ajax_path:
            return None, None

        try:
            start_page = int(start_page) if start_page else 1
        except ValueError:
            start_page = 1

        return ajax_path, start_page

    def fetch_ajax_pages(self, base_url, ajax_path, start_page, ajax_rules, max_pages=50):
        """
        AJAX APIをページネーションして全HTMLスニペットを取得

        Args:
            base_url: サイトベースURL
            ajax_path: AJAX APIパス（例: /therapist/list_json/）
            start_page: 開始ページ番号
            ajax_rules: ajax_pagination設定
            max_pages: 最大ページ数（安全弁）

        Returns:
            [html_snippet, ...]
        """
        list_key = ajax_rules.get('response_list_key', 'list')
        page_key = ajax_rules.get('response_page_key', 'page')
        last_key = ajax_rules.get('response_last_key', 'is_last')
        last_value = ajax_rules.get('last_value', 1)

        all_snippets = []
        current_page = start_page

        for _ in range(max_pages):
            url = urljoin(base_url, f"{ajax_path.rstrip('/')}/{current_page}/")
            log.info(f"  AJAX: {url}")

            try:
                resp = requests.get(url, headers=HEADERS, timeout=15)
                if resp.status_code != 200:
                    log.warning(f"  AJAX {resp.status_code}: {url}")
                    break

                data = resp.json()
                snippets = data.get(list_key, [])
                all_snippets.extend(snippets)

                log.info(f"  AJAX page {current_page}: {len(snippets)}件")

                if data.get(last_key) == last_value:
                    break

                next_page = data.get(page_key)
                if next_page is None or next_page == current_page:
                    break
                current_page = next_page

                time.sleep(0.5)

            except Exception as e:
                log.warning(f"  AJAXエラー: {e}")
                break

        return all_snippets

    def extract_therapists_from_list(self, html, base_url, list_data_rules,
                                      ajax_snippets=None):
        """
        一覧ページのカードから直接セラピストデータを抽出
        （個別ページ訪問不要）

        Args:
            html: 一覧ページHTML（SSRの初期表示分）
            base_url: ベースURL
            list_data_rules: 一覧カードの抽出ルール
            ajax_snippets: AJAXで取得した追加HTMLスニペット

        Returns:
            [therapist_data_dict, ...]
        """
        if not list_data_rules:
            return []

        item_selector = list_data_rules.get('item_selector')
        if not item_selector:
            return []

        # SSRの初期表示分を解析
        soup = BeautifulSoup(html, 'html.parser')
        items = soup.select(item_selector)

        # AJAXスニペットを追加
        if ajax_snippets:
            for snippet in ajax_snippets:
                snippet_soup = BeautifulSoup(snippet, 'html.parser')
                snippet_items = snippet_soup.select(item_selector)
                if snippet_items:
                    items.extend(snippet_items)
                else:
                    # スニペット自体がアイテムの場合
                    items.append(snippet_soup)

        therapists = []
        seen_urls = set()

        for item in items:
            data = self._extract_from_card(item, base_url, list_data_rules)
            if data and data.get('name'):
                source_url = data.get('source_url', '')
                if source_url and source_url in seen_urls:
                    continue
                if source_url:
                    seen_urls.add(source_url)
                therapists.append(data)

        return therapists

    def _extract_from_card(self, card_element, base_url, rules):
        """
        1枚のカードHTMLからセラピストデータを抽出

        Args:
            card_element: BeautifulSoupのTag要素
            base_url: ベースURL
            rules: list_data_rules

        Returns:
            dict or None
        """
        data = {}

        # プロフィールURL
        link_rule = rules.get('link')
        if link_rule:
            link_el = card_element.select_one(link_rule.get('selector', 'a'))
            if link_el:
                href = link_el.get(link_rule.get('attr', 'href'))
                if href:
                    data['source_url'] = urljoin(base_url, href)

        # テキストフィールド
        for field in ['name', 'age', 'height', 'bust', 'waist', 'hip']:
            rule = rules.get(field)
            if not rule:
                continue

            selector = rule.get('selector')
            if not selector:
                continue

            el = card_element.select_one(selector)
            if not el:
                continue

            text = el.get_text(strip=True)
            regex = rule.get('regex')

            if regex:
                m = re.search(regex, text)
                if m:
                    val = m.group(1) if m.lastindex else m.group(0)
                    if field in ('age', 'height', 'waist', 'hip'):
                        try:
                            val = int(val)
                        except ValueError:
                            pass
                    data[field] = val
                elif field == 'name' and rule.get('fallback_regex'):
                    m2 = re.search(rule['fallback_regex'], text)
                    if m2:
                        data[field] = m2.group(1) if m2.lastindex else m2.group(0)
                    else:
                        data[field] = None
                else:
                    data[field] = None
            else:
                data[field] = text

        # 画像
        image_rule = rules.get('image')
        if image_rule:
            img_el = card_element.select_one(image_rule.get('selector', 'img'))
            if img_el:
                src = img_el.get(image_rule.get('attr', 'src')) or img_el.get('data-src') or ''
                if src:
                    data['image_urls'] = [urljoin(base_url, src)]

        if not data.get('name'):
            return None

        return data
