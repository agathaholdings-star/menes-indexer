-- ============================================================
-- 口コミクレジット制
-- 1投稿承認 = 10セラピスト分の閲覧クレジット
-- 無料ユーザーのみ。Standard/VIPは無制限閲覧。
-- ============================================================

-- (a) profiles にクレジット列追加
ALTER TABLE profiles ADD COLUMN review_credits integer NOT NULL DEFAULT 0;

-- (b) セラピスト解放テーブル（どのユーザーがどのセラピストを解放済みか）
CREATE TABLE therapist_unlocks (
  user_id      uuid  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  therapist_id int8  NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  unlocked_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, therapist_id)
);

ALTER TABLE therapist_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_unlocks_select" ON therapist_unlocks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own_unlocks_insert" ON therapist_unlocks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- (c) セラピスト解放RPC（クレジット消費）
CREATE OR REPLACE FUNCTION unlock_therapist(p_therapist_id int8)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_membership text;
  v_already boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 課金ユーザーは無条件OK
  SELECT membership_type INTO v_membership FROM profiles WHERE id = v_user_id;
  IF v_membership IN ('standard', 'vip') THEN
    RETURN true;
  END IF;

  -- 既に解放済みならOK（クレジット消費なし）
  SELECT EXISTS(
    SELECT 1 FROM therapist_unlocks
    WHERE user_id = v_user_id AND therapist_id = p_therapist_id
  ) INTO v_already;
  IF v_already THEN
    RETURN true;
  END IF;

  -- アトミックにクレジット消費（race condition防止）
  UPDATE profiles
    SET review_credits = review_credits - 1
    WHERE id = v_user_id AND review_credits > 0;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO therapist_unlocks (user_id, therapist_id) VALUES (v_user_id, p_therapist_id);
  RETURN true;
END;
$$;

-- (d) approve_review を更新（view_permission_until → review_credits +10）
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

  -- メンバーシップ取得
  SELECT membership_type INTO v_membership FROM profiles WHERE id = v_user_id;

  -- プロフィール更新: 全ユーザーにクレジット付与
  UPDATE profiles SET
    total_review_count = COALESCE(total_review_count, 0) + 1,
    monthly_review_count = COALESCE(monthly_review_count, 0) + 1,
    monthly_review_reset_at = COALESCE(monthly_review_reset_at, now()),
    review_credits = COALESCE(review_credits, 0) + 10
  WHERE id = v_user_id;
END;
$$;

-- (e) get_profile_with_reset を更新（review_credits を返す）
-- 返り値が変わるので DROP → CREATE が必要
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
  review_credits int
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
    p.created_at,
    p.review_credits
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$;

-- (f) 新規登録時に初期クレジット3を付与
CREATE OR REPLACE FUNCTION grant_initial_credits()
RETURNS TRIGGER AS $$
BEGIN
  NEW.review_credits := 3;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_insert_grant_credits
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION grant_initial_credits();
