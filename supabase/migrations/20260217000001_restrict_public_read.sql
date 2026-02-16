-- ============================================================
-- anon key による公開読み取りを制限
-- API Routes は service_role を使うため RLS をバイパスする
-- prefectures / areas は公開マスタのため維持
-- ============================================================

-- therapists: anon 読み取り不可 → 認証済みユーザーのみ
DROP POLICY IF EXISTS "therapists_read" ON therapists;
CREATE POLICY "therapists_read_authenticated" ON therapists
  FOR SELECT USING (auth.role() = 'authenticated');

-- salons: 同上
DROP POLICY IF EXISTS "salons_read" ON salons;
CREATE POLICY "salons_read_authenticated" ON salons
  FOR SELECT USING (auth.role() = 'authenticated');

-- salon_areas: 同上
DROP POLICY IF EXISTS "salon_areas_read" ON salon_areas;
CREATE POLICY "salon_areas_read_authenticated" ON salon_areas
  FOR SELECT USING (auth.role() = 'authenticated');
