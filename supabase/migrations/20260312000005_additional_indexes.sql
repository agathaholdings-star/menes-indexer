-- ============================================================
-- パフォーマンス用インデックス追加
-- 12.8万セラピスト・1.1万口コミ規模向け
-- ============================================================

-- サロン詳細: 在籍セラピスト一覧（statusフィルタ + 口コミ数ソート）
CREATE INDEX IF NOT EXISTS idx_therapists_salon_active
  ON therapists(salon_id, review_count DESC)
  WHERE status = 'active';

-- モデレーション画面: pending口コミを新しい順
CREATE INDEX IF NOT EXISTS idx_reviews_pending
  ON reviews(created_at DESC)
  WHERE moderation_status = 'pending';

-- サロン詳細: 該当サロンの最新口コミ
CREATE INDEX IF NOT EXISTS idx_reviews_salon_latest
  ON reviews(salon_id, created_at DESC)
  WHERE moderation_status = 'approved';

-- エリアページ: サロンの口コミ数・スコア順ソート
CREATE INDEX IF NOT EXISTS idx_salons_active_review
  ON salons(review_count DESC, avg_score DESC)
  WHERE is_active = true;
