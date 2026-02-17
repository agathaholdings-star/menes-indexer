-- ============================================================
-- 分類マスタ4テーブル + reviews構造変更（seed口コミ対応）
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 分類マスタテーブル作成 + シードデータ
-- ============================================================

-- 1a. looks_types（見た目タイプ）
CREATE TABLE looks_types (
    id int PRIMARY KEY,
    label text NOT NULL UNIQUE
);

INSERT INTO looks_types (id, label) VALUES
    (1, '清楚系'),
    (2, '素人系'),
    (3, 'ギャル系'),
    (4, 'モデル系'),
    (5, '妹系'),
    (6, '女優系'),
    (7, '夜職系'),
    (8, '熟女系');

-- 1b. body_types（体型）
CREATE TABLE body_types (
    id int PRIMARY KEY,
    label text NOT NULL UNIQUE
);

INSERT INTO body_types (id, label) VALUES
    (1, 'スレンダー'),
    (2, '普通'),
    (3, 'グラマー'),
    (4, 'ぽっちゃり');

-- 1c. cup_types（おっぱい）
CREATE TABLE cup_types (
    id int PRIMARY KEY,
    label text NOT NULL UNIQUE
);

INSERT INTO cup_types (id, label) VALUES
    (1, 'ちょうどいい'),
    (2, '巨乳'),
    (3, 'ちっぱい'),
    (4, '爆乳');

-- 1d. service_levels（サービス）
CREATE TABLE service_levels (
    id int PRIMARY KEY,
    label text NOT NULL UNIQUE
);

INSERT INTO service_levels (id, label) VALUES
    (1, '健全'),
    (2, 'SKR'),
    (3, 'HR');

-- RLS: マスタは全員読み取り可
ALTER TABLE looks_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "looks_types_read" ON looks_types FOR SELECT USING (true);

ALTER TABLE body_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "body_types_read" ON body_types FOR SELECT USING (true);

ALTER TABLE cup_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cup_types_read" ON cup_types FOR SELECT USING (true);

ALTER TABLE service_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_levels_read" ON service_levels FOR SELECT USING (true);

-- ============================================================
-- 2. reviews テーブル構造変更
-- ============================================================

-- 2a. 旧テキストCHECK制約を削除
ALTER TABLE reviews DROP CONSTRAINT chk_looks_type;
ALTER TABLE reviews DROP CONSTRAINT chk_body_type;
ALTER TABLE reviews DROP CONSTRAINT chk_service_level;

-- 2b. 旧テキストカラムを削除（現在0件なのでデータロスなし）
ALTER TABLE reviews DROP COLUMN looks_type;
ALTER TABLE reviews DROP COLUMN body_type;
ALTER TABLE reviews DROP COLUMN service_level;

-- 2c. 新FKカラムを追加
ALTER TABLE reviews ADD COLUMN looks_type_id int REFERENCES looks_types(id);
ALTER TABLE reviews ADD COLUMN body_type_id int REFERENCES body_types(id);
ALTER TABLE reviews ADD COLUMN cup_type_id int REFERENCES cup_types(id);
ALTER TABLE reviews ADD COLUMN service_level_id int REFERENCES service_levels(id);

-- 2d. user_id を NULL許容に変更（seed口コミ用）
ALTER TABLE reviews ALTER COLUMN user_id DROP NOT NULL;

-- 2e. is_seed カラム追加
ALTER TABLE reviews ADD COLUMN is_seed bool NOT NULL DEFAULT false;

-- ============================================================
-- 3. approve_review 関数を更新
--    seed口コミ(user_id=null)のプロフィール更新をスキップ
-- ============================================================

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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found or already processed';
  END IF;

  -- seed口コミ(user_id=null)はプロフィール更新をスキップ
  IF v_user_id IS NULL THEN
    RETURN;
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

COMMIT;
