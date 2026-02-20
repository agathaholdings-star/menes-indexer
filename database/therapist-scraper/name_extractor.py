#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
セラピスト情報抽出モジュール（Haiku LLM）

セラピスト個別ページのHTMLから、名前・年齢・スリーサイズ・紹介文等を
1回のHaiku API呼び出しで一括抽出する。

方針:
- 常にHaiku LLMで抽出（ヒューリスティック分岐なし）
- 全ページHTML + 候補テキストをプロンプトに投入
- コスト: ~$125 / 92,587件（Haiku 4.5、全ページ版）

Usage:
    from name_extractor import extract_therapist_info

    result = extract_therapist_info(html, salon_name="アロマメゾン", url="https://...")
    # result = {
    #     "name": "水川あすみ",
    #     "age": 23,
    #     "height": 158,
    #     "cup": "D",
    #     "bust": 86,
    #     "waist": 57,
    #     "hip": 85,
    #     "blood_type": "O",
    #     "profile_text": "スレンダーな美人系で...",
    #     "input_tokens": 1600,
    #     "output_tokens": 150,
    # }
"""

import json
import logging
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

# clean_html_for_llm は therapist_scraper.py から借用
try:
    from therapist_scraper import clean_html_for_llm
except ImportError:
    clean_html_for_llm = None

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


def _collect_candidates(html: str) -> dict:
    """ページ内の候補テキストを収集してプロンプト材料にする"""
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

    return {
        "h1": h1_text,
        "h2": h2_text,
        "og_title": og_title,
        "title": title_text,
        "css": css_candidates,
    }


def collect_image_candidates(html: str, base_url: str) -> list[dict]:
    """
    HTMLから全画像候補を構造化抽出。

    <img> タグの src/data-src/data-lazy-src/data-original/srcset と
    CSS background-image を収集し、各候補にURL/alt/class/親要素情報を付与する。
    """
    soup = BeautifulSoup(html, "html.parser")
    candidates = []
    seen_urls = set()

    for img in soup.find_all("img"):
        src = (img.get("src") or img.get("data-src") or img.get("data-lazy-src")
               or img.get("data-original") or "")
        if not src and img.get("srcset"):
            src = img["srcset"].split(",")[0].split()[0]
        if not src or src.startswith("data:"):
            continue

        full_url = urljoin(base_url, src)
        if full_url in seen_urls:
            continue
        seen_urls.add(full_url)

        parent = img.parent
        parent_info = ""
        if parent:
            p_class = " ".join(parent.get("class", []))
            p_id = parent.get("id", "")
            parent_info = f"<{parent.name} class='{p_class}' id='{p_id}'>"

        gp_info = ""
        if parent and parent.parent:
            gp = parent.parent
            gp_class = " ".join(gp.get("class", []))
            gp_id = gp.get("id", "")
            gp_info = f"<{gp.name} class='{gp_class}' id='{gp_id}'>"

        candidates.append({
            "url": full_url,
            "alt": img.get("alt", ""),
            "class": " ".join(img.get("class", [])),
            "width": img.get("width", ""),
            "height": img.get("height", ""),
            "parent": parent_info,
            "grandparent": gp_info,
        })

    for el in soup.find_all(style=re.compile(r"background-image")):
        match = re.search(r"url\(['\"]?(.*?)['\"]?\)", el.get("style", ""))
        if match:
            bg_url = urljoin(base_url, match.group(1))
            if bg_url not in seen_urls:
                seen_urls.add(bg_url)
                candidates.append({
                    "url": bg_url, "alt": "(CSS bg)",
                    "class": " ".join(el.get("class", [])),
                    "width": "", "height": "",
                    "parent": f"<{el.name}>", "grandparent": "",
                })

    return candidates


def _extract_llm_name_only(html: str, url: str, salon_name: str,
                           salon_display: str, model: str = "claude-haiku-4-5-20251001") -> dict | None:
    """名前のみ抽出（後方互換用）"""
    cands = _collect_candidates(html)
    css_text = "\n".join(cands["css"]) if cands["css"] else "(なし)"

    prompt = f"""このメンズエステセラピストのプロフィールページから、セラピストの名前だけを抽出してください。

サロン名: {salon_name}
※サロン名（「{salon_name}」「{salon_display}」）は名前ではありません。絶対に返さないでください。

ページ内の候補テキスト:
- H1: {cands["h1"]}
- H2: {cands["h2"]}
- og:title: {cands["og_title"]}
- title: {cands["title"]}
- CSSセレクタ候補:
{css_text}

## ルール
- セラピスト個人の名前だけを1つ出力
- 年齢・キャッチコピー・肩書き・「NEW FACE」等の装飾は全て除去
- 該当なしなら "NONE"

## 正しい出力例
入力: "PROFILEみみのプロフィール" → みみ
入力: "白石りおNEW FACE" → 白石りお
入力: "高橋里奈 業界初経験 23歳" → 高橋里奈
入力: "REO(23歳)" → REO
入力: "PROFILE琴吹（ことぶき）" → 琴吹
入力: "まゆ(25歳) | 透明感96％" → まゆ
入力: "Mio（ミオ） - ドットエム公式" → Mio
入力: "神のエステ ランキング 巣鴨店" → NONE（これはサロン名）
入力: "セラピストプロフィール" → NONE（これはページタイトル）
入力: "メニュー・料金" → NONE（これはナビゲーション）

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
                "confidence": 0.90,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            }
        return None
    except Exception as e:
        log.warning(f"LLM name extraction error: {e}")
        return None


# ---------------------------------------------------------------------------
# 全フィールド抽出（メインAPI）
# ---------------------------------------------------------------------------

def extract_therapist_info(html: str, salon_name: str = "", salon_display: str = "",
                           url: str = "",
                           model: str = "claude-haiku-4-5-20251001") -> dict | None:
    """
    セラピスト個別ページHTMLから全フィールドを1回のHaiku呼び出しで抽出。

    抽出フィールド: name, age, height, cup, bust, waist, hip,
                   blood_type, profile_text, image_urls

    Args:
        html: ページHTML（フルページ）
        salon_name: サロン名（除外用）
        salon_display: サロン表示名（除外用）
        url: ページURL
        model: LLMモデル名

    Returns:
        {
            "name": "水川あすみ",
            "age": 23,
            "height": 158,
            "cup": "D",
            "bust": 86,
            "waist": 57,
            "hip": 85,
            "blood_type": "O",
            "profile_text": "スレンダーな美人系で...",
            "image_urls": ["https://example.com/photo1.jpg"],
            "input_tokens": 1600,
            "output_tokens": 150,
        }
        or None (抽出失敗)
    """
    # ページ全体を軽量化
    if clean_html_for_llm:
        cleaned = clean_html_for_llm(html, url, max_chars=5000)
    else:
        cleaned = html[:5000]

    # 候補テキストも収集
    cands = _collect_candidates(html)
    css_text = "\n".join(cands["css"]) if cands["css"] else "(なし)"

    # 画像候補を収集
    image_cands = collect_image_candidates(html, url)
    if image_cands:
        img_lines = []
        for i, c in enumerate(image_cands):
            line = f"[{i}] {c['url']}"
            if c["alt"]:
                line += f" alt=\"{c['alt']}\""
            if c["class"]:
                line += f" class=\"{c['class']}\""
            if c["width"] or c["height"]:
                line += f" {c['width']}x{c['height']}"
            if c["parent"]:
                line += f" {c['parent']}"
            img_lines.append(line)
        image_section = f"""
## 画像候補（{len(image_cands)}件）
{chr(10).join(img_lines)}"""
    else:
        image_section = "\n## 画像候補\nなし"

    prompt = f"""このメンズエステセラピストのプロフィールページから情報を抽出してJSON形式で返してください。

サロン名: {salon_name}
※サロン名（「{salon_name}」「{salon_display}」）はセラピストの名前ではありません。

ページ内の候補テキスト:
- H1: {cands["h1"]}
- H2: {cands["h2"]}
- og:title: {cands["og_title"]}
- title: {cands["title"]}
- CSSセレクタ候補:
{css_text}

ページ全体（軽量化済み）:
{cleaned}
{image_section}

## 抽出ルール

### name（必須）
- セラピスト個人の名前だけ。年齢・キャッチコピー・肩書き・「NEW FACE」等の装飾は全て除去
- 正しい出力例:
  "PROFILEみみのプロフィール" → "みみ"
  "白石りおNEW FACE" → "白石りお"
  "REO(23歳)" → "REO"
  "神のエステ ランキング 巣鴨店" → null（これはサロン名）

### age, height, bust, waist, hip
- 数値のみ（単位不要）。ページに記載がなければnull

### cup
- アルファベット1文字（A〜K）。ページに記載がなければnull

### blood_type
- A, B, O, AB のいずれか。ページに記載がなければnull

### profile_text
- セラピストの紹介文（お店からの紹介文、本人の自己紹介、いずれでもOK）
- コース説明・料金・出勤スケジュール・ナビゲーションは含めない
- 200文字以内に要約。ページに紹介文がなければnull

### image_urls
- セラピスト本人の写真URLのみ選ぶ（顔写真・全身写真・施術写真）
- 除外: ロゴ、バナー、ナビ画像、矢印、ボタン、SNSアイコン、プレースホルダー（spacer/noimage/coming_soon/loading）、他セラピストの写真、背景・装飾、極小画像
- URLパスのキーワード（cast/girl/therapist/staff/photo/profile + 個人ID）を判断材料にする
- 親要素class（profile/cast/detail等）も判断材料
- 最大5枚。該当なしなら空配列[]

## 出力形式
JSONのみ出力。余計なテキストは不要。
```json
{{"name":"名前","age":23,"height":158,"cup":"D","bust":86,"waist":57,"hip":85,"blood_type":"O","profile_text":"紹介文...","image_urls":["URL1","URL2"]}}
```"""

    try:
        client = _get_anthropic_client()
        resp = client.messages.create(
            model=model,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        result_text = resp.content[0].text.strip()
        input_tokens = resp.usage.input_tokens
        output_tokens = resp.usage.output_tokens

        # JSON抽出（```json...``` ブロックにも対応）
        json_match = re.search(r"```json\s*(.*?)\s*```", result_text, re.DOTALL)
        if json_match:
            result_text = json_match.group(1)
        # { で始まるJSONを探す
        json_start = result_text.find("{")
        json_end = result_text.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            result_text = result_text[json_start:json_end]

        data = json.loads(result_text)

        # name バリデーション
        name = data.get("name")
        if name:
            name = str(name).strip()
            name = re.sub(r"^[「『\"']+|[」』\"']+$", "", name).strip()
            name = clean_extracted_name(name)
            if not is_valid_name(name, salon_name, salon_display):
                name = None
        data["name"] = name

        # 数値フィールドのクリーニング
        for field in ["age", "height", "bust", "waist", "hip"]:
            val = data.get(field)
            if val is not None:
                try:
                    data[field] = int(val)
                except (ValueError, TypeError):
                    data[field] = None

        # cup クリーニング
        cup = data.get("cup")
        if cup:
            cup = str(cup).strip().upper()
            if len(cup) == 1 and cup in "ABCDEFGHIJK":
                data["cup"] = cup
            else:
                data["cup"] = None

        # blood_type クリーニング
        bt = data.get("blood_type")
        if bt:
            bt = str(bt).strip().upper()
            if bt in ("A", "B", "O", "AB"):
                data["blood_type"] = bt
            else:
                data["blood_type"] = None

        # profile_text クリーニング
        pt = data.get("profile_text")
        if pt:
            pt = str(pt).strip()
            if len(pt) < 5:
                data["profile_text"] = None
            else:
                data["profile_text"] = pt

        # image_urls バリデーション
        imgs = data.get("image_urls")
        if isinstance(imgs, list):
            # 絶対パス化 + 最大5枚
            validated = []
            for img_url in imgs[:5]:
                if isinstance(img_url, str) and img_url.strip():
                    abs_url = urljoin(url, img_url.strip())
                    if abs_url.startswith(("http://", "https://")):
                        validated.append(abs_url)
            data["image_urls"] = validated
        else:
            data["image_urls"] = []

        data["input_tokens"] = input_tokens
        data["output_tokens"] = output_tokens

        return data

    except json.JSONDecodeError as e:
        log.warning(f"JSON parse error: {e} | raw: {result_text[:200]}")
        return None
    except Exception as e:
        log.warning(f"LLM extraction error: {e}")
        return None


# ---------------------------------------------------------------------------
# 後方互換API（名前のみ）
# ---------------------------------------------------------------------------

def extract_name(html: str, salon_name: str = "", salon_display: str = "",
                 url: str = "", learned_selector: str | None = None,
                 use_llm: bool = True,
                 llm_model: str = "claude-haiku-4-5-20251001") -> dict | None:
    """
    名前のみ抽出（後方互換）。新規コードは extract_therapist_info() を使うこと。
    """
    if use_llm:
        return _extract_llm_name_only(html, url, salon_name, salon_display, model=llm_model)
    soup = BeautifulSoup(html, "html.parser")
    return _extract_heuristic(soup, salon_name, salon_display, learned_selector)


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
