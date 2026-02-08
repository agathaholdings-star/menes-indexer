#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
公式サイトの<title>タグからサロン名カタカナを抽出する。
Claude Haiku推測よりも正確な「店が使ってる正式読み」を取得。

パイプライン:
  1. official_url から <title> を取得
  2. 正規表現でカタカナ名を抽出（〜カナ〜, （カナ）, 【カナ】, -カナ- 等）
  3. 取れなかった場合のみ Claude Haiku にフォールバック（titleを入力として渡す）
  4. 結果をDB更新 or レポート出力
"""

import re
import sqlite3
import requests
from bs4 import BeautifulSoup
import time
import os
from dotenv import load_dotenv

load_dotenv()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}

DB_PATH = '/Users/agatha/Desktop/project/menethe-indexer/database/poc.db'

# --- カタカナ文字クラス ---
# カタカナ + 長音 + 中黒 + スペース
KANA_CHAR = r'[ァ-ヶー・\s　]'
KANA_BLOCK = rf'{KANA_CHAR}{{2,}}'  # 2文字以上のカタカナブロック

# 半角カナ → 全角カナ変換テーブル
HALFWIDTH_KANA = str.maketrans(
    'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ',
    'ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン゛゜'
)

def normalize_kana(text):
    """半角カナを全角に、濁点・半濁点を結合"""
    text = text.translate(HALFWIDTH_KANA)
    # 濁点結合: カ゛→ガ 等
    text = re.sub(r'([カキクケコサシスセソタチツテトハヒフヘホ])゛',
                  lambda m: chr(ord(m.group(1)) + 1), text)
    # 半濁点結合: ハ゜→パ 等
    text = re.sub(r'([ハヒフヘホ])゜',
                  lambda m: chr(ord(m.group(1)) + 2), text)
    return text


def fetch_title(url, timeout=10):
    """URLから<title>タグの内容を取得。半角カナは全角に正規化。"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        # エンコーディング推定
        resp.encoding = resp.apparent_encoding or 'utf-8'
        soup = BeautifulSoup(resp.text, 'html.parser')
        title_tag = soup.find('title')
        title_text = None
        if title_tag:
            title_text = title_tag.get_text(strip=True)
        else:
            # titleがなければog:titleを試す
            og_title = soup.find('meta', property='og:title')
            if og_title:
                title_text = og_title.get('content', '').strip()
        if title_text:
            return normalize_kana(title_text)
        return None
    except Exception as e:
        return f"[ERROR] {e}"


def extract_kana_from_title(title):
    """
    titleからカタカナ店名を正規表現で抽出。
    複数パターンを優先順位付きで試す。

    Returns: (kana, pattern_name) or (None, None)
    """
    if not title or title.startswith('[ERROR]'):
        return None, None

    patterns = [
        # パターン1: 〜カタカナ〜 (波ダッシュ囲み)
        (rf'[〜~]({KANA_BLOCK})[〜~]', 'wave_dash'),

        # パターン2: （カタカナ） (全角括弧)
        (rf'（({KANA_BLOCK})）', 'fullwidth_paren'),

        # パターン3: (カタカナ) (半角括弧)
        (rf'\(({KANA_BLOCK})\)', 'halfwidth_paren'),

        # パターン4: 【カタカナ】 (隅付き括弧 - カタカナのみの場合)
        (rf'【({KANA_BLOCK})】', 'square_bracket'),

        # パターン5: 「カタカナ」 (鉤括弧)
        (rf'「({KANA_BLOCK})」', 'kakko'),

        # パターン6: 『カタカナ』 (二重鉤括弧)
        (rf'『({KANA_BLOCK})』', 'nijuu_kakko'),

        # パターン7: -カタカナ- (ハイフン囲み)
        (rf'-({KANA_BLOCK})-', 'hyphen'),

        # パターン8: ―カタカナ― (ダッシュ囲み)
        (rf'―({KANA_BLOCK})―', 'em_dash'),

        # パターン9: 【英語〜カタカナ】 (隅付き内の波ダッシュ以降)
        (rf'【[^】]*[〜~]({KANA_BLOCK})[】〜~]?', 'bracket_wave'),

        # パターン10: 【フェラーリ】等 漢字+カタカナ混在も含む
        (rf'【({KANA_BLOCK})】', 'bracket_kana'),
    ]

    for regex, name in patterns:
        match = re.search(regex, title)
        if match:
            kana = match.group(1).strip()
            # 明らかにサロン名じゃないもの除外 (トップページ等)
            if kana in ('トップページ', 'トップ', 'ホーム', 'メンズエステ'):
                continue
            return kana, name

    return None, None


def extract_kana_with_llm(title, salon_name, client):
    """
    正規表現で取れなかった場合、Claude Haikuにtitleを解釈させる。
    ※ 英語名だけ渡すより、titleごと渡す方がはるかに精度が高い
    """
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=50,
        messages=[{
            "role": "user",
            "content": f"""メンズエステ店のtitleから店名を抽出し、日本語（カタカナ/漢字/ひらがな）で返せ。

title: {title}
参考: {salon_name}

【絶対ルール】出力にアルファベット(A-Z, a-z)を含めるな。必ず日本語のみ。

ルール:
1. titleにカタカナの店名が既にあるなら、そのカタカナをそのまま使う（再翻訳するな）
   例: 「恵比寿ヴィッカプラス -Vicca+plus.-」→ ヴィッカプラス
   例: 「NEW+PLUS ～ニュープラス～」→ ニュープラス
2. 英語のみの場合→カタカナに変換（Belle Lily→ベルリリー、LINDA SPA→リンダスパ、Shake Spa→シェイクスパ）
3. 漢字・ひらがな → そのまま（天界のスパ→天界のスパ）
4. 「SPA」「Spa」→「スパ」、「Tokyo」→「トーキョー」に必ず変換
5. エリア名（恵比寿等）と「メンズエステ」等の一般語は除外
6. titleと参考が明らかに別の店 → ???

店名（日本語のみ）:"""
        }]
    )
    result = response.content[0].text.strip().split('\n')[0].strip()
    # 長文が返ってきた場合はエラー扱い
    if len(result) > 30:
        return '???'
    # 英語が残っていたら再変換を試みる
    if re.search(r'[A-Za-z]', result):
        result = _force_japanese(result, client)
    return result


def _force_japanese(text, client):
    """英語が含まれる出力をカタカナに強制変換"""
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=50,
        messages=[{
            "role": "user",
            "content": f"""以下の店名を全てカタカナ/漢字/ひらがなに変換せよ。アルファベットは一切残すな。
「{text}」
例: LINDA SPA→リンダスパ、Belle Lily→ベルリリー、小悪魔Spa Tokyo→小悪魔スパトーキョー、TOKYOエステ→トーキョーエステ
変換後:"""
        }]
    )
    result = response.content[0].text.strip().split('\n')[0].strip()
    if len(result) > 30:
        return text
    return result


def main(use_llm=False, update_db=False, fetch_sv=False):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute('''
        SELECT salon_id, salon_name, salon_name_kana, official_url
        FROM salon
        WHERE official_url IS NOT NULL AND official_url <> ''
        ORDER BY salon_id
    ''')
    salons = c.fetchall()

    print(f"対象サロン数: {len(salons)}")
    print(f"モード: regex{'+ LLMフォールバック' if use_llm else 'のみ'}")
    if update_db:
        print("⚡ DB更新モード ON")
    print("=" * 100)

    # LLMクライアント初期化
    client = None
    if use_llm:
        from anthropic import Anthropic
        client = Anthropic()

    results = []
    regex_success = 0
    llm_success = 0
    no_kana = 0
    fetch_failed = 0
    changed = 0
    db_updated = 0

    for salon in salons:
        sid = salon['salon_id']
        name = salon['salon_name']
        current_kana = salon['salon_name_kana']
        url = salon['official_url']

        # 1. title取得
        time.sleep(0.3)
        title = fetch_title(url)

        if title and title.startswith('[ERROR]'):
            fetch_failed += 1
            source = 'fetch_failed'
            kana = None
        else:
            # 2. 正規表現抽出
            kana, pattern = extract_kana_from_title(title)

            if kana:
                source = f'regex:{pattern}'
                regex_success += 1
            elif use_llm and title and client:
                # 3. LLMフォールバック（titleを入力として渡す）
                try:
                    kana = extract_kana_with_llm(title, name, client)
                    source = 'llm'
                    llm_success += 1
                except Exception as e:
                    print(f"  LLM error: {e}")
                    source = 'llm_error'
                    kana = None
            else:
                source = 'no_kana'
                no_kana += 1

        is_changed = kana and kana != current_kana

        if is_changed:
            changed += 1

        # DB更新
        if update_db and kana and is_changed:
            c.execute('UPDATE salon SET salon_name_kana = ? WHERE salon_id = ?', (kana, sid))
            db_updated += 1

        # final_kana: 最終的にサロンページで使う名前
        # extracted_kanaが有効ならそちら、なければcurrent_kanaにフォールバック
        if kana and kana not in ('???', '該当なし'):
            final_kana = kana
        else:
            final_kana = current_kana

        # 半角スペースを除去（検索結果で機能しない）
        # ただしcurrent_kanaが中黒(・)で繋いでるなら、中黒版を採用
        if final_kana:
            # まずスペースを除去
            final_kana = final_kana.replace(' ', '').replace('　', '')

            # current_kanaに中黒(・)があり、中黒以外が同じなら、中黒版を採用（ザ・ハーフ等）
            if current_kana and '・' in current_kana:
                current_no_space = current_kana.replace(' ', '').replace('　', '')
                if final_kana.replace('・', '') == current_no_space.replace('・', ''):
                    final_kana = current_no_space  # スペース除去+中黒維持

        result = {
            'salon_id': sid,
            'salon_name': name,
            'current_kana': current_kana,
            'title': title,
            'extracted_kana': kana,
            'final_kana': final_kana,
            'source': source,
            'changed': is_changed,
        }
        results.append(result)

        # ログ出力
        if source.startswith('regex'):
            status = '✅'
        elif source == 'llm':
            status = '🤖'
        elif source == 'fetch_failed':
            status = '⚠️'
        else:
            status = '❌'
        change_mark = ' 🔄' if is_changed else ''
        print(f"{status} [{sid:3d}] {name}")
        print(f"       title: {title}")
        print(f"       {source}: {current_kana} → {kana}{change_mark}")
        if is_changed:
            print(f"       *** DIFF: 「{current_kana}」→「{kana}」")
        print()

    if update_db:
        conn.commit()

    # サマリー
    print("=" * 100)
    print(f"【結果サマリー】")
    print(f"  対象:       {len(salons)}件")
    print(f"  正規表現OK: {regex_success}件")
    if use_llm:
        print(f"  LLM成功:    {llm_success}件")
    print(f"  抽出不可:   {no_kana}件")
    print(f"  取得失敗:   {fetch_failed}件")
    print(f"  変更あり:   {changed}件")
    if update_db:
        print(f"  DB更新:     {db_updated}件")
    print()

    # 変更があるものをリスト
    if changed > 0:
        print("【変更対象一覧】")
        for r in results:
            if r['changed']:
                print(f"  {r['salon_name']}")
                print(f"    {r['current_kana']} → {r['extracted_kana']} ({r['source']})")

    conn.close()

    # 検索ボリューム取得
    sv_map = {}
    if fetch_sv:
        sv_map = fetch_search_volumes([r['final_kana'] for r in results])

    # CSV出力
    import csv
    csv_path = DB_PATH.replace('.db', '') + '_kana_comparison.csv'
    # salon_idからofficial_urlを引けるようにdict化
    url_map = {s['salon_id']: s['official_url'] for s in salons}
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'salon_id', 'salon_name', 'official_url', 'title',
            'current_kana', 'extracted_kana', 'final_kana',
            'search_volume', 'source', 'changed'
        ])
        for r in results:
            writer.writerow([
                r['salon_id'],
                r['salon_name'],
                url_map.get(r['salon_id'], ''),
                r['title'] or '',
                r['current_kana'],
                r['extracted_kana'] or '',
                r['final_kana'],
                sv_map.get(r['final_kana'], ''),
                r['source'],
                'YES' if r['changed'] else '',
            ])
    print(f"\n📄 CSV出力: {csv_path}")

    return results


def fetch_search_volumes(keywords):
    """DataForSEO APIでキーワードの月間検索ボリュームを一括取得"""
    login = os.getenv('DATAFORSEO_LOGIN')
    password = os.getenv('DATAFORSEO_PASSWORD')
    if not login or not password:
        print("⚠️ DATAFORSEO credentials not found in .env")
        return {}

    from requests.auth import HTTPBasicAuth
    auth = HTTPBasicAuth(login, password)

    # 重複除去 & None除去 & 特殊文字クリーニング
    unique_kws = list(set(kw for kw in keywords if kw))
    print(f"\n🔍 DataForSEO: {len(unique_kws)}件のキーワードで検索ボリューム取得中...")

    sv_map = {}
    batch_size = 20  # 小さいバッチで安定性向上

    for i in range(0, len(unique_kws), batch_size):
        batch = unique_kws[i:i+batch_size]
        # 特殊文字クリーニング
        clean_batch = [kw.replace('♡', '').replace('!', '').replace('！', '').strip() for kw in batch]
        clean_batch = [kw for kw in clean_batch if kw]
        kw_mapping = dict(zip(clean_batch, batch))

        payload = [{
            "keywords": clean_batch,
            "location_code": 2392,  # Japan
            "language_code": "ja",
        }]

        # リトライ付き
        for attempt in range(3):
            try:
                url = "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live"
                resp = requests.post(url, auth=auth, json=payload, timeout=60)
                resp.raise_for_status()
                data = resp.json()

                count = 0
                for task in data.get('tasks', []):
                    for item in (task.get('result') or []):
                        kw = item.get('keyword', '')
                        sv = item.get('search_volume')
                        original_kw = kw_mapping.get(kw, kw)
                        sv_map[original_kw] = sv if sv is not None else 0
                        sv_map[kw] = sv if sv is not None else 0
                        count += 1

                print(f"  バッチ {i//batch_size + 1}: {len(clean_batch)}件送信 → {count}件取得")
                if count > 0:
                    break
                elif attempt < 2:
                    print(f"    → 0件、リトライ ({attempt+2}/3)...")
                    time.sleep(3)
            except Exception as e:
                print(f"  バッチ {i//batch_size + 1} エラー: {e}")
                if attempt < 2:
                    time.sleep(3)

        time.sleep(1)  # バッチ間ディレイ

    # サマリー
    has_volume = sum(1 for v in sv_map.values() if v and v > 0)
    print(f"  検索ボリュームあり: {has_volume}/{len(sv_map)}件")

    return sv_map


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='公式サイトtitleからサロン名カタカナを抽出')
    parser.add_argument('--llm', action='store_true', help='LLMフォールバックを有効化')
    parser.add_argument('--update', action='store_true', help='DBを更新する')
    parser.add_argument('--sv', action='store_true', help='DataForSEOで検索ボリュームを取得')
    args = parser.parse_args()

    main(use_llm=args.llm, update_db=args.update, fetch_sv=args.sv)
