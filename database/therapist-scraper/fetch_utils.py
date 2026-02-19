#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
共通fetch_pageモジュール

全スクレイピングスクリプトで共有するHTTPフェッチ関数。
HTTPS→HTTPフォールバック機能付き。

Usage:
    from fetch_utils import fetch_page, fetch_page_with_status, HEADERS

    html = fetch_page(url)                # str | None
    html, status = fetch_page_with_status(url)  # (str|None, int)
"""

import logging
import requests

log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def _detect_encoding(resp):
    """エンコーディング判定: Content-Type → meta charset → apparent_encoding"""
    if resp.encoding and resp.encoding.lower().replace('-', '') != 'iso88591':
        return
    head = resp.content[:2048].lower()
    if b'charset=utf-8' in head or b'charset="utf-8"' in head:
        resp.encoding = 'utf-8'
    elif b'charset=shift_jis' in head or b'charset=sjis' in head:
        resp.encoding = 'shift_jis'
    elif b'charset=euc-jp' in head:
        resp.encoding = 'euc-jp'
    else:
        resp.encoding = resp.apparent_encoding


def _try_fetch(url, timeout=15):
    """
    1回のfetch試行。

    Returns:
        (text, status_code) — 成功時は (str, 200等), 失敗時は (None, エラーコード)
        エラーコード: -1=timeout, -2=connection/SSL, -3=other, 0+=HTTP status
    """
    resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
    resp.raise_for_status()
    _detect_encoding(resp)
    return resp.text, resp.status_code


def fetch_page_with_status(url, timeout=15):
    """
    ページを取得。HTTPS→HTTPフォールバック付き。

    SSL/ConnectionError時にhttps→httpにフォールバックする。
    HTTP-onlyサイトの取りこぼしを防止。

    Returns:
        (str | None, int) — (HTML文字列, ステータスコード)
        ステータスコード: 200等=成功, -1=timeout, -2=connection, -3=other, 0+=HTTP error
    """
    try:
        return _try_fetch(url, timeout)
    except (requests.exceptions.SSLError, requests.exceptions.ConnectionError) as e:
        # HTTPS→HTTPフォールバック
        if url.startswith('https://'):
            http_url = 'http://' + url[len('https://'):]
            try:
                return _try_fetch(http_url, timeout)
            except requests.exceptions.Timeout:
                return None, -1
            except requests.exceptions.ConnectionError:
                return None, -2
            except requests.exceptions.HTTPError as he:
                return None, getattr(he.response, 'status_code', 0)
            except Exception:
                return None, -3
        return None, -2
    except requests.exceptions.HTTPError as e:
        return None, getattr(e.response, 'status_code', 0)
    except requests.exceptions.Timeout:
        return None, -1
    except Exception:
        return None, -3


def fetch_page(url, timeout=15):
    """
    ページを取得。HTTPS→HTTPフォールバック付き。

    Returns:
        str | None — HTML文字列 or None
    """
    text, _ = fetch_page_with_status(url, timeout)
    return text
