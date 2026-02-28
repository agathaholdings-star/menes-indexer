-- person_id 投入スクリプト
-- 同じ名前で複数サロンに在籍するセラピストを同一人物として紐づける
-- 1サロンのみの場合は person_id = NULL（移籍なし）
--
-- 使い方: psql $DB_URL -f database/populate_person_id.sql

BEGIN;

-- 既存の person_id をクリア
UPDATE therapists SET person_id = NULL WHERE person_id IS NOT NULL;

-- 同名で2つ以上のサロンに在籍しているセラピストにperson_idを付与
WITH multi_salon_names AS (
  -- 複数サロンに存在する名前を抽出
  SELECT name
  FROM therapists
  WHERE name IS NOT NULL
    AND length(trim(name)) >= 2
  GROUP BY name
  HAVING COUNT(DISTINCT salon_id) >= 2
),
person_ids AS (
  -- 名前ごとに連番を振る
  SELECT name, DENSE_RANK() OVER (ORDER BY name) AS pid
  FROM multi_salon_names
)
UPDATE therapists t
SET person_id = p.pid
FROM person_ids p
WHERE t.name = p.name;

-- 結果サマリ
SELECT
  COUNT(*) FILTER (WHERE person_id IS NOT NULL) AS "person_id付与済み",
  COUNT(DISTINCT person_id) AS "ユニーク人物数",
  COUNT(*) AS "全セラピスト数"
FROM therapists;

COMMIT;
