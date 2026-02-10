#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smart Scraper: 自己学習型セラピストスクレイパー
キャッシュ・CMS指紋判定・ルールベース抽出・LLMフォールバック・自動学習

使い方:
    scraper = SmartScraper(db_conn=conn)
    therapists = scraper.scrape_salon(shop_id, salon_url, salon_name, max_therapists=0)
"""

import hashlib
import json
import logging
import time

import psycopg2.extras

from therapist_scraper import TherapistScraper, fetch_page, REQUEST_DELAY
from cms_fingerprinter import CMSFingerprinter
from rule_extractor import RuleExtractor
from pattern_validator import PatternValidator
from rule_miner import RuleMiner

log = logging.getLogger(__name__)


class SmartScraper:
    """自己学習型セラピストスクレイパー"""

    def __init__(self, db_conn=None):
        """
        Args:
            db_conn: psycopg2 connection（ローカルSupabase）
        """
        self.db_conn = db_conn
        self.llm_scraper = TherapistScraper()
        self.rule_extractor = RuleExtractor()
        self.validator = PatternValidator()
        self.rule_miner = RuleMiner()

        # DB上のCMSパターンをロード
        self.cms_patterns = []
        self.fingerprinter = CMSFingerprinter()
        if db_conn:
            self._load_cms_patterns()

        # 統計
        self.stats = {
            'rule_success': 0,
            'llm_fallback': 0,
            'new_patterns': 0,
            'cache_hits': 0,
            'errors': 0,
        }

    def _load_cms_patterns(self):
        """DBからCMSパターンをロード"""
        try:
            cur = self.db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("""
                SELECT id, cms_name, fingerprint, list_url_rules,
                       therapist_list_rules, therapist_data_rules,
                       confidence, success_count, fail_count
                FROM cms_patterns
            """)
            self.cms_patterns = [dict(row) for row in cur.fetchall()]
            self.fingerprinter = CMSFingerprinter(self.cms_patterns)
            cur.close()
            log.info(f"CMSパターン {len(self.cms_patterns)}件をロード")
        except Exception as e:
            log.warning(f"CMSパターンロード失敗: {e}")

    def _get_cache(self, shop_id):
        """shop_scrape_cacheからキャッシュ取得"""
        if not self.db_conn:
            return None
        try:
            cur = self.db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("""
                SELECT shop_id, cms_pattern_id, therapist_list_url,
                       extraction_method, last_therapist_count, fail_streak
                FROM shop_scrape_cache
                WHERE shop_id = %s AND fail_streak < 3
            """, (shop_id,))
            row = cur.fetchone()
            cur.close()
            return dict(row) if row else None
        except Exception:
            return None

    def _update_cache(self, shop_id, cms_pattern_id, list_url, method, therapist_count, success):
        """shop_scrape_cacheを更新"""
        if not self.db_conn:
            return
        try:
            cur = self.db_conn.cursor()
            if success:
                cur.execute("""
                    INSERT INTO shop_scrape_cache
                        (shop_id, cms_pattern_id, therapist_list_url,
                         extraction_method, last_therapist_count, fail_streak, last_scraped_at)
                    VALUES (%s, %s, %s, %s, %s, 0, now())
                    ON CONFLICT (shop_id) DO UPDATE SET
                        cms_pattern_id = EXCLUDED.cms_pattern_id,
                        therapist_list_url = EXCLUDED.therapist_list_url,
                        extraction_method = EXCLUDED.extraction_method,
                        last_therapist_count = EXCLUDED.last_therapist_count,
                        fail_streak = 0,
                        last_scraped_at = now()
                """, (shop_id, cms_pattern_id, list_url, method, therapist_count))
            else:
                cur.execute("""
                    INSERT INTO shop_scrape_cache
                        (shop_id, cms_pattern_id, therapist_list_url,
                         extraction_method, last_therapist_count, fail_streak, last_scraped_at)
                    VALUES (%s, %s, %s, %s, 0, 1, now())
                    ON CONFLICT (shop_id) DO UPDATE SET
                        fail_streak = shop_scrape_cache.fail_streak + 1,
                        last_scraped_at = now()
                """, (shop_id, cms_pattern_id, list_url, method))
            cur.close()
        except Exception as e:
            log.warning(f"キャッシュ更新失敗: {e}")

    def _log_scrape(self, shop_id, step, method, success, html=None, detail=None):
        """scrape_logにログ書き込み"""
        if not self.db_conn:
            return
        try:
            html_hash = hashlib.sha256(html.encode()).hexdigest()[:16] if html else None
            cur = self.db_conn.cursor()
            cur.execute("""
                INSERT INTO scrape_log (shop_id, step, method, success, html_hash, detail)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (shop_id, step, method, success, html_hash, detail))
            cur.close()
        except Exception as e:
            log.warning(f"ログ書き込み失敗: {e}")

    def _update_cms_confidence(self, pattern_id, success):
        """CMS パターンの信頼度を更新"""
        if not self.db_conn or not pattern_id:
            return
        try:
            cur = self.db_conn.cursor()
            if success:
                cur.execute("""
                    UPDATE cms_patterns
                    SET success_count = success_count + 1,
                        confidence = (success_count + 1)::float
                            / (success_count + 1 + fail_count * 2)
                    WHERE id = %s
                """, (pattern_id,))
            else:
                cur.execute("""
                    UPDATE cms_patterns
                    SET fail_count = fail_count + 1,
                        confidence = success_count::float
                            / (success_count + (fail_count + 1) * 2)
                    WHERE id = %s
                """, (pattern_id,))
            cur.close()
        except Exception as e:
            log.warning(f"信頼度更新失敗: {e}")

    def _get_pattern_by_id(self, pattern_id):
        """IDでCMSパターンを取得"""
        for p in self.cms_patterns:
            if p['id'] == pattern_id:
                return p
        return None

    def scrape_salon(self, shop_id, salon_url, salon_name="", max_therapists=0):
        """
        サロン1件分のセラピストデータを取得（Smart版）

        フロー:
        1. キャッシュ確認（一覧URL・CMSパターン）
        2. CMS指紋判定
        3. ルールベース抽出を試行
        4. 失敗 → LLMフォールバック
        5. LLM成功 → パターン自動学習
        6. キャッシュ・ログ更新

        Args:
            shop_id: shops.id
            salon_url: 公式URL
            salon_name: 表示名
            max_therapists: 最大取得人数（0=無制限）

        Returns:
            [therapist_data_dict, ...]
        """
        print(f"\n{'='*60}")
        print(f" {salon_name or salon_url}")
        print(f"{'='*60}")

        # === Step 1: トップページ取得 ===
        print(f"  [1/3] トップページ取得...")
        html = fetch_page(salon_url)
        if not html:
            self._log_scrape(shop_id, 'fetch_top', 'http', False, detail='fetch failed')
            self.stats['errors'] += 1
            return []

        # === キャッシュ確認 ===
        cache = self._get_cache(shop_id)
        cached_list_url = cache['therapist_list_url'] if cache else None
        cached_pattern_id = cache['cms_pattern_id'] if cache else None

        # === CMS指紋判定 ===
        cms_name, cms_confidence, pattern_id = self.fingerprinter.identify(html, salon_url)
        if not pattern_id and cached_pattern_id:
            pattern_id = cached_pattern_id
            pattern = self._get_pattern_by_id(pattern_id)
            if pattern:
                cms_name = pattern['cms_name']
                cms_confidence = pattern.get('confidence', 0.0)

        pattern = self._get_pattern_by_id(pattern_id) if pattern_id else None

        if cms_name:
            print(f"  CMS判定: {cms_name} (confidence={cms_confidence:.2f})")

        # === Step 2: セラピスト一覧ページを発見 ===
        list_url = None
        list_html = None
        step2_method = 'cache'

        # キャッシュ済み一覧URLを優先
        if cached_list_url:
            print(f"  [2/3] 一覧URL（キャッシュ）: {cached_list_url}")
            list_url = cached_list_url
            self.stats['cache_hits'] += 1
        elif pattern and cms_confidence >= 0.4:
            # ルールベースで一覧URLを探す
            list_url = self.rule_extractor.find_list_url(
                html, salon_url, pattern.get('list_url_rules', {}))
            if list_url:
                step2_method = 'rule'
                print(f"  [2/3] 一覧URL（ルール）: {list_url}")

        if not list_url:
            # LLMフォールバック
            step2_method = 'llm'
            print(f"  [2/3] 一覧ページを探索（LLM）...")
            list_url = self.llm_scraper.find_therapist_list_url(salon_url, html)

        if not list_url:
            print(f"  x 一覧ページが見つかりません")
            self._log_scrape(shop_id, 'find_list_url', step2_method, False, html)
            self._update_cache(shop_id, pattern_id, None, step2_method, 0, False)
            self.stats['errors'] += 1
            return []

        self._log_scrape(shop_id, 'find_list_url', step2_method, True, html)
        print(f"  -> {list_url}")

        # 一覧ページ取得
        time.sleep(REQUEST_DELAY)
        if list_url.rstrip('/') != salon_url.rstrip('/'):
            list_html = fetch_page(list_url)
            if not list_html:
                self._update_cache(shop_id, pattern_id, list_url, step2_method, 0, False)
                self.stats['errors'] += 1
                return []
        else:
            list_html = html

        # === Step 3: セラピスト個別URL抽出 ===
        entries = []
        step3_method = 'llm'

        if pattern and cms_confidence >= 0.4:
            # ルールベースで抽出試行
            entries = self.rule_extractor.extract_therapist_urls(
                list_html, list_url, pattern.get('therapist_list_rules', {}))
            if entries:
                step3_method = 'rule'
                print(f"  [3/3] セラピストURL抽出（ルール）: {len(entries)}名")

        if not entries:
            # LLMフォールバック
            step3_method = 'llm'
            print(f"  [3/3] セラピスト情報を抽出（LLM）...")
            entries = self.llm_scraper.extract_therapist_urls(list_url, list_html)

        # ページネーション対応
        next_pages = self.llm_scraper.find_next_pages(list_url, list_html)
        for page_url in next_pages[:5]:
            time.sleep(REQUEST_DELAY)
            page_html = fetch_page(page_url)
            if page_html:
                if step3_method == 'rule' and pattern:
                    more = self.rule_extractor.extract_therapist_urls(
                        page_html, page_url, pattern.get('therapist_list_rules', {}))
                else:
                    more = self.llm_scraper.extract_therapist_urls(page_url, page_html)
                entries.extend(more)

        # 重複除去
        seen = set()
        unique = []
        for e in entries:
            if e['url'] not in seen:
                seen.add(e['url'])
                unique.append(e)
        entries = unique

        self._log_scrape(shop_id, 'extract_urls', step3_method, bool(entries), list_html,
                         detail=f'{len(entries)} urls')

        if not entries:
            print(f"  x セラピスト0名")
            self._update_cache(shop_id, pattern_id, list_url, step3_method, 0, False)
            if pattern_id:
                self._update_cms_confidence(pattern_id, False)
            self.stats['errors'] += 1
            return []

        # max_therapists制限
        if max_therapists > 0:
            entries = entries[:max_therapists]

        print(f"  -> {len(entries)}名のセラピストを検出")

        # === Step 4: 各セラピストの詳細取得 ===
        therapists = []
        step4_method = 'llm'

        # ルールベース抽出が使えるか判定
        use_rule_for_data = (
            pattern and cms_confidence >= 0.4
            and pattern.get('therapist_data_rules')
        )

        # ハイブリッドモード: confidence 0.4-0.7 では最初の1名でLLM検証
        need_hybrid_check = (
            use_rule_for_data
            and 0.4 <= cms_confidence < 0.7
        )

        if use_rule_for_data:
            step4_method = 'rule'

        # HTMLキャッシュ（rule_miner用）
        sample_htmls = []

        for i, entry in enumerate(entries):
            name_hint = entry.get('name', '?')
            print(f"  [{i+1}/{len(entries)}] {name_hint}")

            time.sleep(REQUEST_DELAY)
            t_html = fetch_page(entry['url'])
            if not t_html:
                continue

            data = None

            if use_rule_for_data:
                # ルールベース抽出
                data = self.rule_extractor.extract_therapist_data(
                    t_html, entry['url'], pattern.get('therapist_data_rules', {}))

                if data and self.validator.validate_therapist(data):
                    # ハイブリッドチェック: 最初の1名はLLMでも抽出して比較
                    if need_hybrid_check and i == 0:
                        llm_data = self.llm_scraper.extract_therapist_data(entry['url'], t_html)
                        if llm_data and llm_data.get('name') and data.get('name') != llm_data.get('name'):
                            log.warning(f"  ハイブリッドチェック: ルール({data.get('name')}) vs LLM({llm_data.get('name')})")
                            # 名前不一致 → ルール信頼度が低い、LLMに切り替え
                            use_rule_for_data = False
                            step4_method = 'llm'
                            data = llm_data
                        else:
                            need_hybrid_check = False  # 検証OK、以降はルールのみ
                else:
                    # ルール抽出失敗 → LLMフォールバック
                    data = self.llm_scraper.extract_therapist_data(entry['url'], t_html)
                    if i < 3:
                        # 最初の数件で失敗し続ける → 全面LLMに切り替え
                        use_rule_for_data = False
                        step4_method = 'llm'
            else:
                # LLM抽出
                data = self.llm_scraper.extract_therapist_data(entry['url'], t_html)

            if data:
                # 一覧ページ画像のフォールバック
                imgs = data.get('image_urls') or []
                if not imgs and entry.get('list_image_url'):
                    data['image_urls'] = [entry['list_image_url']]

                therapists.append(data)
                n = data.get('name', '?')
                a = data.get('age', '?')
                h = data.get('height', '?')
                sizes = f"B{data.get('bust','?')}/W{data.get('waist','?')}/H{data.get('hip','?')}"
                print(f"       -> {n} ({a}, {h}cm, {sizes})")

                # rule_miner用にサンプルHTMLを保存（最大5件）
                if len(sample_htmls) < 5:
                    sample_htmls.append({
                        'html': t_html,
                        'url': entry['url'],
                        'data': data,
                    })
            else:
                print(f"       -> 抽出失敗")

        self._log_scrape(shop_id, 'extract_data', step4_method, bool(therapists),
                         detail=f'{len(therapists)}/{len(entries)} extracted')

        # === 統計更新 ===
        if step3_method == 'rule' or step4_method == 'rule':
            self.stats['rule_success'] += 1
        if step3_method == 'llm' or step4_method == 'llm':
            self.stats['llm_fallback'] += 1

        # === 信頼度更新 ===
        if pattern_id:
            batch_valid, _ = self.validator.validate_batch(therapists)
            self._update_cms_confidence(pattern_id, batch_valid)

        # === 自動学習: LLMで抽出した場合、パターンを学習 ===
        if step4_method == 'llm' and therapists and sample_htmls and self.db_conn:
            self._try_learn_pattern(shop_id, salon_url, html, sample_htmls, pattern_id)

        # === キャッシュ更新 ===
        overall_method = 'rule' if step4_method == 'rule' else 'llm'
        self._update_cache(shop_id, pattern_id, list_url, overall_method,
                          len(therapists), bool(therapists))

        if self.db_conn:
            try:
                self.db_conn.commit()
            except Exception:
                pass

        print(f"\n  完了: {len(therapists)}/{len(entries)}名 (method={overall_method})")
        return therapists

    def _try_learn_pattern(self, shop_id, salon_url, top_html, sample_htmls, existing_pattern_id):
        """LLM抽出結果からパターンを自動学習"""
        try:
            mined_rules = self.rule_miner.mine_therapist_data_rules(sample_htmls)
            if not mined_rules:
                return

            # ルールの検証: 全サンプルで再抽出して成功率チェック
            success_count = 0
            for sample in sample_htmls:
                re_extracted = self.rule_extractor.extract_therapist_data(
                    sample['html'], sample['url'], mined_rules)
                if re_extracted and self.validator.validate_therapist(re_extracted):
                    # 名前が一致するか
                    if re_extracted.get('name') == sample['data'].get('name'):
                        success_count += 1

            success_rate = success_count / len(sample_htmls) if sample_htmls else 0

            if success_rate < 0.8:
                log.info(f"  パターン学習: 成功率{success_rate:.0%}（閾値80%未満）→ 保留")
                return

            # 既存パターンに追加 or 新規パターン作成
            if existing_pattern_id:
                # 既存パターンのデータ抽出ルールを更新
                self._update_pattern_rules(existing_pattern_id, mined_rules)
                log.info(f"  パターン学習: 既存パターン(id={existing_pattern_id})のデータルール更新")
            else:
                # 新規CMSパターンとして登録
                cms_name = self._generate_cms_name(salon_url)
                new_fp = self.rule_miner.mine_fingerprint(top_html, salon_url)
                pattern_id = self._insert_new_pattern(cms_name, new_fp, mined_rules)
                if pattern_id:
                    log.info(f"  パターン学習: 新規パターン '{cms_name}' (id={pattern_id}) 登録")
                    self.stats['new_patterns'] += 1
                    # パターンリストを再ロード
                    self._load_cms_patterns()

        except Exception as e:
            log.warning(f"  パターン学習エラー: {e}")

    def _update_pattern_rules(self, pattern_id, data_rules):
        """既存パターンのtherapist_data_rulesを更新"""
        try:
            cur = self.db_conn.cursor()
            cur.execute("""
                UPDATE cms_patterns
                SET therapist_data_rules = %s,
                    version = version + 1
                WHERE id = %s
            """, (json.dumps(data_rules, ensure_ascii=False), pattern_id))
            cur.close()
        except Exception as e:
            log.warning(f"パターンルール更新失敗: {e}")

    def _generate_cms_name(self, url):
        """URLからCMS名を自動生成"""
        from urllib.parse import urlparse
        domain = urlparse(url).netloc
        # ドメインをCMS名に（例: aromamore.tokyo → aromamore_tokyo）
        name = domain.replace('.', '_').replace('-', '_')
        # 短縮
        if len(name) > 30:
            name = name[:30]
        return f"auto_{name}"

    def _insert_new_pattern(self, cms_name, fingerprint, data_rules):
        """新規CMSパターンをDBに登録"""
        try:
            cur = self.db_conn.cursor()
            cur.execute("""
                INSERT INTO cms_patterns (cms_name, fingerprint, therapist_data_rules, confidence)
                VALUES (%s, %s, %s, 0.5)
                ON CONFLICT (cms_name) DO UPDATE SET
                    therapist_data_rules = EXCLUDED.therapist_data_rules,
                    version = cms_patterns.version + 1
                RETURNING id
            """, (
                cms_name,
                json.dumps(fingerprint, ensure_ascii=False),
                json.dumps(data_rules, ensure_ascii=False),
            ))
            row = cur.fetchone()
            cur.close()
            return row[0] if row else None
        except Exception as e:
            log.warning(f"新規パターン登録失敗: {e}")
            return None

    def print_stats(self):
        """統計サマリーを表示"""
        print(f"\n{'='*60}")
        print(f" Smart Scraper 統計")
        print(f"{'='*60}")
        print(f"  ルール成功:       {self.stats['rule_success']}")
        print(f"  LLMフォールバック: {self.stats['llm_fallback']}")
        print(f"  新規パターン:     {self.stats['new_patterns']}")
        print(f"  キャッシュヒット: {self.stats['cache_hits']}")
        print(f"  エラー:           {self.stats['errors']}")
        total = self.stats['rule_success'] + self.stats['llm_fallback']
        if total > 0:
            rule_rate = self.stats['rule_success'] / total * 100
            print(f"  ルール率:         {rule_rate:.1f}%")
        print(f"{'='*60}")
