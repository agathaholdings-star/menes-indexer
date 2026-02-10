#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
パターン自動学習モジュール
LLM抽出結果（正解データ）+ 生HTMLを比較してCSSセレクタを自動導出

手順:
    1. 抽出された値がHTML内のどの要素にあるか特定
    2. CSSセレクタ生成
    3. 汎化（ID除去、nth-child除去）
    4. 複数サンプルで交差検証

使い方:
    miner = RuleMiner()
    rules = miner.mine_therapist_data_rules(samples)
    fingerprint = miner.mine_fingerprint(html, url)
"""

import re
from collections import Counter
from bs4 import BeautifulSoup
from urllib.parse import urlparse


class RuleMiner:
    """LLM結果からCSSセレクタを自動導出"""

    def mine_therapist_data_rules(self, samples):
        """
        複数セラピストの正解データとHTMLからデータ抽出ルールを導出

        Args:
            samples: [{'html': str, 'url': str, 'data': dict}, ...]
                     dataはLLMの抽出結果（name, age, height等）

        Returns:
            therapist_data_rules dict or None
        """
        if not samples or len(samples) < 2:
            return None

        fields_to_mine = ['name', 'age', 'height', 'profile_text']
        field_selectors = {}

        for field in fields_to_mine:
            selectors_per_sample = []

            for sample in samples:
                value = sample['data'].get(field)
                if value is None:
                    continue

                soup = BeautifulSoup(sample['html'], 'html.parser')
                selector = self._find_selector_for_value(soup, str(value), field)
                if selector:
                    selectors_per_sample.append(selector)

            if not selectors_per_sample:
                continue

            # 最も頻出するセレクタを採用
            counter = Counter(selectors_per_sample)
            best_selector, count = counter.most_common(1)[0]

            # 全サンプルの50%以上で同じセレクタが有効なら採用
            if count >= len(samples) * 0.5:
                field_selectors[field] = best_selector

        if not field_selectors or 'name' not in field_selectors:
            return None

        # ルール形式に変換
        rules = {}
        for field, selector in field_selectors.items():
            if field in ('age', 'height'):
                rules[field] = {'selector': selector, 'regex': r'(\d+)'}
            else:
                rules[field] = {'selector': selector, 'regex': None}

        # BWH: まとめて探す（スペック表形式が多い）
        bwh_rules = self._mine_bwh_rules(samples)
        if bwh_rules:
            rules.update(bwh_rules)

        # 画像: プロフィール画像のセレクタを探す
        image_rule = self._mine_image_rule(samples)
        if image_rule:
            rules['images'] = image_rule

        return rules

    def _find_selector_for_value(self, soup, value, field):
        """
        HTML内で特定の値を含む要素のCSSセレクタを生成

        Args:
            soup: BeautifulSoup
            value: 検索する値文字列
            field: フィールド名

        Returns:
            CSSセレクタ文字列 or None
        """
        # テキスト内容で要素を検索
        candidates = []
        for el in soup.find_all(string=re.compile(re.escape(value))):
            parent = el.parent
            if parent and parent.name not in ('script', 'style', 'html', 'body', 'head'):
                candidates.append(parent)

        if not candidates:
            return None

        # 最も特定性が高い（深い位置の）要素を選択
        best = min(candidates, key=lambda el: -len(list(el.parents)))

        return self._element_to_selector(best)

    def _element_to_selector(self, element):
        """
        要素からCSSセレクタを生成（汎化済み）

        ID除去、nth-child除去で汎用的なセレクタにする
        """
        parts = []
        current = element

        # 最大3階層まで
        for _ in range(3):
            if not current or current.name in ('[document]', 'html', 'body'):
                break

            part = current.name

            # クラスを使う（IDは固有なので使わない）
            classes = current.get('class', [])
            if classes:
                # 汎用的なクラスのみ使用（数字やハッシュを含むものは除外）
                useful_classes = [
                    c for c in classes
                    if not re.search(r'[0-9a-f]{6,}|\d{3,}', c)
                    and len(c) > 1
                ]
                if useful_classes:
                    part += '.' + '.'.join(useful_classes[:2])

            parts.insert(0, part)
            current = current.parent

        return ' '.join(parts) if parts else None

    def _mine_bwh_rules(self, samples):
        """BWH（バスト/ウエスト/ヒップ）のルールを導出"""
        rules = {}

        for field in ('bust', 'waist', 'hip'):
            selectors = []
            for sample in samples:
                value = sample['data'].get(field)
                if value is None:
                    continue

                soup = BeautifulSoup(sample['html'], 'html.parser')

                # 数値として検索
                val_str = str(value)
                # まず純粋な数字で検索
                selector = self._find_selector_for_value(soup, val_str, field)
                if selector:
                    selectors.append(selector)

            if selectors:
                counter = Counter(selectors)
                best, count = counter.most_common(1)[0]
                if count >= len(samples) * 0.5:
                    rules[field] = {'selector': best, 'regex': r'(\d+)'}

        return rules if rules else None

    def _mine_image_rule(self, samples):
        """プロフィール画像のルールを導出"""
        selectors = []

        for sample in samples:
            image_urls = sample['data'].get('image_urls', [])
            if not image_urls:
                continue

            first_url = image_urls[0]
            soup = BeautifulSoup(sample['html'], 'html.parser')

            # img要素からsrc/data-srcで検索
            for img in soup.find_all('img'):
                src = img.get('src', '') or img.get('data-src', '')
                if first_url in src or (
                    # パス部分のみで比較
                    urlparse(first_url).path and
                    urlparse(first_url).path in src
                ):
                    selector = self._element_to_selector(img)
                    if selector:
                        selectors.append(selector)
                    break

        if not selectors:
            return None

        counter = Counter(selectors)
        best, count = counter.most_common(1)[0]
        if count >= len(samples) * 0.5:
            return {'selector': best, 'attr': 'src'}

        return None

    def mine_fingerprint(self, html, url):
        """
        サロンのトップページHTMLからCMS指紋を生成

        Args:
            html: トップページHTML
            url: サロンURL

        Returns:
            fingerprint dict
        """
        soup = BeautifulSoup(html, 'html.parser')
        fingerprint = {}

        # meta generator
        generators = []
        for meta in soup.find_all('meta', attrs={'name': 'generator'}):
            content = meta.get('content', '')
            if content:
                generators.append(content)
        if generators:
            fingerprint['meta_generators'] = generators

        # script src パターン
        script_patterns = set()
        for script in soup.find_all('script', src=True):
            src = script['src']
            # CMSを示唆するパス要素を抽出
            parts = urlparse(src).path.split('/')
            for part in parts:
                if part and len(part) > 3 and not re.match(r'^[\d.]+$', part):
                    if any(kw in part.lower() for kw in
                           ['wp-', 'wordpress', 'jquery', 'bootstrap']):
                        continue  # 汎用ライブラリは除外
                    script_patterns.add(part)
        if script_patterns:
            fingerprint['script_patterns'] = list(script_patterns)[:5]

        # CSS link パターン
        css_patterns = set()
        for link in soup.find_all('link', rel='stylesheet'):
            href = link.get('href', '')
            parts = urlparse(href).path.split('/')
            for part in parts:
                if part and len(part) > 3 and not re.match(r'^[\d.]+$', part):
                    if any(kw in part.lower() for kw in
                           ['wp-', 'wordpress', 'bootstrap', 'font']):
                        continue
                    css_patterns.add(part)
        if css_patterns:
            fingerprint['css_patterns'] = list(css_patterns)[:5]

        # 画像URLパターン
        url_patterns = set()
        for img in soup.find_all('img', src=True):
            src = img['src']
            parts = urlparse(src).path.split('/')
            for part in parts:
                if part and len(part) > 3 and not re.match(r'^[\d.]+$', part):
                    url_patterns.add(part)
        if url_patterns:
            # 最頻出のパターンを採用
            counter = Counter(url_patterns)
            fingerprint['url_patterns'] = [p for p, _ in counter.most_common(3)]

        return fingerprint
