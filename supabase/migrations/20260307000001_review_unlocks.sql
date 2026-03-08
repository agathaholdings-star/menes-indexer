-- ============================================================
-- 口コミ単位アンロック: therapist単位 → review単位に変更
-- ============================================================

-- ============================
-- 1. review_unlocks テーブル
-- ============================
CREATE TABLE review_unlocks (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  is_permanent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, review_id)
);

ALTER TABLE review_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own review unlocks"
  ON review_unlocks FOR SELECT
  USING (auth.uid() = user_id);

-- ============================
-- 2. unlock_review RPC（1クレジット消費して口コミをアンロック）
-- ============================
CREATE OR REPLACE FUNCTION unlock_review(p_review_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_membership text;
  v_credits_expires_at timestamptz;
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
  IF EXISTS (
    SELECT 1 FROM review_unlocks
    WHERE user_id = v_user_id AND review_id = p_review_id
    AND (is_permanent OR (v_credits_expires_at IS NOT NULL AND v_credits_expires_at > now()))
  ) THEN
    RETURN true;
  END IF;

  -- クレジット期限切れチェック
  IF v_credits_expires_at IS NULL OR v_credits_expires_at < now() THEN
    UPDATE profiles SET review_credits = 0, credits_expires_at = NULL
      WHERE id = v_user_id;
    RETURN false;
  END IF;

  -- アトミックにクレジット消費
  UPDATE profiles
    SET review_credits = review_credits - 1
    WHERE id = v_user_id AND review_credits > 0;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- アンロックレコード挿入
  INSERT INTO review_unlocks (user_id, review_id, is_permanent)
    VALUES (v_user_id, p_review_id, false)
    ON CONFLICT (user_id, review_id) DO NOTHING;

  RETURN true;
END;
$$;

-- ============================
-- 3. are_reviews_unlocked RPC（バッチチェック）
-- ============================
CREATE OR REPLACE FUNCTION are_reviews_unlocked(p_review_ids uuid[])
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_membership text;
  v_credits_expires_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  -- 課金ユーザーは全部アンロック
  SELECT membership_type, p.credits_expires_at
    INTO v_membership, v_credits_expires_at
    FROM profiles p WHERE p.id = v_user_id;

  IF v_membership IN ('standard', 'vip') THEN
    RETURN p_review_ids;
  END IF;

  -- review_unlocks + 旧therapist_unlocks（後方互換）からアンロック済みIDを返す
  RETURN ARRAY(
    SELECT ru.review_id FROM review_unlocks ru
    WHERE ru.user_id = v_user_id
      AND ru.review_id = ANY(p_review_ids)
      AND (ru.is_permanent OR (v_credits_expires_at IS NOT NULL AND v_credits_expires_at > now()))
    UNION
    SELECT r.id FROM reviews r
    JOIN therapist_unlocks tu ON tu.user_id = v_user_id AND tu.therapist_id = r.therapist_id
    WHERE r.id = ANY(p_review_ids)
      AND (tu.is_permanent OR (v_credits_expires_at IS NOT NULL AND v_credits_expires_at > now()))
  );
END;
$$;
