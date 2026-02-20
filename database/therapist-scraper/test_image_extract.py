#!/usr/bin/env python3
"""
セラピスト画像URL抽出テスト（Haiku）— CSV出力

Usage:
    python test_image_extract.py --ids 3058 3059 12705 12706 14480 14450
    python test_image_extract.py --salon-ids 149 598 649 --per-salon 3
"""

import os, sys, json, logging, argparse, re, csv
from urllib.parse import urljoin
from io import StringIO

import psycopg2, psycopg2.extras
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
sys.path.insert(0, os.path.dirname(__file__))

from html_cache_utils import HtmlCache
from fetch_utils import fetch_page

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
_cache = HtmlCache()


def collect_image_candidates(html: str, base_url: str) -> list[dict]:
    """HTMLから全画像候補を構造化抽出"""
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


def extract_therapist_images(html: str, base_url: str, therapist_name: str = "",
                              salon_name: str = "",
                              model: str = "claude-haiku-4-5-20251001") -> dict:
    """Haiku で画像判定"""
    candidates = collect_image_candidates(html, base_url)
    if not candidates:
        return {"image_urls": [], "reasoning": "画像候補なし",
                "input_tokens": 0, "output_tokens": 0, "candidates_count": 0}

    cand_lines = []
    for i, c in enumerate(candidates):
        line = f"[{i}] {c['url']}"
        if c["alt"]:
            line += f" alt=\"{c['alt']}\""
        if c["class"]:
            line += f" class=\"{c['class']}\""
        if c["width"] or c["height"]:
            line += f" {c['width']}x{c['height']}"
        if c["parent"]:
            line += f" {c['parent']}"
        cand_lines.append(line)

    prompt = f"""このメンズエステのセラピスト個別プロフィールページの画像から、
**セラピスト本人の写真**だけを選んでください。

セラピスト名: {therapist_name or "(不明)"}
サロン名: {salon_name or "(不明)"}
URL: {base_url}

## 画像候補（{len(candidates)}件）
{chr(10).join(cand_lines)}

## 判定ルール
- セラピスト本人の写真のみ選ぶ（顔写真・全身写真・施術写真）
- 除外: ロゴ、バナー、ナビ画像、矢印、ボタン、SNSアイコン、プレースホルダー（spacer/noimage/coming_soon/loading）、他セラピストの写真、背景・装飾、極小画像
- URLパスのキーワード（cast/girl/therapist/staff/photo/profile + 個人ID）を判断材料にする
- 親要素class（profile/cast/detail等）も判断材料
- 最大5枚

## 出力: JSONのみ
```json
{{"image_urls": ["URL1", "URL2"], "reasoning": "理由1文"}}
```"""

    from anthropic import Anthropic
    client = Anthropic()

    try:
        resp = client.messages.create(model=model, max_tokens=500,
                                       messages=[{"role": "user", "content": prompt}])
        result_text = resp.content[0].text.strip()
        in_tok = resp.usage.input_tokens
        out_tok = resp.usage.output_tokens

        json_match = re.search(r"```json\s*(.*?)\s*```", result_text, re.DOTALL)
        if json_match:
            result_text = json_match.group(1)
        js = result_text.find("{")
        je = result_text.rfind("}") + 1
        if js >= 0 and je > js:
            result_text = result_text[js:je]

        data = json.loads(result_text)
        data["input_tokens"] = in_tok
        data["output_tokens"] = out_tok
        data["candidates_count"] = len(candidates)
        return data
    except Exception as e:
        return {"image_urls": [], "reasoning": str(e),
                "input_tokens": 0, "output_tokens": 0, "candidates_count": len(candidates)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", nargs="+", type=int)
    parser.add_argument("--salon-ids", nargs="+", type=int)
    parser.add_argument("--per-salon", type=int, default=3)
    parser.add_argument("--model", default="claude-haiku-4-5-20251001")
    parser.add_argument("--output", default="test_image_extract_result.csv")
    args = parser.parse_args()

    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if args.ids:
        ids_str = ",".join(str(i) for i in args.ids)
        cur.execute(f"""
            SELECT t.id, t.name, t.source_url, t.image_urls, t.salon_id,
                   s.name AS salon_name, s.display_name AS salon_display
            FROM therapists t JOIN salons s ON s.id = t.salon_id
            WHERE t.id IN ({ids_str})
        """)
    elif args.salon_ids:
        ids_str = ",".join(str(i) for i in args.salon_ids)
        cur.execute(f"""
            SELECT t.id, t.name, t.source_url, t.image_urls, t.salon_id,
                   s.name AS salon_name, s.display_name AS salon_display
            FROM therapists t JOIN salons s ON s.id = t.salon_id
            WHERE t.salon_id IN ({ids_str}) AND t.status = 'active'
            ORDER BY t.salon_id, RANDOM()
        """)
    else:
        print("--ids or --salon-ids を指定してください")
        return

    rows = cur.fetchall()

    # per-salon制限
    if args.salon_ids:
        seen_salons = {}
        filtered = []
        for r in rows:
            sid = r["salon_id"]
            if seen_salons.get(sid, 0) < args.per_salon:
                filtered.append(r)
                seen_salons[sid] = seen_salons.get(sid, 0) + 1
        rows = filtered

    print(f"対象: {len(rows)}名\n")

    csv_rows = []
    total_in = 0
    total_out = 0

    for i, row in enumerate(rows):
        tid = row["id"]
        url = row["source_url"]
        name = row["name"] or ""
        salon = row["salon_display"] or row["salon_name"] or ""
        db_imgs = row["image_urls"] or []
        if isinstance(db_imgs, str):
            db_imgs = json.loads(db_imgs)

        print(f"[{i+1}/{len(rows)}] ID={tid} {name} ({salon})")

        html = _cache.load("therapist", tid)
        if not html:
            print(f"  キャッシュなし → fetch...")
            html = fetch_page(url)
            if html:
                _cache.save("therapist", tid, html)
            else:
                print(f"  fetch失敗")
                csv_rows.append({
                    "id": tid, "name": name, "salon": salon,
                    "source_url": url,
                    "db_image_count": len(db_imgs),
                    "db_first_image": db_imgs[0] if db_imgs else "",
                    "haiku_image_count": 0,
                    "haiku_images": "",
                    "reasoning": "fetch失敗",
                    "status": "FETCH_FAIL",
                })
                continue

        result = extract_therapist_images(html, url, therapist_name=name,
                                           salon_name=salon, model=args.model)
        haiku_imgs = result.get("image_urls", [])
        reasoning = result.get("reasoning", "")
        total_in += result.get("input_tokens", 0)
        total_out += result.get("output_tokens", 0)

        # 判定
        if not haiku_imgs:
            status = "NO_IMAGE"
        elif db_imgs and set(haiku_imgs) == set(db_imgs):
            status = "SAME"
        elif db_imgs and set(haiku_imgs) != set(db_imgs):
            status = "CHANGED"
        else:
            status = "NEW"

        print(f"  DB: {len(db_imgs)}枚 → Haiku: {len(haiku_imgs)}枚 [{status}]")
        print(f"  理由: {reasoning}")
        for j, u in enumerate(haiku_imgs[:3]):
            print(f"    [{j}] {u}")

        csv_rows.append({
            "id": tid, "name": name, "salon": salon,
            "source_url": url,
            "db_image_count": len(db_imgs),
            "db_first_image": db_imgs[0] if db_imgs else "",
            "haiku_image_count": len(haiku_imgs),
            "haiku_images": " | ".join(haiku_imgs),
            "reasoning": reasoning,
            "status": status,
        })

    # CSV出力
    out_path = os.path.join(os.path.dirname(__file__), args.output)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=[
            "id", "name", "salon", "source_url",
            "db_image_count", "db_first_image",
            "haiku_image_count", "haiku_images",
            "reasoning", "status",
        ])
        w.writeheader()
        w.writerows(csv_rows)

    cost = total_in * 0.80 / 1e6 + total_out * 4.00 / 1e6
    n = len(rows)
    print(f"\n{'='*60}")
    print(f"結果: {out_path}")
    print(f"対象: {n}件 | 費用: ${cost:.4f}")
    if n > 0:
        print(f"全95,340件推定: ${cost / n * 95340:.2f}")
    print(f"{'='*60}")

    conn.close()


if __name__ == "__main__":
    main()
