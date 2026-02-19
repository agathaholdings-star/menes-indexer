-- ============================================================
-- salon_scrape_cache 拡張: name_css_selector + fail_reason
-- name_css_selector: 名前抽出成功時のCSSセレクタ（学習データ）
-- fail_reason: スクレイピング失敗理由の分類
-- ============================================================

ALTER TABLE salon_scrape_cache
    ADD COLUMN IF NOT EXISTS name_css_selector text,
    ADD COLUMN IF NOT EXISTS fail_reason text;

COMMENT ON COLUMN salon_scrape_cache.name_css_selector IS '名前抽出成功時のCSSセレクタ。次回以降ヒューリスティック優先用';
COMMENT ON COLUMN salon_scrape_cache.fail_reason IS 'domain_dead/site_down/page_404/no_therapist_page/no_therapist_urls/empty_page/other';
