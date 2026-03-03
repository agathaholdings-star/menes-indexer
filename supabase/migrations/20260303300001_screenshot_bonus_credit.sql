-- approve_review にスクリーンショット添付ボーナス（+5クレジット）を追加
-- verification_image_path が NULL でなければ 15、NULL なら従来通り 10
CREATE OR REPLACE FUNCTION approve_review(review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_membership text;
  v_has_screenshot boolean;
  v_credits int := 10;
BEGIN
  -- 管理者チェック
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  -- レビューのユーザーIDを取得 + ステータス更新
  UPDATE reviews
    SET moderation_status = 'approved'
    WHERE id = review_id AND moderation_status = 'pending'
    RETURNING user_id, (verification_image_path IS NOT NULL) INTO v_user_id, v_has_screenshot;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Review not found or already processed';
  END IF;

  -- スクショボーナス
  IF v_has_screenshot THEN
    v_credits := 15;
  END IF;

  -- メンバーシップ取得
  SELECT membership_type INTO v_membership FROM profiles WHERE id = v_user_id;

  -- プロフィール更新: 全ユーザーにクレジット付与
  UPDATE profiles SET
    total_review_count = COALESCE(total_review_count, 0) + 1,
    monthly_review_count = COALESCE(monthly_review_count, 0) + 1,
    monthly_review_reset_at = COALESCE(monthly_review_reset_at, now()),
    review_credits = COALESCE(review_credits, 0) + v_credits
  WHERE id = v_user_id;
END;
$$;
