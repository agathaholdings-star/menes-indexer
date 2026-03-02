-- ============================================================
-- review_helpful: 「参考になった」投票テーブル + 通知トリガー
-- ============================================================

-- 1. helpful_count カラムを reviews に追加
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS helpful_count int DEFAULT 0;

-- 2. review_helpful テーブル
CREATE TABLE IF NOT EXISTS review_helpful (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_id  uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, review_id)
);

CREATE INDEX IF NOT EXISTS idx_review_helpful_review ON review_helpful(review_id);

-- 3. RLS
ALTER TABLE review_helpful ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_helpful_select"
  ON review_helpful FOR SELECT USING (true);

CREATE POLICY "review_helpful_insert"
  ON review_helpful FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "review_helpful_delete"
  ON review_helpful FOR DELETE
  USING (auth.uid() = user_id);

-- 4. トリガー: INSERT → helpful_count +1 + 通知作成
CREATE OR REPLACE FUNCTION sync_helpful_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- カウント更新
  UPDATE reviews SET helpful_count = helpful_count + 1
  WHERE id = NEW.review_id;

  -- 投稿者に通知（seed口コミ=user_id NULL は除外、自分自身も除外）
  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT r.user_id,
         'helpful',
         '口コミが参考になりました',
         'あなたの口コミに「参考になった」が付きました',
         '/therapist/' || r.therapist_id
  FROM reviews r
  WHERE r.id = NEW.review_id
    AND r.user_id IS NOT NULL
    AND r.user_id != NEW.user_id;

  RETURN NEW;
END;
$$;

-- 5. トリガー: DELETE → helpful_count -1
CREATE OR REPLACE FUNCTION sync_helpful_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE reviews SET helpful_count = GREATEST(helpful_count - 1, 0)
  WHERE id = OLD.review_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_review_helpful_insert
  AFTER INSERT ON review_helpful
  FOR EACH ROW EXECUTE FUNCTION sync_helpful_insert();

CREATE TRIGGER trg_review_helpful_delete
  AFTER DELETE ON review_helpful
  FOR EACH ROW EXECUTE FUNCTION sync_helpful_delete();
