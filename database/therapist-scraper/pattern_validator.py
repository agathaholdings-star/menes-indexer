#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
抽出品質検証モジュール
ルールベース抽出結果の品質を検証し、LLMフォールバックの判断をする

使い方:
    validator = PatternValidator()
    is_valid = validator.validate_therapist(data)
    is_batch_valid = validator.validate_batch(therapists, expected_count)
"""

# 数値フィールドの妥当範囲
PLAUSIBLE_RANGES = {
    'age': (18, 60),
    'height': (140, 185),
    'bust': (60, 120),
    'waist': (45, 90),
    'hip': (60, 120),
}


class PatternValidator:
    """抽出結果の品質検証"""

    def validate_therapist(self, data):
        """
        セラピスト1名のデータが有効か検証

        基準:
            - name必須
            - age, height, bust/waist/hip, image_urls のうち2つ以上が存在
            - 数値フィールドが妥当範囲内
            - age==height等のセレクタ衝突パターンを検出

        Args:
            data: 抽出データ dict

        Returns:
            bool
        """
        if not data:
            return False

        if not data.get('name'):
            return False

        # 数値フィールドの妥当性チェック
        for field, (min_val, max_val) in PLAUSIBLE_RANGES.items():
            val = data.get(field)
            if val is not None:
                try:
                    v = int(val)
                    if v < min_val or v > max_val:
                        return False
                except (ValueError, TypeError):
                    pass

        # セレクタ衝突パターン検出: age==heightやage==bustは典型的な衝突
        age = data.get('age')
        if age is not None:
            try:
                age_int = int(age)
                for field in ('height', 'bust', 'waist', 'hip'):
                    other = data.get(field)
                    if other is not None:
                        try:
                            if int(other) == age_int and age_int < 100:
                                return False
                        except (ValueError, TypeError):
                            pass
            except (ValueError, TypeError):
                pass

        optional_fields_present = 0

        if data.get('age') is not None:
            optional_fields_present += 1

        if data.get('height') is not None:
            optional_fields_present += 1

        # BWHはまとめて1つとしてカウント
        has_bwh = any(data.get(f) is not None for f in ('bust', 'waist', 'hip'))
        if has_bwh:
            optional_fields_present += 1

        if data.get('image_urls'):
            optional_fields_present += 1

        return optional_fields_present >= 2

    def validate_batch(self, therapists, expected_count=0):
        """
        バッチ抽出結果の品質を検証

        基準:
            - expected_countが指定されている場合: 取得数が期待の50%以上
            - 有効データ率が70%以上

        Args:
            therapists: 抽出データのリスト
            expected_count: 期待されるセラピスト数（0=不問）

        Returns:
            (is_valid, stats_dict)
        """
        if not therapists:
            return False, {'total': 0, 'valid': 0, 'valid_rate': 0.0, 'reason': 'empty'}

        total = len(therapists)
        valid_count = sum(1 for t in therapists if self.validate_therapist(t))
        valid_rate = valid_count / total if total > 0 else 0.0

        stats = {
            'total': total,
            'valid': valid_count,
            'valid_rate': round(valid_rate, 3),
        }

        # 期待数チェック
        if expected_count > 0 and total < expected_count * 0.5:
            stats['reason'] = f'count_low: {total}/{expected_count}'
            return False, stats

        # 有効データ率チェック
        if valid_rate < 0.7:
            stats['reason'] = f'valid_rate_low: {valid_rate:.1%}'
            return False, stats

        stats['reason'] = 'ok'
        return True, stats
