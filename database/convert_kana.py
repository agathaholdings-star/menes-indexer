#!/usr/bin/env python3
"""
店名の英語部分をカタカナに変換するユーティリティ
- 英語を含む店名のみClaude APIで変換
- 日本語のみの店名はスキップ
"""
import re
import os
from dotenv import load_dotenv

load_dotenv()

def has_english(text):
    """英語（アルファベット）が含まれているかチェック"""
    return bool(re.search(r'[a-zA-Z]', text))

def convert_english_to_kana(name, client=None):
    """
    英語部分をカタカナに変換
    - 英語がなければそのまま返す
    - 英語があればClaude APIで変換
    """
    if not has_english(name):
        return name, False  # 変換なし

    if client is None:
        from anthropic import Anthropic
        client = Anthropic()

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        messages=[{
            "role": "user",
            "content": f"""この店名の英語部分を日本語読みのカタカナに変換してください。

ルール:
- 日本語（漢字・ひらがな・カタカナ）はそのまま
- 英語は日本人が読む発音のカタカナに（例: SPA→スパ, TOKYO→トーキョー, LUXE→リュクス, shake→シェイク）
- 略語も単語として読む（SPA=スパ、不要な一文字ずつ読みはNG）

店名: {name}

変換後の店名のみ回答（説明不要）:"""
        }]
    )

    converted = response.content[0].text.strip()
    return converted, True  # 変換あり

def batch_convert(names):
    """複数の店名を一括変換（API呼び出しを最小化）"""
    from anthropic import Anthropic
    client = Anthropic()

    results = []
    api_calls = 0

    for name in names:
        converted, used_api = convert_english_to_kana(name, client)
        if used_api:
            api_calls += 1
        results.append({
            'original': name,
            'converted': converted,
            'used_api': used_api
        })

    return results, api_calls

if __name__ == '__main__':
    # テスト
    test_names = [
        "大人のやすらぎSPA 恵比寿",      # SPAだけ変換
        "SAUDADE TOKYO 恵比寿ルーム",    # 英語部分を変換
        "shake spa 中目黒ルーム",         # 英語部分を変換
        "MARVEL 離れ",                    # 英語部分を変換
        "東京【アロマモア】恵比寿店",      # 変換不要
        "天界のスパ",                      # 変換不要（カタカナ「スパ」あり）
        "LUXEセレスティンアロマージュ",   # LUXEだけ変換
    ]

    print("=== 英語チェック ===")
    for name in test_names:
        has_eng = has_english(name)
        print(f"{'✓' if has_eng else '×'} {name}")

    print("\n=== API変換テスト ===")
    results, api_calls = batch_convert(test_names)

    for r in results:
        if r['used_api']:
            print(f"[API] {r['original']}")
            print(f"   -> {r['converted']}")
        else:
            print(f"[SKIP] {r['original']}")

    print(f"\n合計: {len(test_names)}件中 {api_calls}件がAPI呼び出し")
