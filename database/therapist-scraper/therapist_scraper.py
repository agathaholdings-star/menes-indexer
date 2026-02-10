#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
セラピストスクレイパー（LLMベース）
サロン公式サイトからセラピスト在籍情報を自動抽出

使い方:
  # テスト（3サロン、各サロン最大5人）
  python therapist_scraper.py

  # 特定サロン1件
  python therapist_scraper.py --url https://viccaplus.net/ --name "Vicca+plus."

  # 全セラピスト取得（制限なし）
  python therapist_scraper.py --url https://viccaplus.net/ --max-therapists 0
"""

import os
import re
import json
import time
import sqlite3
import csv
import argparse
import requests
from bs4 import BeautifulSoup, Comment
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv
from anthropic import Anthropic

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

REQUEST_DELAY = 0.5  # リクエスト間隔（秒）
LLM_MODEL = "claude-haiku-4-5-20251001"


# =============================================================================
# HTML処理
# =============================================================================

def fetch_page(url, timeout=15):
    """ページを取得"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding
        return resp.text
    except Exception as e:
        print(f"    ⚠ fetch失敗: {url} ({e})")
        return None


def clean_html_for_llm(html, base_url, max_chars=15000):
    """HTMLをLLM向けに軽量化（テキスト+リンクのみ保持）"""
    soup = BeautifulSoup(html, 'html.parser')

    # 不要な要素を除去
    for tag in soup(['script', 'style', 'noscript', 'iframe', 'svg',
                     'meta', 'link', 'header', 'footer', 'nav']):
        tag.decompose()
    for comment in soup.find_all(string=lambda s: isinstance(s, Comment)):
        comment.extract()

    # リンクをマークダウン形式に
    for a in soup.find_all('a', href=True):
        href = urljoin(base_url, a['href'])
        text = a.get_text(strip=True)
        if text and href.startswith('http'):
            a.replace_with(f"[{text}]({href})")

    # imgのsrcを保持
    for img in soup.find_all('img'):
        src = img.get('src') or img.get('srcset', '').split(',')[0].split()[0] or img.get('data-src') or img.get('data-lazy-src') or ''
        if src:
            src = urljoin(base_url, src)
            alt = img.get('alt', '')
            img.replace_with(f"[IMG:{alt}]({src})")
        else:
            img.decompose()

    text = soup.get_text(separator='\n')
    # 空行整理
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    text = '\n'.join(lines)

    if len(text) > max_chars:
        text = text[:max_chars] + "\n[...truncated...]"

    return text


def extract_links_with_context(html, base_url):
    """HTMLからリンクをテキストコンテキスト付きで抽出"""
    soup = BeautifulSoup(html, 'html.parser')
    domain = urlparse(base_url).netloc
    links = []
    seen = set()

    for a in soup.find_all('a', href=True):
        href = urljoin(base_url, a['href'])
        parsed = urlparse(href)

        # 同一ドメインのみ、fragment/mailtoは除外
        if parsed.netloc != domain:
            continue
        if parsed.scheme not in ('http', 'https'):
            continue
        if href in seen:
            continue
        seen.add(href)

        text = a.get_text(strip=True)
        # 親要素のテキストもコンテキストとして取得
        parent_text = ''
        if a.parent:
            parent_text = a.parent.get_text(strip=True)[:100]

        links.append({
            "text": text,
            "url": href,
            "context": parent_text
        })

    return links


# =============================================================================
# LLMベースの抽出ロジック
# =============================================================================

class TherapistScraper:
    def __init__(self):
        self.client = Anthropic()

    def _ask_llm(self, prompt, max_tokens=500):
        """Claude Haiku呼び出し"""
        resp = self.client.messages.create(
            model=LLM_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}]
        )
        return resp.content[0].text.strip()

    def _parse_json(self, text):
        """LLM出力からJSONを抽出"""
        # コードブロックの除去
        text = re.sub(r'^```\w*\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # 配列/オブジェクト部分だけ抽出
            match = re.search(r'[\[{].*[\]}]', text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    pass
        return None

    # ----- Step 1: セラピスト一覧ページの発見 -----

    def find_therapist_list_url(self, salon_url, html):
        """サロンのトップページからセラピスト一覧ページURLを特定"""
        links = extract_links_with_context(html, salon_url)

        if not links:
            return None

        # キーワードで候補を絞る
        keywords = ['therapist', 'cast', 'staff', 'girl',
                     'セラピスト', 'キャスト', 'スタッフ', '在籍', 'ガール']
        candidates = [
            l for l in links
            if any(kw in (l['text'] + l['url'] + l['context']).lower() for kw in keywords)
        ]

        # 候補がなければ全リンクをLLMに判断させる
        search_links = candidates if candidates else links[:80]

        links_text = "\n".join(
            f"- [{l['text']}]({l['url']})" for l in search_links if l['text']
        )

        if not links_text:
            return None

        result = self._ask_llm(f"""メンズエステサロンのウェブサイトのリンク一覧です。
セラピスト（キャスト/スタッフ）の一覧ページへのリンクURLを1つだけ選んでください。
該当するリンクがなければ「NONE」と答えてください。

サイト: {salon_url}

リンク:
{links_text}

回答（URLのみ）:""", max_tokens=200)

        if 'NONE' in result.upper():
            return None

        url_match = re.search(r'https?://[^\s<>"\']+', result)
        return url_match.group(0).rstrip('.,)') if url_match else None

    # ----- Step 2: セラピスト個別ページURLの抽出 -----

    def _extract_list_page_images(self, list_url, html):
        """一覧ページからセラピスト名→画像URLのマッピングを抽出"""
        soup = BeautifulSoup(html, 'html.parser')
        name_to_img = {}
        for img in soup.find_all('img'):
            name = img.get('alt') or img.get('title') or ''
            name = name.strip()
            if not name:
                continue
            srcset = img.get('srcset', '')
            srcset_url = srcset.split(',')[0].split()[0] if srcset.strip() else ''
            src = img.get('src') or srcset_url or img.get('data-src') or ''
            if not src:
                continue
            src = urljoin(list_url, src)
            # ロゴ・アイコン等を除外（cast/therapist/girl等を含むパスか、名前が日本語）
            if any(kw in src.lower() for kw in ['cast', 'therapist', 'girl', 'staff', 'item']):
                name_to_img.setdefault(name, src)
            elif re.search(r'[\u3040-\u9fff]', name) and 'logo' not in src.lower():
                name_to_img.setdefault(name, src)
        return name_to_img

    def extract_therapist_urls(self, list_url, html):
        """一覧ページから個々のセラピストプロフィールURLを抽出"""
        # 一覧ページから画像URLを事前抽出
        name_to_img = self._extract_list_page_images(list_url, html)

        # リンク一覧を抽出してLLMに渡す（HTML全体を渡すと切り詰めで情報欠落するため）
        links = extract_links_with_context(html, list_url)

        # セラピスト関連のリンク候補を優先抽出
        profile_keywords = ['profile', 'staff', 'cast', 'therapist', 'girl',
                           'item', 'detail', 'member']
        candidates = [
            l for l in links
            if any(kw in l['url'].lower() for kw in profile_keywords)
        ]

        # 候補が少なすぎる場合は全リンクを使う
        if len(candidates) < 3:
            search_links = links
        else:
            search_links = candidates

        links_text = "\n".join(
            f"- [{l['text']}]({l['url']})" + (f" ({l['context'][:50]})" if l['context'] and l['context'] != l['text'] else "")
            for l in search_links if l['url']
        )

        if not links_text:
            # リンクが取れなかった場合はHTMLフォールバック
            cleaned = clean_html_for_llm(html, list_url)
            links_text = cleaned

        result = self._ask_llm(f"""このメンズエステサロンの「セラピスト一覧」ページから、
個々のセラピストのプロフィールページURLをすべて抽出してください。

ページURL: {list_url}

ページ内のリンク一覧:
{links_text}

JSON配列で出力。形式: [{{"name": "名前", "url": "URL"}}]
セラピスト名が不明なら空文字列でOK。該当なしなら空配列 [] を返してください。

```json""", max_tokens=8000)

        data = self._parse_json(result)
        if isinstance(data, list):
            # url必須、重複除去
            seen = set()
            unique = []
            for entry in data:
                url = entry.get('url', '')
                if url and url.startswith('http') and url not in seen:
                    seen.add(url)
                    # 一覧ページの画像URLをマージ
                    name = entry.get('name', '')
                    if name and name in name_to_img:
                        entry['list_image_url'] = name_to_img[name]
                    unique.append(entry)
            return unique
        return []

    # ----- Step 3: セラピスト詳細データの抽出 -----

    def extract_therapist_data(self, therapist_url, html):
        """セラピスト詳細ページから構造化データを抽出"""
        cleaned = clean_html_for_llm(html, therapist_url, max_chars=10000)

        result = self._ask_llm(f"""このメンズエステセラピストのプロフィールページから情報を抽出してください。

URL: {therapist_url}

内容:
{cleaned}

JSON形式で出力（該当なしのフィールドはnull）:
```json
{{
  "name": "名前",
  "age": 年齢(数値),
  "height": 身長cm(数値),
  "bust": バスト(数値),
  "waist": ウエスト(数値),
  "hip": ヒップ(数値),
  "blood_type": "血液型",
  "image_urls": ["画像URL1"],
  "profile_text": "プロフィール要約(100字以内)"
}}
```

```json""", max_tokens=800)

        data = self._parse_json(result)
        if isinstance(data, dict):
            data['source_url'] = therapist_url
            return data
        return None

    # ----- Step 4: ページネーション検出 -----

    def find_next_pages(self, list_url, html):
        """一覧ページのページネーションURLを検出"""
        links = extract_links_with_context(html, list_url)
        domain = urlparse(list_url).netloc

        page_urls = set()
        for l in links:
            url = l['url']
            if urlparse(url).netloc != domain:
                continue
            # page=2, /page/2, ?p=2 等
            if re.search(r'[?&]page=\d+|/page/\d+|[?&]p=\d+', url):
                page_urls.add(url)
            # 「次へ」「next」等のリンクテキスト
            if re.search(r'次|next|>>|›', l['text'], re.IGNORECASE):
                page_urls.add(url)

        # 現在のURLは除外
        page_urls.discard(list_url)
        return sorted(page_urls)

    # ----- メイン処理 -----

    def scrape_salon(self, salon_url, salon_name="", max_therapists=5):
        """
        サロン1件分のセラピストデータを取得

        Args:
            salon_url: サロン公式URL
            salon_name: サロン名（表示用）
            max_therapists: 最大取得人数（0=無制限）
        """
        print(f"\n{'='*60}")
        print(f" {salon_name or salon_url}")
        print(f"{'='*60}")

        # Step 1: トップページ取得
        print(f"  [1/3] トップページ取得...")
        html = fetch_page(salon_url)
        if not html:
            return []

        # Step 2: セラピスト一覧ページを発見
        print(f"  [2/3] セラピスト一覧ページを探索...")
        list_url = self.find_therapist_list_url(salon_url, html)
        if not list_url:
            print(f"  ✗ 一覧ページが見つかりません")
            return []
        print(f"  → {list_url}")

        time.sleep(REQUEST_DELAY)

        # 一覧ページ取得
        if list_url.rstrip('/') != salon_url.rstrip('/'):
            list_html = fetch_page(list_url)
            if not list_html:
                return []
        else:
            list_html = html

        # Step 3: セラピスト個別URL抽出
        print(f"  [3/3] セラピスト情報を抽出...")
        entries = self.extract_therapist_urls(list_url, list_html)

        # ページネーション対応（最大5ページ）
        next_pages = self.find_next_pages(list_url, list_html)
        for page_url in next_pages[:5]:
            time.sleep(REQUEST_DELAY)
            page_html = fetch_page(page_url)
            if page_html:
                more = self.extract_therapist_urls(page_url, page_html)
                entries.extend(more)

        # 重複除去
        seen = set()
        unique = []
        for e in entries:
            if e['url'] not in seen:
                seen.add(e['url'])
                unique.append(e)
        entries = unique

        # max_therapists制限
        if max_therapists > 0:
            entries = entries[:max_therapists]

        print(f"  → {len(entries)}名のセラピストを検出")

        # 各セラピストの詳細取得
        therapists = []
        for i, entry in enumerate(entries):
            name_hint = entry.get('name', '?')
            print(f"  [{i+1}/{len(entries)}] {name_hint}")

            time.sleep(REQUEST_DELAY)
            t_html = fetch_page(entry['url'])
            if not t_html:
                continue

            data = self.extract_therapist_data(entry['url'], t_html)
            if data:
                # LLMが画像URLを取れなかった場合、一覧ページの画像をフォールバック
                imgs = data.get('image_urls') or []
                if not imgs and entry.get('list_image_url'):
                    data['image_urls'] = [entry['list_image_url']]
                therapists.append(data)
                n = data.get('name', '?')
                a = data.get('age', '?')
                h = data.get('height', '?')
                sizes = f"B{data.get('bust','?')}/W{data.get('waist','?')}/H{data.get('hip','?')}"
                print(f"       → {n} ({a}歳, {h}cm, {sizes})")
            else:
                print(f"       → 抽出失敗")

        print(f"\n  完了: {len(therapists)}/{len(entries)}名")
        return therapists


# =============================================================================
# DB・CSV出力
# =============================================================================

def init_db(db_path):
    """セラピストDB初期化"""
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS therapist (
        therapist_id INTEGER PRIMARY KEY AUTOINCREMENT,
        salon_url TEXT NOT NULL,
        salon_name TEXT,
        name TEXT,
        age INTEGER,
        height INTEGER,
        bust INTEGER,
        waist INTEGER,
        hip INTEGER,
        blood_type TEXT,
        image_urls TEXT,
        profile_text TEXT,
        source_url TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')

    conn.commit()
    return conn


def save_therapists(conn, salon_url, salon_name, therapists):
    """セラピストデータをDBに保存"""
    c = conn.cursor()
    saved = 0

    for t in therapists:
        try:
            c.execute('''INSERT OR REPLACE INTO therapist (
                salon_url, salon_name, name, age, height,
                bust, waist, hip, blood_type,
                image_urls, profile_text, source_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
                salon_url,
                salon_name,
                t.get('name'),
                t.get('age'),
                t.get('height'),
                t.get('bust'),
                t.get('waist'),
                t.get('hip'),
                t.get('blood_type'),
                json.dumps(t.get('image_urls') or [], ensure_ascii=False),
                t.get('profile_text'),
                t.get('source_url'),
            ))
            saved += 1
        except Exception as e:
            print(f"    ⚠ DB保存エラー: {e}")

    conn.commit()
    return saved


def export_csv(db_path):
    """DBをCSV出力"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute('SELECT * FROM therapist ORDER BY salon_name, therapist_id').fetchall()

    csv_path = db_path.replace('.db', '.csv')
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        if rows:
            writer.writerow(rows[0].keys())
            for row in rows:
                writer.writerow(tuple(row))

    conn.close()
    print(f"  CSV出力: {csv_path} ({len(rows)}件)")
    return csv_path


# =============================================================================
# メイン
# =============================================================================

# デフォルトのテスト用サロン
DEFAULT_TEST_SALONS = [
    {"url": "https://viccaplus.net/", "name": "Vicca+plus."},
    {"url": "https://bellee-spa.com/", "name": "Belle E"},
    {"url": "https://organicspa.jp/", "name": "Organic SPA"},
]


def main():
    parser = argparse.ArgumentParser(description='セラピストスクレイパー（LLMベース）')
    parser.add_argument('--url', type=str, help='サロン公式URL（指定時は1件のみ処理）')
    parser.add_argument('--name', type=str, default='', help='サロン名（表示用）')
    parser.add_argument('--max-therapists', type=int, default=5,
                        help='サロンあたりの最大取得人数（0=無制限、デフォルト=5）')
    parser.add_argument('--db', type=str,
                        default=os.path.join(os.path.dirname(__file__), 'therapist.db'),
                        help='出力DBパス')
    args = parser.parse_args()

    # 対象サロン
    if args.url:
        salons = [{"url": args.url, "name": args.name}]
    else:
        salons = DEFAULT_TEST_SALONS
        print(f"テストモード: {len(salons)}サロン, 各最大{args.max_therapists}名")

    # DB初期化
    conn = init_db(args.db)
    scraper = TherapistScraper()

    total = 0
    for salon in salons:
        therapists = scraper.scrape_salon(
            salon['url'],
            salon['name'],
            max_therapists=args.max_therapists
        )
        saved = save_therapists(conn, salon['url'], salon['name'], therapists)
        total += saved
        print(f"  → DB保存: {saved}名")

    conn.close()

    print(f"\n{'='*60}")
    print(f" 全完了: 合計 {total}名")
    print(f" DB: {args.db}")
    print(f"{'='*60}")

    export_csv(args.db)


if __name__ == '__main__':
    main()
