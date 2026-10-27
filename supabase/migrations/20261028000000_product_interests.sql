-- 제작(PDF·종이책) 관심 표시 (D-036, SESSION 09)
-- 제작 탭에서 "받아보고 싶어요"를 누른 부모를 기록한다. 실제 PDF 생성·주문·결제는 아직 없고, 수요를 세기 위한 표시다.
-- 부모(계정)마다 상품당 한 번. 취소하면 행을 지운다. 수정할 컬럼은 없다.
-- 적용 순서: 20261027000000 → 이 파일. 앱 배포는 적용 뒤에 한다.

create table public.product_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 앱의 제작 상품 키: pdf(PDF 파일), book(종이책)
  product text not null,
  created_at timestamptz not null default now(),
  constraint product_interests_product_check check (product in ('pdf', 'book')),
  constraint product_interests_user_product_key unique (user_id, product)
);

alter table public.product_interests enable row level security;

revoke all on public.product_interests from anon, authenticated;
grant select, delete on public.product_interests to authenticated;
grant insert (user_id, product) on public.product_interests to authenticated;

create policy product_interests_select_own on public.product_interests
  for select to authenticated using (user_id = (select auth.uid()));
create policy product_interests_insert_own on public.product_interests
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy product_interests_delete_own on public.product_interests
  for delete to authenticated using (user_id = (select auth.uid()));
