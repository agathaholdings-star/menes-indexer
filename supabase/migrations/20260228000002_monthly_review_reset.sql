-- ============================================================
-- 月次レビューカウント リセット機能
-- 遅延評価パターン: profile取得時にリセット要否を判定
-- ============================================================

-- 1. get_profile_with_reset: profileを返す際に月次リセットを実行
CREATE OR REPLACE FUNCTION get_profile_with_reset(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  nickname text,
  membership_type text,
  view_permission_until timestamptz,
  monthly_review_count int,
  monthly_review_reset_at timestamptz,
  total_review_count int,
  is_admin bool,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- monthly_review_reset_at がNULL or 1ヶ月以上前 → リセット
  UPDATE profiles p SET
    monthly_review_count = 0,
    monthly_review_reset_at = now()
  WHERE p.id = p_user_id
    AND (
      p.monthly_review_reset_at IS NULL
      OR p.monthly_review_reset_at < now() - interval '1 month'
    );

  -- リセット済み（or リセット不要）のプロフィールを返す
  RETURN QUERY
  SELECT
    p.id,
    p.nickname,
    p.membership_type,
    p.view_permission_until,
    p.monthly_review_count,
    p.monthly_review_reset_at,
    p.total_review_count,
    p.is_admin,
    p.created_at
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$;

-- 2. approve_review を更新: monthly_review_reset_at の初期化を追加
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

  -- プロフィール更新
  SELECT membership_type INTO v_membership
    FROM profiles WHERE id = v_user_id;

  IF v_membership = 'free' THEN
    UPDATE profiles SET
      total_review_count = total_review_count + 1,
      monthly_review_count = monthly_review_count + 1,
      monthly_review_reset_at = COALESCE(monthly_review_reset_at, now()),
      view_permission_until = GREATEST(COALESCE(view_permission_until, now()), now()) + interval '3 days'
    WHERE id = v_user_id;
  ELSE
    UPDATE profiles SET
      total_review_count = total_review_count + 1,
      monthly_review_count = monthly_review_count + 1,
      monthly_review_reset_at = COALESCE(monthly_review_reset_at, now())
    WHERE id = v_user_id;
  END IF;
END;
$$;
