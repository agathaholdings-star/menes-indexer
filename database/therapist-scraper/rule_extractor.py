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
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse


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
