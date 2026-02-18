#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
共通HTMLキャッシュモジュール

スクレイピング時のHTML保存をプロジェクトルール通りgzip圧縮で統一管理する。
カテゴリ別にサブディレクトリを分けて保存。

Usage:
    from html_cache_utils import HtmlCache

    cache = HtmlCache()
    cache.save("therapist", 9260, html_string)
    html = cache.load("therapist", 9260)  # None if miss
    cache.exists("therapist", 9260)       # bool

ディレクトリ構造:
    html_cache/
    ├── therapist/{id}.html.gz
    ├── salon/{id}.html.gz
    ├── salon_list/{id}.html.gz
    └── area/{slug}.html.gz
"""

import gzip
import os


class HtmlCache:
    """gzip圧縮HTMLキャッシュ"""

    def __init__(self, base_dir=None):
        if base_dir is None:
            base_dir = os.path.join(os.path.dirname(__file__), "html_cache")
        self.base_dir = base_dir

    def _path(self, category: str, key) -> str:
        return os.path.join(self.base_dir, category, f"{key}.html.gz")

    def save(self, category: str, key, html: str) -> None:
        """HTMLをgzip圧縮で保存"""
        path = self._path(category, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with gzip.open(path, "wt", encoding="utf-8") as f:
            f.write(html)

    def load(self, category: str, key) -> str | None:
        """キャッシュからHTMLを読み込み。なければNone"""
        path = self._path(category, key)
        if not os.path.exists(path):
            return None
        try:
            with gzip.open(path, "rt", encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None

    def exists(self, category: str, key) -> bool:
        """キャッシュが存在するか"""
        return os.path.exists(self._path(category, key))
