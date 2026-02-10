#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CMS指紋判定モジュール
HTMLからCMSを特定し、対応する抽出ルールを返す

使い方:
    fp = CMSFingerprinter(db_conn)
    cms_name, confidence, pattern_id = fp.identify(html, url)
"""

import re
from urllib.parse import urlparse


class CMSFingerprinter:
    """HTMLからCMSプラットフォームを判定"""

    def __init__(self, patterns=None):
        """
        Args:
            patterns: cms_patternsテーブルから取得した辞書リスト
                      [{'id': 1, 'cms_name': 'estama', 'fingerprint': {...}, ...}]
        """
        self.patterns = patterns or []

    def identify(self, html, url):
        """
        HTMLとURLからCMSを判定

        Args:
            html: ページのHTML文字列
            url: ページURL

        Returns:
            (cms_name, confidence, pattern_id) or (None, 0.0, None)
        """
        if not html or not self.patterns:
            return None, 0.0, None

        html_lower = html.lower()
        domain = urlparse(url).netloc.lower()

        best_match = None
        best_score = 0.0

        for pattern in self.patterns:
            fp = pattern.get('fingerprint', {})
            if not fp:
                continue

            score = self._calculate_score(html_lower, domain, fp)

            if score > best_score:
                best_score = score
                best_match = pattern

        if best_match and best_score >= 0.5:
            return best_match['cms_name'], best_score, best_match['id']

        return None, 0.0, None

    def _calculate_score(self, html_lower, domain, fingerprint):
        """指紋シグナルに基づくスコア計算（加重マッチング）"""
        total_weight = 0.0
        matched_weight = 0.0

        # meta_generators: <meta name="generator" content="...">
        generators = fingerprint.get('meta_generators', [])
        if generators:
            weight = 3.0
            total_weight += weight
            for gen in generators:
                if f'content="{gen.lower()}"' in html_lower or f"content='{gen.lower()}'" in html_lower:
                    matched_weight += weight
                    break

        # script_patterns: scriptタグのsrcに含まれるパターン
        script_patterns = fingerprint.get('script_patterns', [])
        if script_patterns:
            weight_each = 2.0 / max(len(script_patterns), 1)
            for pat in script_patterns:
                total_weight += weight_each
                if pat.lower() in html_lower:
                    matched_weight += weight_each

        # css_patterns: CSSクラス名やリンクのパターン
        css_patterns = fingerprint.get('css_patterns', [])
        if css_patterns:
            weight_each = 1.5 / max(len(css_patterns), 1)
            for pat in css_patterns:
                total_weight += weight_each
                if pat.lower() in html_lower:
                    matched_weight += weight_each

        # url_patterns: URL構造パターン（画像パス等）
        url_patterns = fingerprint.get('url_patterns', [])
        if url_patterns:
            weight_each = 2.0 / max(len(url_patterns), 1)
            for pat in url_patterns:
                total_weight += weight_each
                if pat.lower() in html_lower:
                    matched_weight += weight_each

        # html_signatures: HTML内の特徴文字列
        html_signatures = fingerprint.get('html_signatures', [])
        if html_signatures:
            weight_each = 1.0 / max(len(html_signatures), 1)
            for sig in html_signatures:
                total_weight += weight_each
                if sig.lower() in html_lower:
                    matched_weight += weight_each

        # domain_patterns: ドメインに含まれるパターン
        domain_patterns = fingerprint.get('domain_patterns', [])
        if domain_patterns:
            weight_each = 1.5 / max(len(domain_patterns), 1)
            for pat in domain_patterns:
                total_weight += weight_each
                if pat.lower() in domain:
                    matched_weight += weight_each

        if total_weight == 0:
            return 0.0

        return matched_weight / total_weight
