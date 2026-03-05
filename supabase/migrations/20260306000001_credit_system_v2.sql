-- ============================================================
-- クレジット制v2: 7日失効 + 永久アンロック + 却下理由 + クレジット量変更
-- ============================================================

-- ============================
-- 1. 初期クレジットトリガー削除（初期クレジット=0に変更）
-- ============================
DROP TRIGGER IF EXISTS on_profile_insert_grant_credits ON profiles;
DROP FUNCTION IF EXISTS grant_initial_credits();

-- ============================
-- 2. クレジット7日失効カラム追加
-- ============================
ALTER TABLE profiles ADD COLUMN credits_expires_at timestamptz;

-- ============================
-- 3. therapist_unlocks に永久フラグ追加
-- ============================
ALTER TABLE therapist_unlocks ADD COLUMN is_permanent boolean NOT NULL DEFAULT false;

-- ============================
-- 4. reviews に却下理由カラム追加
-- ============================
ALTER TABLE reviews ADD COLUMN rejection_reason text;

-- ============================
-- 5. approve_review 改修（5/10クレジット + 7日失効設定）
-- ============================
CREATE OR REPLACE FUNCTION approve_review(review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_has_screenshot boolean;
  v_credits int := 5;
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
    v_credits := 10;
  END IF;

  -- プロフィール更新: クレジット付与 + 7日失効設定
  UPDATE profiles SET
    total_review_count = COALESCE(total_review_count, 0) + 1,
    monthly_review_count = COALESCE(monthly_review_count, 0) + 1,
    monthly_review_reset_at = COALESCE(monthly_review_reset_at, now()),
    review_credits = COALESCE(review_credits, 0) + v_credits,
    credits_expires_at = now() + interval '7 days'
  WHERE id = v_user_id;
END;
$$;

-- ============================
-- 6. reject_review 改修（理由パラメータ追加）
-- ============================
CREATE OR REPLACE FUNCTION reject_review(review_id uuid, p_reason text DEFAULT NULL)
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
    SET moderation_status = 'rejected',
        rejection_reason = p_reason
    WHERE id = review_id AND moderation_status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found or already processed';
  END IF;
END;
$$;

-- ============================
-- 7. get_profile_with_reset 改修（クレジット失効 + credits_expires_at返却）
-- ============================
DROP FUNCTION IF EXISTS get_profile_with_reset(uuid);
CREATE FUNCTION get_profile_with_reset(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  nickname text,
  membership_type text,
  view_permission_until timestamptz,
  monthly_review_count int,
  monthly_review_reset_at timestamptz,
  total_review_count int,
  is_admin bool,
  created_at timestamptz,
  review_credits int,
  credits_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 月次リセット（既存ロジック）
  UPDATE profiles p SET
    monthly_review_count = 0,
    monthly_review_reset_at = now()
  WHERE p.id = p_user_id
    AND (
      p.monthly_review_reset_at IS NULL
      OR p.monthly_review_reset_at < now() - interval '1 month'
    );

  -- クレジット7日失効チェック（lazy評価）
  UPDATE profiles p SET
    review_credits = 0,
    credits_expires_at = NULL
  WHERE p.id = p_user_id
    AND p.credits_expires_at IS NOT NULL
    AND p.credits_expires_at < now();

  -- プロフィール返却
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
    p.created_at,
    p.review_credits,
    p.credits_expires_at
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$;

-- ============================
-- 8. unlock_therapist 改修（期限切れチェック追加）
-- ============================
CREATE OR REPLACE FUNCTION unlock_therapist(p_therapist_id int8)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_membership text;
  v_credits_expires_at timestamptz;
  v_unlock record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 課金ユーザーは無条件OK
  SELECT membership_type, p.credits_expires_at
    INTO v_membership, v_credits_expires_at
    FROM profiles p WHERE p.id = v_user_id;

  IF v_membership IN ('standard', 'vip') THEN
    RETURN true;
  END IF;

  -- 既にアンロック済みかチェック
  SELECT * INTO v_unlock FROM therapist_unlocks
    WHERE user_id = v_user_id AND therapist_id = p_therapist_id;

  IF FOUND THEN
    -- 永久アンロックならOK
    IF v_unlock.is_permanent THEN
      RETURN true;
    END IF;
    -- クレジットが有効期限内ならOK（再消費なし）
    IF v_credits_expires_at IS NOT NULL AND v_credits_expires_at > now() THEN
      RETURN true;
    END IF;
    -- 期限切れ → 過去のアンロックは無効、新たにクレジット消費が必要
  END IF;

  -- クレジット期限切れチェック
  IF v_credits_expires_at IS NULL OR v_credits_expires_at < now() THEN
    -- 期限切れならクレジットをリセット
    UPDATE profiles SET review_credits = 0, credits_expires_at = NULL
      WHERE id = v_user_id;
    RETURN false;
  END IF;

  -- アトミックにクレジット消費（race condition防止）
  UPDATE profiles
    SET review_credits = review_credits - 1
    WHERE id = v_user_id AND review_credits > 0;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- アンロックレコード挿入（既存レコードがあればスキップ）
  INSERT INTO therapist_unlocks (user_id, therapist_id, is_permanent)
    VALUES (v_user_id, p_therapist_id, false)
    ON CONFLICT (user_id, therapist_id) DO NOTHING;

  RETURN true;
END;
$$;

-- ============================
-- 9. is_therapist_unlocked RPC（フロント用の状態確認）
-- ============================
CREATE OR REPLACE FUNCTION is_therapist_unlocked(p_therapist_id int8)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_membership text;
  v_credits_expires_at timestamptz;
  v_unlock record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 課金ユーザーは無条件OK
  SELECT membership_type, p.credits_expires_at
    INTO v_membership, v_credits_expires_at
    FROM profiles p WHERE p.id = v_user_id;

  IF v_membership IN ('standard', 'vip') THEN
    RETURN true;
  END IF;

  -- アンロックレコード確認
  SELECT * INTO v_unlock FROM therapist_unlocks
    WHERE user_id = v_user_id AND therapist_id = p_therapist_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 永久アンロック
  IF v_unlock.is_permanent THEN
    RETURN true;
  END IF;

  -- クレジット有効期限内のみ有効
  RETURN v_credits_expires_at IS NOT NULL AND v_credits_expires_at > now();
END;
$$;
