#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
セラピスト名前抽出モジュール（学習機能付き）

repair_therapist_names.py の実績ある抽出ロジックを再利用可能なモジュールに切り出し。
ヒューリスティック（CSSセレクタ/H1/H2/og:title/title）→ Haiku LLMフォールバック。

成功時にどのCSS要素から取れたかを返す（source フィールド）。
これをDBに保存すれば次回同じサロンはヒューリスティックで取れる。

Usage:
    from name_extractor import extract_name

    result = extract_name(html, salon_name="アロマメゾン", salon_display="アロマメゾン")
    # result = {
    #     "name": "水川あすみ",
    #     "source": "css:.cast-name h2",
    #     "method": "heuristic",
    #     "confidence": 0.95,
    #     "candidates": [...]
    # }
"""

import logging
import re

from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 除外キーワード
# ---------------------------------------------------------------------------

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

EXCLUDE_EXACT = {
    "名前", "SNSSNS", "SNS", "SCHEDULE", "REVIEW", "REVIEWレビュー",
    "店長コメント", "募集", "あなたにオススメの女の子",
}

# ---------------------------------------------------------------------------
# CSSセレクタ候補（名前が入っている可能性が高い要素）
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# クレンジング & バリデーション
# ---------------------------------------------------------------------------

def clean_extracted_name(text: str) -> str:
    """抽出された名前をクリーニング"""
    text = text.strip()
    # "(XX)" 形式の年齢を除去
    text = re.sub(r"\s*[\(（]\d{1,2}[\)）]\s*$", "", text)
    # "(次回..." などのスケジュール情報を除去
    text = re.sub(r"\s*[\(（]次回.*$", "", text)
    # 【】内のサロン名を除去
    text = re.sub(r"【[^】]+】$", "", text)
    # "NEW FACE" 等のプレフィックス除去
    text = re.sub(r"^(NEW\s*FACE|新人)\s*", "", text, flags=re.IGNORECASE)
    return text.strip()


def is_valid_name(text: str, salon_name: str, salon_display: str) -> bool:
    """名前として妥当かチェック"""
    text = text.strip()
    if not text or len(text) < 1 or len(text) > 20:
        return False
    if text in EXCLUDE_EXACT:
        return False
    if text == salon_name or text == salon_display:
        return False
    if salon_name and len(salon_name) >= 3 and salon_name in text:
        return False
    if salon_display and len(salon_display) >= 3 and salon_display in text:
        return False
    for kw in EXCLUDE_KEYWORDS:
        if kw in text:
            return False
    if text.startswith("http") or "/" in text:
        return False
    if re.fullmatch(r"[\d\s\(\)（）]+", text):
        return False
    return True


# ---------------------------------------------------------------------------
# ヒューリスティック抽出
# ---------------------------------------------------------------------------

def _extract_heuristic(soup, salon_name: str, salon_display: str,
                        extra_selector: str | None = None) -> dict | None:
    """
    CSSセレクタ → H1/H2 → og:title → title の優先順で名前を抽出。

    Returns:
        {"name": str, "source": str, "method": "heuristic"} or None
    """
    candidates = []

    # 0. サロン固有の学習済みセレクタ（最優先）
    if extra_selector:
        try:
            el = soup.select_one(extra_selector)
            if el:
                text = clean_extracted_name(el.get_text(strip=True))
                candidates.append(("learned:" + extra_selector, text))
                if is_valid_name(text, salon_name, salon_display):
                    return {"name": text, "source": "learned:" + extra_selector,
                            "method": "heuristic", "confidence": 0.98}
        except Exception:
            pass

    # 1. CSSセレクタ候補
    for selector in NAME_CSS_SELECTORS:
        try:
            el = soup.select_one(selector)
        except Exception:
            continue
        if el:
            text = clean_extracted_name(el.get_text(strip=True))
            candidates.append(("css:" + selector, text))
            if is_valid_name(text, salon_name, salon_display):
                return {"name": text, "source": "css:" + selector,
                        "method": "heuristic", "confidence": 0.95}

    # 2. H1/H2（サロン名除外）
    for tag in ["h1", "h2"]:
        for el in soup.find_all(tag):
            text = clean_extracted_name(el.get_text(strip=True))
            candidates.append((tag, text))
            if is_valid_name(text, salon_name, salon_display):
                return {"name": text, "source": tag,
                        "method": "heuristic", "confidence": 0.85}

    # 3. og:title
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        og_text = og["content"].strip()
        for delim in ["|", "｜", "-", "–", "—", "/"]:
            if delim in og_text:
                candidate = clean_extracted_name(og_text.split(delim)[0].strip())
                candidates.append(("og:title", candidate))
                if is_valid_name(candidate, salon_name, salon_display):
                    return {"name": candidate, "source": "og:title",
                            "method": "heuristic", "confidence": 0.80}
        cleaned_og = clean_extracted_name(og_text)
        candidates.append(("og:title_full", cleaned_og))
        if is_valid_name(cleaned_og, salon_name, salon_display):
            return {"name": cleaned_og, "source": "og:title",
                    "method": "heuristic", "confidence": 0.75}

    # 4. titleタグ
    title_el = soup.find("title")
    if title_el:
        title_text = title_el.get_text(strip=True)
        for delim in ["|", "｜", "-", "–", "—", "/"]:
            if delim in title_text:
                candidate = clean_extracted_name(title_text.split(delim)[0].strip())
                candidates.append(("title", candidate))
                if is_valid_name(candidate, salon_name, salon_display):
                    return {"name": candidate, "source": "title",
                            "method": "heuristic", "confidence": 0.70}

    return None


# ---------------------------------------------------------------------------
# LLMフォールバック
# ---------------------------------------------------------------------------

_anthropic_client = None


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        from anthropic import Anthropic
        _anthropic_client = Anthropic()
    return _anthropic_client


def _extract_llm(html: str, url: str, salon_name: str,
                  salon_display: str, model: str = "claude-haiku-4-5-20251001") -> dict | None:
    """
    Haiku LLMで名前を抽出。

    Returns:
        {"name": str, "source": "llm", "method": "haiku", "confidence": 0.60,
         "input_tokens": int, "output_tokens": int} or None
    """
    from therapist_scraper import clean_html_for_llm
    cleaned = clean_html_for_llm(html, url, max_chars=5000)

    # ページから候補テキストを事前抽出してプロンプトに含める
    soup = BeautifulSoup(html, "html.parser")
    h1_text = ""
    h1_el = soup.find("h1")
    if h1_el:
        h1_text = h1_el.get_text(strip=True)[:100]
    h2_text = ""
    h2_el = soup.find("h2")
    if h2_el:
        h2_text = h2_el.get_text(strip=True)[:100]
    og_title = ""
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        og_title = og["content"].strip()[:100]
    title_text = ""
    title_el = soup.find("title")
    if title_el:
        title_text = title_el.get_text(strip=True)[:100]

    css_candidates = []
    for selector in NAME_CSS_SELECTORS[:10]:
        try:
            el = soup.select_one(selector)
            if el:
                t = el.get_text(strip=True)[:50]
                if t:
                    css_candidates.append(f"{selector}: {t}")
        except Exception:
            pass
    css_text = "\n".join(css_candidates) if css_candidates else "(なし)"

    prompt = f"""このメンズエステセラピストのプロフィールページから、セラピストの名前だけを抽出してください。

サロン名: {salon_name}
※サロン名（「{salon_name}」「{salon_display}」）は名前ではありません。絶対に返さないでください。

ページ内の候補テキスト:
- H1: {h1_text}
- H2: {h2_text}
- og:title: {og_title}
- title: {title_text}
- CSSセレクタ候補:
{css_text}

ルール:
- カタカナ・ひらがな・漢字の人名のみ出力
- 年齢・キャッチコピー・肩書きは除去（例: "高橋里奈 業界初経験 23歳" → "高橋里奈"）
- 該当なしなら "NONE"

セラピスト名:"""

    try:
        client = _get_anthropic_client()
        resp = client.messages.create(
            model=model,
            max_tokens=50,
            messages=[{"role": "user", "content": prompt}],
        )
        result_text = resp.content[0].text.strip()
        input_tokens = resp.usage.input_tokens
        output_tokens = resp.usage.output_tokens

        if "NONE" in result_text.upper():
            return None

        result_text = result_text.split("\n")[0].strip()
        result_text = re.sub(r"^[「『\"']+|[」』\"']+$", "", result_text).strip()
        result_text = clean_extracted_name(result_text)

        if is_valid_name(result_text, salon_name, salon_display):
            return {
                "name": result_text,
                "source": "llm",
                "method": "haiku",
                "confidence": 0.60,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            }
        return None
    except Exception as e:
        log.warning(f"LLM name extraction error: {e}")
        return None


# ---------------------------------------------------------------------------
# メイン API
# ---------------------------------------------------------------------------

def extract_name(html: str, salon_name: str = "", salon_display: str = "",
                 url: str = "", learned_selector: str | None = None,
                 use_llm: bool = True,
                 llm_model: str = "claude-haiku-4-5-20251001") -> dict | None:
    """
    セラピスト個別ページHTMLから名前を抽出する。

    ヒューリスティック（CSSセレクタ/H1/H2/og:title/title）で試行し、
    失敗した場合はHaiku LLMにフォールバックする。

    Args:
        html: ページHTML
        salon_name: サロン名（除外用）
        salon_display: サロン表示名（除外用）
        url: ページURL（LLMフォールバック用）
        learned_selector: 学習済みCSSセレクタ（最優先で試行）
        use_llm: LLMフォールバックを使うか
        llm_model: LLMモデル名

    Returns:
        {
            "name": "水川あすみ",
            "source": "css:.cast-name h2" | "h1" | "og:title" | "title" | "llm" | "learned:...",
            "method": "heuristic" | "haiku",
            "confidence": 0.95,
            "input_tokens": int (LLM使用時のみ),
            "output_tokens": int (LLM使用時のみ),
        }
        or None (抽出失敗)
    """
    soup = BeautifulSoup(html, "html.parser")

    # 1. ヒューリスティック
    result = _extract_heuristic(soup, salon_name, salon_display, learned_selector)
    if result:
        return result

    # 2. LLMフォールバック
    if use_llm:
        return _extract_llm(html, url, salon_name, salon_display, model=llm_model)

    return None


def get_candidates(html: str, salon_name: str = "", salon_display: str = "") -> list[dict]:
    """
    デバッグ/診断用: ページ内の全候補テキストをリストで返す。

    Returns:
        [{"source": "css:.cast-name", "text": "水川あすみ", "valid": True}, ...]
    """
    soup = BeautifulSoup(html, "html.parser")
    candidates = []

    for selector in NAME_CSS_SELECTORS:
        try:
            el = soup.select_one(selector)
            if el:
                text = clean_extracted_name(el.get_text(strip=True))
                if text:
                    candidates.append({
                        "source": "css:" + selector,
                        "text": text,
                        "valid": is_valid_name(text, salon_name, salon_display),
                    })
        except Exception:
            pass

    for tag in ["h1", "h2"]:
        for el in soup.find_all(tag):
            text = clean_extracted_name(el.get_text(strip=True))
            if text:
                candidates.append({
                    "source": tag,
                    "text": text,
                    "valid": is_valid_name(text, salon_name, salon_display),
                })

    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        text = og["content"].strip()
        candidates.append({
            "source": "og:title",
            "text": text,
            "valid": is_valid_name(clean_extracted_name(text), salon_name, salon_display),
        })

    title_el = soup.find("title")
    if title_el:
        text = title_el.get_text(strip=True)
        candidates.append({
            "source": "title",
            "text": text,
            "valid": is_valid_name(clean_extracted_name(text), salon_name, salon_display),
        })

    return candidates
