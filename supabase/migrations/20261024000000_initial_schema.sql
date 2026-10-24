-- Hello Archive jr 초기 스키마 (SESSION 02)
-- 설계: docs/handoff/ARCHITECTURE.md 5절, 결정: DECISIONS.md D-005 / D-013
-- 모든 테이블에 RLS를 켜고, 클라이언트 역할(anon/authenticated)에는 필요한 권한만 준다.
-- 소유권은 RLS(행) + 컬럼 단위 GRANT(바꿀 수 있는 컬럼)로 이중 방어한다.

-- ---------------------------------------------------------------------------
-- 공통 함수
-- ---------------------------------------------------------------------------

-- updated_at 자동 갱신 (클라이언트가 보낸 값은 무시한다)
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- parent_settings: 부모(auth.users) 1:1 설정. 이메일 수신 동의는 기본 거부.
-- ---------------------------------------------------------------------------
create table public.parent_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_consent boolean not null default false,
  consent_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 동의 여부가 바뀐 시각을 서버에서 기록한다 (클라이언트 값 무시)
create function public.set_consent_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.email_consent is distinct from old.email_consent then
    new.consent_updated_at := now();
  else
    new.consent_updated_at := old.consent_updated_at;
  end if;
  return new;
end;
$$;

create trigger parent_settings_set_updated_at
  before update on public.parent_settings
  for each row execute function public.set_updated_at();

create trigger parent_settings_set_consent_updated_at
  before insert or update on public.parent_settings
  for each row execute function public.set_consent_updated_at();

-- ---------------------------------------------------------------------------
-- children: 자녀. 테이블은 여러 명을 허용하고, 1명 제한은 앱 로직(SESSION 04)에서 한다.
-- ---------------------------------------------------------------------------
create table public.children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null,
  birth_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint children_nickname_length check (char_length(btrim(nickname)) between 1 and 30),
  -- 오늘(한국 시간) 이후 불가
  constraint children_birth_date_not_future check (birth_date <= (now() at time zone 'Asia/Seoul')::date),
  -- entries의 복합 FK 대상: 기록이 반드시 "같은 부모의 자녀"를 가리키게 한다
  constraint children_id_user_id_key unique (id, user_id)
);

create index children_user_id_idx on public.children (user_id);

create trigger children_set_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- weekly_questions: 모든 부모가 같은 주에 같은 질문. 시드로 관리하며 읽기 전용.
-- ---------------------------------------------------------------------------
create table public.weekly_questions (
  id uuid primary key default gen_random_uuid(),
  -- 한국 시간 기준 월요일 날짜
  week_start date not null unique,
  body text not null,
  hint text,
  constraint weekly_questions_week_start_is_monday check (extract(isodow from week_start) = 1),
  constraint weekly_questions_body_not_blank check (char_length(btrim(body)) > 0)
);

-- ---------------------------------------------------------------------------
-- entries: 텍스트 기록. 같은 아이·같은 주 질문에는 하나만 (재작성은 수정).
-- ---------------------------------------------------------------------------
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  child_id uuid not null,
  weekly_question_id uuid not null references public.weekly_questions (id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entries_body_length check (char_length(btrim(body)) between 1 and 5000),
  -- 타인의 자녀에게 기록을 쓸 수 없다. 자녀가 지워지면 기록도 함께 지워진다.
  constraint entries_child_owner_fkey foreign key (child_id, user_id)
    references public.children (id, user_id) on delete cascade,
  constraint entries_child_question_key unique (child_id, weekly_question_id)
);

create index entries_user_id_created_at_idx on public.entries (user_id, created_at desc);
create index entries_child_id_created_at_idx on public.entries (child_id, created_at desc);

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- email_deliveries: 주간 이메일 발송 내역. 서버 전용(service role)만 접근한다.
-- error_code에는 본문·이메일 주소를 저장하지 않는다.
-- ---------------------------------------------------------------------------
create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weekly_question_id uuid not null references public.weekly_questions (id),
  status text not null default 'processing',
  attempts integer not null default 0,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  error_code text,
  constraint email_deliveries_status_check check (status in ('processing', 'sent', 'failed', 'skipped')),
  -- 같은 부모에게 같은 주 질문 메일을 두 번 보내지 않는다
  constraint email_deliveries_user_question_key unique (user_id, weekly_question_id)
);

-- ---------------------------------------------------------------------------
-- RLS 활성화
-- ---------------------------------------------------------------------------
alter table public.parent_settings enable row level security;
alter table public.children enable row level security;
alter table public.weekly_questions enable row level security;
alter table public.entries enable row level security;
alter table public.email_deliveries enable row level security;

-- ---------------------------------------------------------------------------
-- 권한 (GRANT): 기본 부여분을 모두 회수한 뒤 필요한 것만 준다.
-- 컬럼 단위로 제한해 소유자·생성 시각 같은 값은 클라이언트가 바꾸지 못하게 한다.
-- service_role은 RLS를 우회하므로 별도 조치하지 않는다 (서버 전용 키).
-- ---------------------------------------------------------------------------
revoke all on public.parent_settings, public.children, public.weekly_questions,
  public.entries, public.email_deliveries from anon, authenticated;

-- parent_settings
grant select, delete on public.parent_settings to authenticated;
grant insert (user_id, email_consent) on public.parent_settings to authenticated;
grant update (email_consent) on public.parent_settings to authenticated;

-- children
grant select, delete on public.children to authenticated;
grant insert (user_id, nickname, birth_date) on public.children to authenticated;
grant update (nickname, birth_date) on public.children to authenticated;

-- weekly_questions: 읽기 전용
grant select on public.weekly_questions to authenticated;

-- entries: 본문만 수정 가능 (소유자·자녀·질문은 생성 후 변경 불가)
grant select, delete on public.entries to authenticated;
grant insert (user_id, child_id, weekly_question_id, body) on public.entries to authenticated;
grant update (body) on public.entries to authenticated;

-- email_deliveries: anon/authenticated 권한 없음 (위 revoke로 충분, 정책도 만들지 않는다)

-- ---------------------------------------------------------------------------
-- RLS 정책: auth.uid() = user_id 인 행만. (select auth.uid())로 감싸 행마다 재평가하지 않게 한다.
-- ---------------------------------------------------------------------------
create policy parent_settings_select_own on public.parent_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy parent_settings_insert_own on public.parent_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy parent_settings_update_own on public.parent_settings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy parent_settings_delete_own on public.parent_settings
  for delete to authenticated using (user_id = (select auth.uid()));

create policy children_select_own on public.children
  for select to authenticated using (user_id = (select auth.uid()));
create policy children_insert_own on public.children
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy children_update_own on public.children
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy children_delete_own on public.children
  for delete to authenticated using (user_id = (select auth.uid()));

create policy weekly_questions_select_authenticated on public.weekly_questions
  for select to authenticated using (true);

create policy entries_select_own on public.entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy entries_insert_own on public.entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy entries_update_own on public.entries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy entries_delete_own on public.entries
  for delete to authenticated using (user_id = (select auth.uid()));
