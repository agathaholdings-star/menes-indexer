-- ============================================================
-- 口コミ閲覧数トラッキング
-- レビュー表示時にview_countをインクリメント
-- ============================================================

-- 1. view_count カラム追加
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0;

-- 2. バッチインクリメント関数
--    ページ表示時に表示されたレビューIDをまとめて+1
CREATE OR REPLACE FUNCTION increment_review_views(p_review_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE reviews
    SET view_count = view_count + 1
  WHERE id = ANY(p_review_ids)
    AND moderation_status = 'approved';
END;
$$;
