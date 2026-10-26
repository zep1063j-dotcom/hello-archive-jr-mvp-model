-- 매년 같은 질문의 답 (D-026, SESSION 09)
-- 질문 목록은 코드(src/lib/yearly-questions.ts)에 고정돼 있고, DB는 "자녀·연도·질문 키"별 답만 저장한다.
-- 한 해에 질문마다 답 하나(수정 가능). 지난 연도의 답은 앱이 읽기 전용으로 보여 주고, 해마다 나란히 비교한다.
-- 적용 순서: 20261026000000 → 이 파일. 앱 배포는 적용 뒤에 한다.

create table public.yearly_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  child_id uuid not null,
  -- 한국 시간 기준 달력 연도. 미래 연도는 쓸 수 없다.
  year integer not null,
  -- 앱의 질문 목록 키 (예: height, favorite). 목록이 바뀌어도 이미 저장된 답은 키로 남는다.
  question_key text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint yearly_answers_child_owner_fkey foreign key (child_id, user_id)
    references public.children (id, user_id) on delete cascade,
  constraint yearly_answers_year_check
    check (year between 2000 and (extract(year from (now() at time zone 'Asia/Seoul'))::int)),
  constraint yearly_answers_key_check check (question_key ~ '^[a-z][a-z0-9_]{0,29}$'),
  -- 공백만 불가(정규식, D-014), 1000자 이하
  constraint yearly_answers_body_check check (body ~ '[^\s​]' and char_length(body) <= 1000),
  constraint yearly_answers_child_year_key_key unique (child_id, year, question_key)
);

create index yearly_answers_user_id_year_idx on public.yearly_answers (user_id, year desc);

create trigger yearly_answers_set_updated_at
  before update on public.yearly_answers
  for each row execute function public.set_updated_at();

alter table public.yearly_answers enable row level security;

revoke all on public.yearly_answers from anon, authenticated;
grant select, delete on public.yearly_answers to authenticated;
grant insert (user_id, child_id, year, question_key, body) on public.yearly_answers to authenticated;
grant update (body) on public.yearly_answers to authenticated;

create policy yearly_answers_select_own on public.yearly_answers
  for select to authenticated using (user_id = (select auth.uid()));
create policy yearly_answers_insert_own on public.yearly_answers
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy yearly_answers_update_own on public.yearly_answers
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy yearly_answers_delete_own on public.yearly_answers
  for delete to authenticated using (user_id = (select auth.uid()));
