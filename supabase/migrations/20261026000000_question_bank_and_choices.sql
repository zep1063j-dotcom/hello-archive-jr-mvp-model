-- 질문 은행과 부모별 "이번 주 질문" 선택 (D-025, SESSION 09)
-- 기본 질문(weekly_questions)은 모든 부모에게 같다. 부모는 이번 주 질문을 은행의 다른 질문으로 바꾸거나 직접 쓴 질문으로 바꿀 수 있다.
-- 기록(entries)은 그대로 주 질문(weekly_questions) 하나에 매달리고, 선택은 "그 주를 어떤 질문으로 보여 줄지"만 정한다.
-- 그래서 한 주에 기록은 부모·자녀당 1개이고(기존 유니크 유지), 메일·지표·챕터 로직은 바뀌지 않는다.
-- 적용 순서: 이 마이그레이션 → supabase/seed/question_bank.sql (→ 새 주간 시드). 앱 배포는 마이그레이션 적용 뒤에 한다.

-- ---------------------------------------------------------------------------
-- question_bank: 시스템이 제공하는 예시 질문. 읽기 전용(시드로만 추가).
-- ---------------------------------------------------------------------------
create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  body text not null unique,
  created_at timestamptz not null default now(),
  constraint question_bank_body_length check (char_length(btrim(body)) between 1 and 200)
);

-- ---------------------------------------------------------------------------
-- week_question_choices: 부모가 어떤 주의 질문을 바꿨는지. 부모·주마다 최대 1개.
--  - source = 'bank'  : 은행에서 골랐다(bank_question_id 필수)
--  - source = 'custom': 직접 썼다(bank_question_id 없음)
--  - body 는 고른 시점의 문구를 그대로 저장한다(은행 문구가 나중에 바뀌어도 기록의 질문은 그대로).
-- ---------------------------------------------------------------------------
create table public.week_question_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weekly_question_id uuid not null references public.weekly_questions (id),
  source text not null,
  bank_question_id uuid references public.question_bank (id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint week_question_choices_source_check check (source in ('bank', 'custom')),
  constraint week_question_choices_bank_ref_check check ((source = 'bank') = (bank_question_id is not null)),
  -- 공백만 불가(정규식, D-014), 직접 쓴 질문은 앱이 100자로 제한하고 DB는 은행 문구 길이까지 허용
  constraint week_question_choices_body_check check (body ~ '[^\s​]' and char_length(body) <= 200),
  constraint week_question_choices_user_week_key unique (user_id, weekly_question_id)
);

create trigger week_question_choices_set_updated_at
  before update on public.week_question_choices
  for each row execute function public.set_updated_at();

alter table public.question_bank enable row level security;
alter table public.week_question_choices enable row level security;

revoke all on public.question_bank, public.week_question_choices from anon, authenticated;

grant select on public.question_bank to authenticated;
grant select, delete on public.week_question_choices to authenticated;
grant insert (user_id, weekly_question_id, source, bank_question_id, body) on public.week_question_choices to authenticated;
grant update (source, bank_question_id, body) on public.week_question_choices to authenticated;

create policy question_bank_select_authenticated on public.question_bank
  for select to authenticated using (true);

-- 선택 조회는 본인 것만. 쓰기(추가·수정·삭제)는 본인 것이면서 "그 주에 이미 기록이 있으면 불가":
-- 기록을 남기면 그 주 질문이 고정되고(아카이브의 질문 문구가 바뀌지 않게), 기록을 지우면 다시 바꿀 수 있다.
create policy week_question_choices_select_own on public.week_question_choices
  for select to authenticated using (user_id = (select auth.uid()));

create policy week_question_choices_insert_own on public.week_question_choices
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not exists (
      select 1 from public.entries e
      where e.user_id = week_question_choices.user_id
        and e.weekly_question_id = week_question_choices.weekly_question_id
    )
  );

create policy week_question_choices_update_own on public.week_question_choices
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and not exists (
      select 1 from public.entries e
      where e.user_id = week_question_choices.user_id
        and e.weekly_question_id = week_question_choices.weekly_question_id
    )
  )
  with check (
    user_id = (select auth.uid())
    and not exists (
      select 1 from public.entries e
      where e.user_id = week_question_choices.user_id
        and e.weekly_question_id = week_question_choices.weekly_question_id
    )
  );

create policy week_question_choices_delete_own on public.week_question_choices
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and not exists (
      select 1 from public.entries e
      where e.user_id = week_question_choices.user_id
        and e.weekly_question_id = week_question_choices.weekly_question_id
    )
  );
