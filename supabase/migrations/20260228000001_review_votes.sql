-- ============================================================
-- REAL/FAKE 投票機能
-- review_votes テーブル + reviews カウンタ + 自動同期トリガー
-- ============================================================

-- 1. reviews テーブルにカウンタカラム追加
ALTER TABLE reviews ADD COLUMN real_count int NOT NULL DEFAULT 0;
ALTER TABLE reviews ADD COLUMN fake_count int NOT NULL DEFAULT 0;

-- 2. 投票テーブル（user_id + review_id で冪等性保証）
CREATE TABLE review_votes (
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  review_id  uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  vote_type  text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, review_id),
  CONSTRAINT chk_review_vote_type CHECK (vote_type IN ('real', 'fake'))
);

CREATE INDEX idx_review_votes_review_id ON review_votes (review_id);

-- 3. INSERT トリガー: 新規投票時にカウント +1
CREATE OR REPLACE FUNCTION review_vote_insert()
RETURNS trigger AS $$
BEGIN
  IF NEW.vote_type = 'real' THEN
    UPDATE reviews SET real_count = real_count + 1 WHERE id = NEW.review_id;
  ELSIF NEW.vote_type = 'fake' THEN
    UPDATE reviews SET fake_count = fake_count + 1 WHERE id = NEW.review_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_review_vote_insert
  AFTER INSERT ON review_votes
  FOR EACH ROW
  EXECUTE FUNCTION review_vote_insert();

-- 4. UPDATE トリガー: 投票変更時に旧カウント -1、新カウント +1
CREATE OR REPLACE FUNCTION review_vote_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.vote_type = NEW.vote_type THEN
    RETURN NEW;
  END IF;

  -- 旧投票をデクリメント
  IF OLD.vote_type = 'real' THEN
    UPDATE reviews SET real_count = GREATEST(real_count - 1, 0) WHERE id = OLD.review_id;
  ELSIF OLD.vote_type = 'fake' THEN
    UPDATE reviews SET fake_count = GREATEST(fake_count - 1, 0) WHERE id = OLD.review_id;
  END IF;

  -- 新投票をインクリメント
  IF NEW.vote_type = 'real' THEN
    UPDATE reviews SET real_count = real_count + 1 WHERE id = NEW.review_id;
  ELSIF NEW.vote_type = 'fake' THEN
    UPDATE reviews SET fake_count = fake_count + 1 WHERE id = NEW.review_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_review_vote_update
  BEFORE UPDATE ON review_votes
  FOR EACH ROW
  EXECUTE FUNCTION review_vote_update();

-- 5. DELETE トリガー: 投票取消時にカウント -1
CREATE OR REPLACE FUNCTION review_vote_delete()
RETURNS trigger AS $$
BEGIN
  IF OLD.vote_type = 'real' THEN
    UPDATE reviews SET real_count = GREATEST(real_count - 1, 0) WHERE id = OLD.review_id;
  ELSIF OLD.vote_type = 'fake' THEN
    UPDATE reviews SET fake_count = GREATEST(fake_count - 1, 0) WHERE id = OLD.review_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_review_vote_delete
  AFTER DELETE ON review_votes
  FOR EACH ROW
  EXECUTE FUNCTION review_vote_delete();

-- 6. RLS
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_votes_select" ON review_votes
  FOR SELECT USING (true);

CREATE POLICY "review_votes_insert" ON review_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "review_votes_update" ON review_votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "review_votes_delete" ON review_votes
  FOR DELETE USING (auth.uid() = user_id);
