#!/usr/bin/env python3
"""v2と同じ20件に対して、ページ全体をHaikuに渡して名前抽出する比較テスト"""

import os, sys, time, re, logging
import psycopg2, psycopg2.extras
from dotenv import load_dotenv
from bs4 import BeautifulSoup

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
sys.path.insert(0, os.path.dirname(__file__))

from fetch_utils import fetch_page
from html_cache_utils import HtmlCache
from therapist_scraper import clean_html_for_llm
from name_extractor import NAME_CSS_SELECTORS, clean_extracted_name, is_valid_name

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

DB_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
_cache = HtmlCache()

TARGET_IDS = [17747,29806,37001,17334,17650,25541,45110,16950,18115,37066,
              21129,10219,5172,11329,21545,3432,45784,30648,29573,37904]


def extract_name_fullpage(html, url, salon_name, salon_display):
    """ページ全体(軽量化済み5000文字) + 候補テキストをHaikuに渡す"""
    from anthropic import Anthropic
    client = Anthropic()

    cleaned = clean_html_for_llm(html, url, max_chars=5000)

    # 候補テキストも併記
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    h1_text = h1.get_text(strip=True)[:100] if h1 else ""
    h2 = soup.find("h2")
    h2_text = h2.get_text(strip=True)[:100] if h2 else ""
    og = soup.find("meta", property="og:title")
    og_text = og["content"].strip()[:100] if og and og.get("content") else ""
    title = soup.find("title")
    title_text = title.get_text(strip=True)[:100] if title else ""

    css_cands = []
    for sel in NAME_CSS_SELECTORS[:10]:
        try:
            el = soup.select_one(sel)
            if el:
                t = el.get_text(strip=True)[:50]
                if t:
                    css_cands.append(f"{sel}: {t}")
        except:
            pass
    css_text = "\n".join(css_cands) if css_cands else "(なし)"

    prompt = f"""このメンズエステセラピストのプロフィールページから、セラピストの名前だけを抽出してください。

サロン名: {salon_name}
※サロン名（「{salon_name}」「{salon_display}」）は名前ではありません。絶対に返さないでください。

ページ内の候補テキスト:
- H1: {h1_text}
- H2: {h2_text}
- og:title: {og_text}
- title: {title_text}
- CSSセレクタ候補:
{css_text}

ページ全体（軽量化済み）:
{cleaned}

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

    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=50,
        messages=[{"role": "user", "content": prompt}],
    )
    result = resp.content[0].text.strip()
    input_tokens = resp.usage.input_tokens
    output_tokens = resp.usage.output_tokens

    if "NONE" in result.upper():
        return None, input_tokens, output_tokens

    result = result.split("\n")[0].strip()
    result = re.sub(r"^[「『\"']+|[」』\"']+$", "", result).strip()
    result = clean_extracted_name(result)

    if is_valid_name(result, salon_name, salon_display):
        return result, input_tokens, output_tokens
    return None, input_tokens, output_tokens


def main():
    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    ids_str = ",".join(str(i) for i in TARGET_IDS)
    cur.execute(f"""
        SELECT t.id, t.name, t.source_url, t.salon_id,
               s.name AS salon_name, s.display_name AS salon_display
        FROM therapists t
        JOIN salons s ON s.id = t.salon_id
        WHERE t.id IN ({ids_str})
        ORDER BY ARRAY_POSITION(ARRAY[{ids_str}], t.id::int)
    """)
    rows = cur.fetchall()

    total_input = 0
    total_output = 0
    results = []

    for i, row in enumerate(rows):
        tid = row["id"]
        current = row["name"]
        url = row["source_url"]
        sn = row["salon_name"] or ""
        sd = row["salon_display"] or ""

        html = _cache.load("therapist", tid)
        if not html:
            html = fetch_page(url)
            if html:
                _cache.save("therapist", tid, html)
            else:
                log.warning(f"[{i+1}/20] ID={tid} fetch失敗")
                results.append((tid, sn, current, "", url, "FETCH_ERR"))
                continue
            time.sleep(0.3)

        name, inp, out = extract_name_fullpage(html, url, sn, sd)
        total_input += inp
        total_output += out

        if name:
            status = "OK" if name == current else ("FIXED" if current in (sn, sd, "PROFILE", "profile") else "CHANGED")
            log.info(f"[{i+1}/20] ID={tid} 「{current}」→「{name}」[{status}]")
            results.append((tid, sn, current, name, url, status))
        else:
            log.warning(f"[{i+1}/20] ID={tid} 「{current}」→ 抽出失敗")
            results.append((tid, sn, current, "", url, "FAILED"))

    # CSV出力
    csv_path = "/Users/agatha/Desktop/haiku_name_extract_test_v3_fullpage.csv"
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("ID,salon_name,current_name,extracted,source_url,status\n")
        for tid, sn, cur_name, ext, url, st in results:
            f.write(f"{tid},{sn},{cur_name},{ext},{url},{st}\n")

    success = sum(1 for r in results if r[5] in ("OK", "CHANGED", "FIXED"))
    failed = sum(1 for r in results if r[5] == "FAILED")
    cost = total_input * 0.80 / 1e6 + total_output * 4.00 / 1e6
    avg_input = total_input / len(rows) if rows else 0

    print(f"\n{'='*60}")
    print(f" 全ページ版テスト結果")
    print(f"{'='*60}")
    print(f"  成功: {success}/20  失敗: {failed}/20")
    print(f"  入力トークン合計: {total_input:,}  (1件平均: {avg_input:.0f})")
    print(f"  出力トークン合計: {total_output:,}")
    print(f"  テスト費用: ${cost:.4f}")
    print(f"  全92,587件推定: ${cost / 20 * 92587:.2f}")
    print(f"  CSV: {csv_path}")
    print(f"{'='*60}")

    conn.close()

if __name__ == "__main__":
    main()
