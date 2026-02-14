-- ============================================================
-- セラピストデータクレンジング
-- bustカラムのカップ情報混在を修正、cup表記正規化
-- ============================================================

BEGIN;

-- ============================================================
-- 2a. 元データ退避カラム追加
-- ============================================================
ALTER TABLE therapists ADD COLUMN name_raw text;
ALTER TABLE therapists ADD COLUMN bust_raw text;

-- ============================================================
-- 2b. 元データを退避
-- ============================================================
UPDATE therapists SET name_raw = name, bust_raw = bust;

-- ============================================================
-- 2c. bustがアルファベット1文字のみ（A〜M）→ cupに移動
--     対象: E(88), D(75), C(44), F(18), G(15), H(10), B(7), I(2) = 259件
-- ============================================================
UPDATE therapists
SET cup = upper(bust), bust = NULL
WHERE bust ~ '^[A-Ma-m]$'
  AND (cup IS NULL OR cup = '');

-- ============================================================
-- 2c-2. bustが「Xカップ」「X CUP」「Xcup」「X cup」→ cupに移動
--       対象: Fカップ(85), Dカップ(69), Gカップ(57)... = 389件
-- ============================================================
UPDATE therapists
SET cup = upper(substring(bust FROM '^([A-Ma-m])')), bust = NULL
WHERE bust ~* '^[A-M]\s*(カップ|cup)$'
  AND (cup IS NULL OR cup = '');

-- ============================================================
-- 2c-3. 特殊ケース: 「H(カップ数)」→ H、「ABC-Fカップ」→ F
-- ============================================================
UPDATE therapists
SET cup = 'H', bust = NULL
WHERE bust = 'H(カップ数)'
  AND (cup IS NULL OR cup = '');

UPDATE therapists
SET cup = 'F', bust = NULL
WHERE bust = 'ABC-Fカップ'
  AND (cup IS NULL OR cup = '');

-- ============================================================
-- 2d. bustに数値+カップが結合（例: `83(D)`）→ 分離
--     ※現データでは0件だが将来のデータ投入に備えて残す
-- ============================================================
UPDATE therapists
SET bust = substring(bust FROM '^(\d+)'),
    cup = upper(substring(bust FROM '\(([A-Ma-m])\)'))
WHERE bust ~ '^\d+\([A-Ma-m]\)'
  AND (cup IS NULL OR cup = '');

-- ============================================================
-- 2e. nameにスペック結合（例: `はる146cmB.90(G)W.57H.85`）→ 分離
--     ※現データでは0件だが将来のデータ投入に備えて残す
-- ============================================================
UPDATE therapists
SET name = substring(name FROM '^(.+?)\d{2,3}cm'),
    height = COALESCE(height, (substring(name FROM '(\d{2,3})cm'))::int),
    bust = COALESCE(bust, substring(name FROM 'B\.(\d{2,3})')),
    cup = COALESCE(cup, upper(substring(name FROM 'B\.\d{2,3}\(([A-Ma-m])\)'))),
    waist = COALESCE(waist, (substring(name FROM 'W\.(\d{2,3})'))::int),
    hip = COALESCE(hip, (substring(name FROM 'H\.(\d{2,3})'))::int)
WHERE name ~ '^\S+\d{2,3}cmB\.\d';

-- ============================================================
-- 2f. cup表記の最終正規化（大文字1文字に統一）
-- ============================================================
UPDATE therapists
SET cup = upper(substring(cup FROM '([A-Ma-m])'))
WHERE cup IS NOT NULL AND cup <> '' AND cup !~ '^[A-M]$';

COMMIT;
