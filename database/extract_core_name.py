#!/usr/bin/env python3
"""
店名からコア名（ブランド名）を抽出してカタカナ化
- エリア名・店舗suffix除去
- 検索用カタカナに変換
"""
import re
import os
from dotenv import load_dotenv

load_dotenv()

# 除去するエリア名キーワード
AREA_KEYWORDS = [
    '恵比寿', '中目黒', '代官山', '広尾', '目黒', '渋谷', '新宿', '池袋',
    '博多', '天神', '福岡', '秋田', '東京', '大阪', '名古屋', '横浜',
]

def extract_core_name(full_name):
    """エリア名等を除去してコア店名を抽出"""
    name = full_name.strip()

    # 括弧内の読みを除去
    name = re.sub(r'[（\(][ァ-ヶー・ぁ-んa-zA-Z\s]+[）\)]', '', name)

    # 【】内を抽出（店名の核心部分の可能性）
    bracket_match = re.search(r'【([^】]+)】', name)
    if bracket_match:
        # 【】内が店名っぽければそれを使う
        inner = bracket_match.group(1)
        if len(inner) >= 2:
            name = inner

    # エリア名を含む部分を末尾から除去（区切り文字あり・なし両対応）
    for area in AREA_KEYWORDS:
        # 末尾パターン: 恵比寿店, 恵比寿ルーム, 恵比寿・中目黒店 など
        name = re.sub(rf'[\s　・〜~]*{area}[^ァ-ヶー]*$', '', name)
        # 先頭パターン: 東京〇〇
        name = re.sub(rf'^{area}[\s　・〜~]*', '', name)

    # suffix除去
    name = re.sub(r'[\s　・〜~]*(店|ルーム|Room|離れ)$', '', name)

    # 記号クリーンアップ
    name = re.sub(r'^[\s　・〜~【】]+', '', name)
    name = re.sub(r'[\s　・〜~【】]+$', '', name)

    return name.strip()

def extract_kana_from_parentheses(name):
    """括弧内のカタカナ読みを抽出"""
    # 全角括弧
    match = re.search(r'（([ァ-ヶー・]+)）', name)
    if match:
        return match.group(1)
    # 半角括弧
    match = re.search(r'\(([ァ-ヶー・]+)\)', name)
    if match:
        return match.group(1)
    return None

def extract_and_convert(full_name, client=None):
    """フル店名 → コア店名抽出 + 英語のみカタカナ変換"""

    # 1. 括弧内にカタカナ読みがあればそれを使う（API不要）
    kana_in_paren = extract_kana_from_parentheses(full_name)
    if kana_in_paren:
        return kana_in_paren

    # 2. なければAPIで変換
    if client is None:
        from anthropic import Anthropic
        client = Anthropic()

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=50,
        messages=[{
            "role": "user",
            "content": f"""メンズエステ店の店名から検索用コア名を作ってください。

入力: {full_name}

処理:
1. 末尾の地名suffix除去（恵比寿店、中目黒ルーム等）※店名自体が地名の場合は残す
2. 括弧内の読み仮名を除去
3. 英語→カタカナ変換（MARVEL→マーベル、SPA→スパ、LUXE→リュクス）
4. 日本語はそのまま

例:
- ANAICHI（あないち）恵比寿店 → アナイチ
- 大人のやすらぎSPA 恵比寿 → 大人のやすらぎスパ
- SAUDADE TOKYO 恵比寿ルーム → サウダージトーキョー
- 恵比寿メンズエステ → 恵比寿メンズエステ

回答（コア名のみ）:"""
        }]
    )

    return response.content[0].text.strip()

def process_salon_name(full_name, client=None):
    """フル店名 → 検索用カタカナ"""
    # 正規表現で前処理
    core = extract_core_name(full_name)
    # APIで最終変換
    kana = extract_and_convert(full_name, client)
    return core, kana

if __name__ == '__main__':
    from anthropic import Anthropic
    client = Anthropic()

    test_names = [
        "ANAICHI（あないち）恵比寿 ・中目黒店",
        "大人のやすらぎSPA 恵比寿",
        "SAUDADE TOKYO 恵比寿ルーム",
        "shake spa 中目黒ルーム",
        "MARVEL 離れ",
        "東京【アロマモア】恵比寿店",
        "天界のスパ",
        "LUXEセレスティンアロマージュ 恵比寿",
        "Vicca+plus.（ヴィッカプラス）",
        "JDスパ～女子大生エステ～恵比寿・代官山",
        "恵比寿メンズエステ",  # 店名自体に地名
    ]

    print("=== コア名抽出 + カタカナ変換 ===\n")

    for full_name in test_names:
        kana = extract_and_convert(full_name, client)
        print(f"元: {full_name}")
        print(f"kana: {kana}")
        print()
