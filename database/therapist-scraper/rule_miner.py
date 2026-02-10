#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
パターン自動学習モジュール
LLM抽出結果（正解データ）+ 生HTMLを比較してCSSセレクタを自動導出

手順:
    1. 抽出された値がHTML内のどの要素にあるか特定
    2. CSSセレクタ生成
    3. セレクタ衝突検出 → 親要素+コンテキスト正規表現で解決
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

        # 全フィールドを統一的にマイニング（BWH含む）
        all_fields = ['name', 'age', 'height', 'bust', 'waist', 'hip', 'profile_text']
        field_info = {}  # field -> {'selector': str, 'text': str, 'value': str}

        for field in all_fields:
            selectors = []
            texts = []
            values = []

            for sample in samples:
                value = sample['data'].get(field)
                if value is None:
                    continue

                soup = BeautifulSoup(sample['html'], 'html.parser')
                selector, elem_text = self._find_selector_and_text(
                    soup, str(value), field)
                if selector:
                    selectors.append(selector)
                    texts.append(elem_text)
                    values.append(str(value))

            if not selectors:
                continue

            # 最も頻出するセレクタを採用
            counter = Counter(selectors)
            best_selector, count = counter.most_common(1)[0]

            # 全サンプルの50%以上で同じセレクタが有効なら採用
            if count >= len(samples) * 0.5:
                rep_idx = next(i for i, s in enumerate(selectors)
                               if s == best_selector)
                field_info[field] = {
                    'selector': best_selector,
                    'text': texts[rep_idx],
                    'value': values[rep_idx],
                }

        if 'name' not in field_info:
            return None

        # セレクタ衝突を検出して解決
        rules = self._build_rules_with_collision_resolution(field_info)

        # 画像: プロフィール画像のセレクタを探す（衝突問題なし）
        image_rule = self._mine_image_rule(samples)
        if image_rule:
            rules['images'] = image_rule

        return rules if rules.get('name') else None

    def _find_selector_and_text(self, soup, value, field):
        """
        HTML内で特定の値を含む要素のCSSセレクタと要素テキストを返す

        Returns:
            (selector, element_text) or (None, None)
        """
        candidates = []
        for el in soup.find_all(string=re.compile(re.escape(value))):
            parent = el.parent
            if parent and parent.name not in ('script', 'style', 'html', 'body', 'head'):
                candidates.append(parent)

        if not candidates:
            return None, None

        # 最も特定性が高い（深い位置の）要素を選択
        best = min(candidates, key=lambda el: -len(list(el.parents)))
        selector = self._element_to_selector(best)
        text = best.get_text(strip=True)

        return selector, text

    def _build_rules_with_collision_resolution(self, field_info):
        """
        セレクタ衝突を検出し、コンテキスト正規表現で解決してルールを構築

        衝突例: age, height, bust が全て 'div.cast_data p.date span' になる
        → 親要素 'div.cast_data p.date' + フィールド別正規表現
          (AGE\\s*(\\d+), T(\\d+), B(\\d+))
        """
        # Group by selector
        selector_groups = {}
        for field, info in field_info.items():
            s = info['selector']
            selector_groups.setdefault(s, []).append(field)

        rules = {}
        numeric_fields = ('age', 'height', 'bust', 'waist', 'hip')

        for selector, fields in selector_groups.items():
            if len(fields) == 1:
                # 衝突なし — 従来通り
                field = fields[0]
                if field in numeric_fields:
                    rules[field] = {'selector': selector, 'regex': r'(\d+)'}
                else:
                    rules[field] = {'selector': selector, 'regex': None}
            else:
                # 衝突検出！親要素+コンテキスト正規表現で解決
                parent_selector = self._get_parent_selector(selector)

                for field in fields:
                    info = field_info[field]
                    ctx_regex = self._derive_context_regex(
                        info['value'], info['text'], field)

                    if ctx_regex != r'(\d+)' and parent_selector:
                        # コンテキスト正規表現で区別可能 → 親セレクタ使用
                        rules[field] = {
                            'selector': parent_selector,
                            'regex': ctx_regex,
                        }
                    else:
                        # 解決できず — 元のセレクタで保持（不正確の可能性あり）
                        if field in numeric_fields:
                            rules[field] = {'selector': selector, 'regex': r'(\d+)'}
                        else:
                            rules[field] = {'selector': selector, 'regex': None}

        return rules

    def _derive_context_regex(self, value, element_text, field):
        """
        値の前後テキストからコンテキスト正規表現を導出

        Examples:
            ("25", "AGE 25", "age")              → r'AGE\\s*(\\d+)'
            ("158", "T158 / B85 (D)", "height")  → r'T(\\d+)'
            ("85", "T158 / B85 (D)", "bust")     → r'B(\\d+)'
            ("56", "身長156cm", "height")         → r'身長\\s*(\\d+)'
        """
        val_str = str(value)
        pos = element_text.find(val_str)
        if pos < 0:
            return r'(\d+)'

        # 値の前のテキストを取得
        prefix = element_text[:pos]

        if not prefix:
            return r'(\d+)'

        # ラベル抽出: 数字の直前の英字/日本語文字列
        m = re.search(r'([A-Za-z\u3040-\u9fff]+)\s*$', prefix)
        if m:
            label = m.group(1)
            return re.escape(label) + r'\s*(\d+)'

        # フォールバック: 値の直前の非数字文字1文字
        last_char = prefix.rstrip()[-1] if prefix.rstrip() else ''
        if last_char and not last_char.isdigit() and (
            last_char.isalpha() or ord(last_char) > 127
        ):
            return re.escape(last_char) + r'\s*(\d+)'

        return r'(\d+)'

    def _get_parent_selector(self, child_selector):
        """
        子セレクタから親セレクタを導出（末尾要素を除去）
        e.g., 'div.cast_data.sp p.date span' → 'div.cast_data.sp p.date'
        """
        parts = child_selector.split()
        if len(parts) > 1:
            return ' '.join(parts[:-1])
        return None

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
