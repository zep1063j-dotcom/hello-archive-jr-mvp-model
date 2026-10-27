-- 4번: 제작(PDF·종이책) 관심 표시 테이블 (D-036). 개발 DB → 정식 DB 순서로, 앱 배포(push)보다 먼저 SQL Editor에서 실행한다.
-- 1~3번을 이미 적용한 DB에서 실행한다. 여러 번 실행해도 안전하다.

create table if not exists public.product_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product text not null,
  created_at timestamptz not null default now(),
  constraint product_interests_product_check check (product in ('pdf', 'book')),
  constraint product_interests_user_product_key unique (user_id, product)
);

alter table public.product_interests enable row level security;

revoke all on public.product_interests from anon, authenticated;
grant select, delete on public.product_interests to authenticated;
grant insert (user_id, product) on public.product_interests to authenticated;

drop policy if exists product_interests_select_own on public.product_interests;
drop policy if exists product_interests_insert_own on public.product_interests;
drop policy if exists product_interests_delete_own on public.product_interests;

create policy product_interests_select_own on public.product_interests
  for select to authenticated using (user_id = (select auth.uid()));
create policy product_interests_insert_own on public.product_interests
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy product_interests_delete_own on public.product_interests
  for delete to authenticated using (user_id = (select auth.uid()));
