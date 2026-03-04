-- slug自動設定トリガー
--
-- INSERT時にslug=NULLならid::textを自動設定。
-- これによりアプリ側の「INSERT後にUPDATE slug」が不要になる。

CREATE OR REPLACE FUNCTION set_therapist_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_therapist_slug
  BEFORE INSERT ON therapists
  FOR EACH ROW EXECUTE FUNCTION set_therapist_slug();

-- 既存のslug=NULLレコードを修正
UPDATE therapists SET slug = id::text WHERE slug IS NULL;
