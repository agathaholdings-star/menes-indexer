-- shops.official_url にUNIQUE制約を追加（同一サロンの重複防止）
-- NULLは複数許可（WHERE official_url IS NOT NULL）
CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_official_url_unique
  ON shops (official_url) WHERE official_url IS NOT NULL;
