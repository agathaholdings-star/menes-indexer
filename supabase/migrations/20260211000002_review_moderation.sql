-- ============================================================
-- 口コミモデレーションシステム
-- moderation_status, is_admin, RLS更新, approve/reject関数
-- ============================================================

-- 1a. reviews に moderation_status 追加
ALTER TABLE reviews ADD COLUMN moderation_status text NOT NULL DEFAULT 'pending';

-- 既存データは承認済みとしてバックフィル
UPDATE reviews SET moderation_status = 'approved' WHERE moderation_status = 'pending';

ALTER TABLE reviews ADD CONSTRAINT chk_moderation_status
  CHECK (moderation_status IN ('pending','approved','rejected'));

CREATE INDEX idx_reviews_moderation_status ON reviews(moderation_status);

-- 1b. profiles に is_admin 追加
ALTER TABLE profiles ADD COLUMN is_admin bool NOT NULL DEFAULT false;

-- 初期管理者をセット
UPDATE profiles SET is_admin = true
  WHERE id IN (SELECT id FROM auth.users WHERE email = 'info@agatha-holdings.co.jp');

-- 1c. RLS ポリシー更新

-- 既存の全員読み取りポリシーを削除
DROP POLICY IF EXISTS "reviews_read" ON reviews;

-- 一般ユーザー: 承認済み + 自分の投稿のみ閲覧可
CREATE POLICY "reviews_read_approved" ON reviews
  FOR SELECT USING (
    moderation_status = 'approved'
    OR user_id = auth.uid()
  );

-- 管理者: 全件閲覧可
CREATE POLICY "reviews_read_admin" ON reviews
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 管理者: 全件削除可
CREATE POLICY "reviews_delete_admin" ON reviews
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 1d. approve_review 関数 (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION approve_review(review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_membership text;
BEGIN
  -- 管理者チェック
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  -- レビューのユーザーIDを取得 + ステータス更新
  UPDATE reviews
    SET moderation_status = 'approved'
    WHERE id = review_id AND moderation_status = 'pending'
    RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Review not found or already processed';
  END IF;

  -- プロフィール更新: review count インクリメント
  -- 無料会員なら3日間見放題を付与
  SELECT membership_type INTO v_membership
    FROM profiles WHERE id = v_user_id;

  IF v_membership = 'free' THEN
    UPDATE profiles SET
      total_review_count = total_review_count + 1,
      monthly_review_count = monthly_review_count + 1,
      view_permission_until = GREATEST(COALESCE(view_permission_until, now()), now()) + interval '3 days'
    WHERE id = v_user_id;
  ELSE
    UPDATE profiles SET
      total_review_count = total_review_count + 1,
      monthly_review_count = monthly_review_count + 1
    WHERE id = v_user_id;
  END IF;
END;
$$;

-- 1e. reject_review 関数 (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION reject_review(review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 管理者チェック
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  UPDATE reviews
    SET moderation_status = 'rejected'
    WHERE id = review_id AND moderation_status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found or already processed';
  END IF;
END;
$$;
