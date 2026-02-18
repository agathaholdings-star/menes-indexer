#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
セラピスト名修復スクリプト

Phase②のヒューリスティック名前抽出が失敗し、サロン名がセラピスト名に
入ってしまった2,931件を修復する。

Usage:
  python3 repair_therapist_names.py --limit 10 --dry-run   # テスト
  python3 repair_therapist_names.py --workers 5             # 全件実行
  python3 repair_therapist_names.py --resume                # 再開
"""

import argparse
import gzip
import json
import logging
import os
import re
import signal
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import psycopg2
import psycopg2.extras
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from urllib.parse import urljoin

# .env読み込み
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# 既存スクレイパーからインポート
sys.path.insert(0, os.path.dirname(__file__))
from therapist_scraper import fetch_page, clean_html_for_llm
from html_cache_utils import HtmlCache

# ---------------------------------------------------------------------------
# 設定
# ---------------------------------------------------------------------------
DB_DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)
CHECKPOINT_PATH = os.path.join(
    os.path.dirname(__file__), "repair_names_checkpoint.json"
)
_cache = HtmlCache()
CHECKPOINT_INTERVAL = 50
REQUEST_DELAY = 0.3
LLM_MODEL = "claude-haiku-4-5-20251001"

# ロガー
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# チェックポイント
# ---------------------------------------------------------------------------

def load_checkpoint() -> set:
    if os.path.exists(CHECKPOINT_PATH):
        with open(CHECKPOINT_PATH, "r") as f:
            data = json.load(f)
        return set(data.get("done_ids", []))
    return set()


def save_checkpoint(done_ids: set) -> None:
    with open(CHECKPOINT_PATH, "w") as f:
        json.dump({"done_ids": sorted(done_ids)}, f)


# ---------------------------------------------------------------------------
# 改善ヒューリスティック名前抽出
# ---------------------------------------------------------------------------

# 名前として除外するキーワード
EXCLUDE_KEYWORDS = [
    # ナビゲーション・ページ要素
    "メニュー", "料金", "アクセス", "ブログ", "予約", "HOME",
    "トップ", "TOP", "セラピスト", "キャスト", "スタッフ",
    "一覧", "ニュース", "お知らせ", "ギャラリー",
    "スケジュール", "出勤", "新人", "ランキング",
    "SCHEDULE", "Schedule", "schedule",
    # プロフィール関連
    "プロフィール", "PROFILE", "profile", "Profile",
    "THERAPIST", "therapist", "Therapist",
    # SNS・外部リンク
    "twitter", "Twitter", "ツイッター", "Instagram", "インスタ",
    "LINE", "SNS", "SNSSNS",
    # 問い合わせ・フォーム
    "予約フォーム", "お問い合わせ", "電話",
    # 店舗・サイト関連
    "メンズエステ", "公式サイト", "公式HP",
    "店長コメント", "店長",
    # フォームラベル・UI要素
    "名前", "REVIEW", "レビュー", "募集",
    "オススメ", "おすすめ", "RECOMMEND",
    # その他ジャンクテキスト
    "コメント", "お気に入り", "写メ日記", "ログイン",
]

# 完全一致で除外する値（部分一致だと正当な名前を誤爆するもの）
EXCLUDE_EXACT = {
    "名前", "SNSSNS", "SNS", "SCHEDULE", "REVIEW", "REVIEWレビュー",
    "店長コメント", "募集", "あなたにオススメの女の子",
}

# CSSクラス/IDに名前が入っている可能性が高い要素
NAME_CSS_SELECTORS = [
    ".cast-name", ".therapist-name", ".staff-name", ".girl-name",
    ".cast_name", ".therapist_name", ".staff_name", ".girl_name",
    ".castName", ".therapistName", ".staffName",
    ".name", ".prof-name", ".profile-name", ".detail-name",
    "#cast-name", "#therapist-name", "#staff-name",
    "[class*='castname']", "[class*='therapistname']", "[class*='staffname']",
    "[class*='cast-name']", "[class*='therapist-name']", "[class*='staff-name']",
    "h1.name", "h2.name", ".cast h1", ".cast h2",
    ".profile h1", ".profile h2", ".detail h1", ".detail h2",
]


def clean_extracted_name(text: str) -> str:
    """抽出された名前をクリーニング"""
    text = text.strip()
    # "(XX)" 形式の年齢を除去: "松本 (18)" → "松本"
    text = re.sub(r"\s*[\(（]\d{1,2}[\)）]\s*$", "", text)
    # "(次回..." などのスケジュール情報を除去
    text = re.sub(r"\s*[\(（]次回.*$", "", text)
    # 【】内のサロン名を除去: "水川あすみ【アロマメゾン】" → "水川あすみ"
    text = re.sub(r"【[^】]+】$", "", text)
    return text.strip()


def is_valid_name(text: str, salon_name: str, salon_display: str) -> bool:
    """名前として妥当かチェック"""
    text = text.strip()
    if not text or len(text) < 1 or len(text) > 20:
        return False
    # 完全一致除外
    if text in EXCLUDE_EXACT:
        return False
    # サロン名と一致 → 拒否
    if text == salon_name or text == salon_display:
        return False
    # サロン名を含む場合も拒否（部分一致）
    if salon_name and len(salon_name) >= 3 and salon_name in text:
        return False
    if salon_display and len(salon_display) >= 3 and salon_display in text:
        return False
    # 除外キーワード
    for kw in EXCLUDE_KEYWORDS:
        if kw in text:
            return False
    # URLっぽい
    if text.startswith("http") or "/" in text:
        return False
    # 数字だけ or 括弧+数字だけ
    if re.fullmatch(r"[\d\s\(\)（）]+", text):
        return False
    return True


def extract_name_heuristic(html: str, url: str, salon_name: str,
                           salon_display: str) -> str | None:
    """改善版ヒューリスティックで名前を抽出"""
    soup = BeautifulSoup(html, "html.parser")

    # 1. CSSクラスパターンから抽出（最も信頼性高い）
    for selector in NAME_CSS_SELECTORS:
        try:
            el = soup.select_one(selector)
        except Exception:
            continue
        if el:
            text = clean_extracted_name(el.get_text(strip=True))
            if is_valid_name(text, salon_name, salon_display):
                return text

    # 2. H1/H2（サロン名を明示除外）
    for tag in ["h1", "h2"]:
        for el in soup.find_all(tag):
            text = clean_extracted_name(el.get_text(strip=True))
            if is_valid_name(text, salon_name, salon_display):
                return text

    # 3. og:title
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        og_text = og["content"].strip()
        # デリミタで分割して最初の部分を試行
        for delim in ["|", "｜", "-", "–", "—", "/"]:
            if delim in og_text:
                candidate = clean_extracted_name(og_text.split(delim)[0].strip())
                if is_valid_name(candidate, salon_name, salon_display):
                    return candidate
        # デリミタなしでも試行
        cleaned_og = clean_extracted_name(og_text)
        if is_valid_name(cleaned_og, salon_name, salon_display):
            return cleaned_og

    # 4. titleタグ（デリミタ分割、サロン名除外）
    title_el = soup.find("title")
    if title_el:
        title_text = title_el.get_text(strip=True)
        for delim in ["|", "｜", "-", "–", "—", "/"]:
            if delim in title_text:
                candidate = clean_extracted_name(title_text.split(delim)[0].strip())
                if is_valid_name(candidate, salon_name, salon_display):
                    return candidate

    return None


# ---------------------------------------------------------------------------
# LLMフォールバック
# ---------------------------------------------------------------------------

_anthropic_client = None


def get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        from anthropic import Anthropic
        _anthropic_client = Anthropic()
    return _anthropic_client


def extract_name_llm(html: str, url: str, salon_name: str,
                     salon_display: str) -> str | None:
    """Haiku LLMで名前だけ抽出"""
    cleaned = clean_html_for_llm(html, url, max_chars=5000)

    prompt = f"""このメンズエステセラピストのプロフィールページから、セラピストの名前だけを抽出してください。

URL: {url}

重要:
- サロン名（「{salon_name}」「{salon_display}」）は名前ではありません。絶対に返さないでください。
- セラピスト個人の名前だけを返してください。
- 名前が見つからない場合は「NONE」と答えてください。
- 回答は名前1行のみ。余計な説明は不要です。

ページ内容:
{cleaned}

セラピスト名:"""

    try:
        client = get_anthropic_client()
        resp = client.messages.create(
            model=LLM_MODEL,
            max_tokens=50,
            messages=[{"role": "user", "content": prompt}],
        )
        result = resp.content[0].text.strip()

        if "NONE" in result.upper():
            return None

        # 改行があれば最初の行だけ
        result = result.split("\n")[0].strip()
        # 余計な記号除去
        result = re.sub(r"^[「『\"']+|[」』\"']+$", "", result).strip()
        # 名前クリーニング
        result = clean_extracted_name(result)

        if is_valid_name(result, salon_name, salon_display):
            return result
        return None
    except Exception as e:
        log.warning(f"LLM error: {e}")
        return None


# ---------------------------------------------------------------------------
# 1件処理
# ---------------------------------------------------------------------------

def process_one(row: dict) -> dict:
    """
    1セラピストの名前修復を試行。

    Returns:
        dict with keys: id, old_name, new_name, method, error
    """
    tid = row["id"]
    url = row["source_url"]
    salon_name = row["salon_name"] or ""
    salon_display = row["salon_display"] or ""

    result = {
        "id": tid,
        "old_name": row["name"],
        "new_name": None,
        "method": None,
        "error": None,
    }

    # HTMLキャッシュ確認
    html = _cache.load("therapist", tid)
    if html is None:
        time.sleep(REQUEST_DELAY)
        html = fetch_page(url)
        if html:
            _cache.save("therapist", tid, html)
        else:
            result["error"] = "fetch_failed"
            return result

    # 改善ヒューリスティック
    name = extract_name_heuristic(html, url, salon_name, salon_display)
    if name:
        result["new_name"] = name
        result["method"] = "heuristic"
        return result

    # LLMフォールバック
    name = extract_name_llm(html, url, salon_name, salon_display)
    if name:
        result["new_name"] = name
        result["method"] = "llm"
        return result

    result["error"] = "name_not_found"
    return result


# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="セラピスト名修復スクリプト")
    parser.add_argument("--limit", type=int, default=0, help="処理件数制限（0=全件）")
    parser.add_argument("--workers", type=int, default=5, help="並列ワーカー数")
    parser.add_argument("--dry-run", action="store_true", help="DB更新しない")
    parser.add_argument("--resume", action="store_true", help="チェックポイントから再開")
    args = parser.parse_args()

    # 対象レコード取得
    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT t.id, t.name, t.source_url, s.name AS salon_name, s.display_name AS salon_display
        FROM therapists t
        JOIN salons s ON s.id = t.salon_id
        WHERE (t.name = s.name OR t.name = s.display_name
               OR t.name ~* 'プロフィール|PROFILE|profile'
               OR t.name ~* 'twitter|ツイッター'
               OR t.name IN ('SNSSNS', 'SCHEDULE', '店長コメント', '名前',
                             'REVIEWレビュー', 'あなたにオススメの女の子', '募集（50）')
               OR t.name ~ '^\\(.+\\)$'
               OR (length(s.display_name) >= 3 AND t.name LIKE '%%' || s.display_name || '%%')
               OR (length(s.name) >= 3 AND t.name LIKE '%%' || s.name || '%%'))
          AND t.source_url IS NOT NULL AND t.source_url != ''
        ORDER BY t.id
    """)
    rows = cur.fetchall()
    log.info(f"対象: {len(rows)}件")

    # リジューム
    done_ids = load_checkpoint() if args.resume else set()
    if done_ids:
        rows = [r for r in rows if r["id"] not in done_ids]
        log.info(f"リジューム: 残り{len(rows)}件（完了済み{len(done_ids)}件スキップ）")

    if args.limit > 0:
        rows = rows[: args.limit]
        log.info(f"制限: {len(rows)}件に絞り込み")

    if not rows:
        log.info("処理対象なし")
        conn.close()
        return

    # Ctrl+Cハンドリング
    shutdown = False

    def signal_handler(sig, frame):
        nonlocal shutdown
        shutdown = True
        log.info("シャットダウン要求を受信。現在の処理完了後に停止します...")

    signal.signal(signal.SIGINT, signal_handler)

    # 統計
    stats = {"total": len(rows), "heuristic": 0, "llm": 0, "failed": 0, "fetch_err": 0}

    # 並列処理
    update_cur = conn.cursor()
    processed = 0

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {}
        for row in rows:
            if shutdown:
                break
            f = executor.submit(process_one, dict(row))
            futures[f] = row

        for future in as_completed(futures):
            if shutdown:
                break

            result = future.result()
            processed += 1
            done_ids.add(result["id"])

            if result["new_name"]:
                method = result["method"]
                stats[method] += 1

                if not args.dry_run:
                    update_cur.execute(
                        "UPDATE therapists SET name = %s WHERE id = %s",
                        (result["new_name"], result["id"]),
                    )

                log.info(
                    f"[{processed}/{stats['total']}] ID={result['id']} "
                    f"「{result['old_name']}」→「{result['new_name']}」({method})"
                )
            elif result["error"] == "fetch_failed":
                stats["fetch_err"] += 1
                log.warning(
                    f"[{processed}/{stats['total']}] ID={result['id']} fetch失敗"
                )
            else:
                stats["failed"] += 1
                log.warning(
                    f"[{processed}/{stats['total']}] ID={result['id']} "
                    f"名前抽出失敗（{result['old_name']}）"
                )

            # チェックポイント
            if processed % CHECKPOINT_INTERVAL == 0:
                save_checkpoint(done_ids)

    # 最終チェックポイント保存
    save_checkpoint(done_ids)
    update_cur.close()
    conn.close()

    # サマリー
    mode = "DRY-RUN" if args.dry_run else "LIVE"
    log.info(f"\n{'='*60}")
    log.info(f" 完了 ({mode})")
    log.info(f" 対象: {stats['total']}件")
    log.info(f" ヒューリスティック成功: {stats['heuristic']}件")
    log.info(f" LLM成功: {stats['llm']}件")
    log.info(f" 抽出失敗: {stats['failed']}件")
    log.info(f" fetch失敗: {stats['fetch_err']}件")
    success = stats["heuristic"] + stats["llm"]
    rate = (success / stats["total"] * 100) if stats["total"] > 0 else 0
    log.info(f" 成功率: {rate:.1f}%")
    log.info(f"{'='*60}")


if __name__ == "__main__":
    main()
