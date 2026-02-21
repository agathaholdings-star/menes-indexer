#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Playwright fetch module — JS描画サイト用フォールバック

requests.get() が薄いHTML（JSフレームワークのシェルのみ）を返す場合に、
Chromiumでページを描画してからDOMを取得する。

Playwright Async APIを専用イベントループで実行。
Anthropic SDKのasyncioとの競合を完全回避。

Usage:
    from playwright_fetch import fetch_page_playwright, cleanup_browser

    html = fetch_page_playwright(url)  # JS描画後のHTML
    cleanup_browser()                   # 終了時にブラウザ解放
"""

import asyncio
import atexit
import logging
import threading

log = logging.getLogger(__name__)

# Playwright専用イベントループ（別スレッドで常時稼働）
_loop = None
_loop_thread = None
_pw = None
_browser = None


def _run_loop(loop):
    """専用スレッドでイベントループを永続実行"""
    asyncio.set_event_loop(loop)
    loop.run_forever()


def _ensure_loop():
    """専用イベントループが起動していなければ起動"""
    global _loop, _loop_thread

    if _loop and _loop.is_running():
        return

    _loop = asyncio.new_event_loop()
    _loop_thread = threading.Thread(
        target=_run_loop, args=(_loop,), daemon=True, name="playwright-loop"
    )
    _loop_thread.start()


async def _ensure_browser():
    """ブラウザが起動していなければ起動（async版、ループ内で実行）"""
    global _pw, _browser

    if _browser and _browser.is_connected():
        return

    from playwright.async_api import async_playwright

    _pw = await async_playwright().start()
    _browser = await _pw.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-extensions",
        ],
    )
    log.info("Playwright Chromium started (async, dedicated loop)")


# エイジゲートのクリック対象セレクタ（優先順）
_AGE_GATE_SELECTORS = [
    'text="18歳以上"',
    'text="18歳以上です"',
    'text="18歳以上の方"',
    'text="Enter"',
    'text="ENTER"',
    'text="enter"',
    'text="入場する"',
    'text="同意して入場"',
    'text="同意する"',
    'text="はい"',
    'text="YES"',
    'text="Yes"',
]


async def _try_dismiss_age_gate(page) -> bool:
    """エイジゲートを検知してクリック突破。突破した場合True。"""
    for selector in _AGE_GATE_SELECTORS:
        try:
            el = page.locator(selector).first
            if await el.is_visible(timeout=500):
                await el.click()
                log.info(f"  Age gate clicked: {selector}")
                await page.wait_for_load_state("networkidle", timeout=10000)
                return True
        except Exception:
            continue
    return False


async def _fetch_async(url: str, timeout_ms: int) -> str | None:
    """Playwright Async APIでページを描画してHTML取得"""
    global _browser

    await _ensure_browser()

    # ブラウザがクラッシュしていたら再起動
    if not _browser.is_connected():
        log.info("  Playwright browser disconnected, restarting...")
        _browser = await _pw.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions",
            ],
        )

    context = await _browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1280, "height": 800},
    )
    page = await context.new_page()

    try:
        await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
    except Exception as e:
        log.debug(f"  Playwright goto partial: {e}")

    # エイジゲート検知＆突破
    await _try_dismiss_age_gate(page)

    # lazy-load対応: 追加待機
    await asyncio.sleep(2)

    html = await page.content()
    await context.close()

    if html and len(html) > 100:
        return html
    return None


def fetch_page_playwright(url: str, timeout_ms: int = 30000) -> str | None:
    """
    Playwrightでページを描画してHTMLを取得。

    専用イベントループにasyncタスクを投入して結果を待つ。
    メインスレッドのasyncioとの競合なし。

    Args:
        url: 取得対象URL
        timeout_ms: ページ読み込みタイムアウト（デフォルト30秒）

    Returns:
        str | None — JS描画後のHTML文字列
    """
    try:
        _ensure_loop()
        future = asyncio.run_coroutine_threadsafe(_fetch_async(url, timeout_ms), _loop)
        return future.result(timeout=(timeout_ms / 1000) + 10)
    except Exception as e:
        log.warning(f"  Playwright fetch failed: {url} — {e}")
        return None


async def _cleanup_async():
    """ブラウザとPlaywrightインスタンスを解放（async版）"""
    global _browser, _pw

    if _browser:
        try:
            await _browser.close()
        except Exception:
            pass
        _browser = None

    if _pw:
        try:
            await _pw.stop()
        except Exception:
            pass
        _pw = None


def cleanup_browser():
    """ブラウザとPlaywrightインスタンスを解放（メインスレッドから呼べる）"""
    global _loop, _browser, _pw

    if not _loop or not _loop.is_running():
        return

    try:
        future = asyncio.run_coroutine_threadsafe(_cleanup_async(), _loop)
        future.result(timeout=10)
    except Exception:
        pass

    try:
        _loop.call_soon_threadsafe(_loop.stop)
    except Exception:
        pass


# プロセス終了時に自動クリーンアップ
atexit.register(cleanup_browser)
