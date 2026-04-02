-- サイトマップ用: ページネーション対応版（全件取得→sliceのタイムアウト問題を解消）
create or replace function get_sitemap_therapists_page(p_offset int, p_limit int)
returns table (
  id bigint,
  updated_at timestamptz,
  has_reviews boolean
)
language sql
stable
as $$
  select
    t.id,
    t.updated_at,
    coalesce(t.review_count, 0) > 0 as has_reviews
  from therapists t
  inner join salons s on s.id = t.salon_id
  where s.published_at is not null
  order by
    (coalesce(t.review_count, 0) > 0) desc,
    t.id
  offset p_offset
  limit p_limit
$$;
