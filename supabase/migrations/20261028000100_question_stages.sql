-- 시기(유년·아동·청소년·청년)별 주간 질문과 질문 은행 (D-038, SESSION 09)
-- 같은 주에도 아이의 시기(생년월일로 계산)마다 다른 질문이 나온다. 기록(entries)은 그대로 질문 행 하나에 매달리므로
-- 한 주에 기록은 자녀당 1개이고(기존 유니크 유지), 아이가 자라 시기가 바뀌면 그 주부터 다음 시기의 질문 행을 쓴다.
-- 시기 키: early(만 0~6세) / child(7~12) / teen(13~18) / young(19 이상). 계산은 앱이 한다(src/lib/life-stage.ts).
-- 적용 순서: 20261028000000 → 이 파일 → supabase/seed/question_bank.sql → supabase/seed/weekly_questions.sql. 앱 배포는 적용 뒤에 한다.

-- ---------------------------------------------------------------------------
-- weekly_questions: 주마다 시기별 질문 하나. 기존 행은 모두 유년(early)이 된다.
-- ---------------------------------------------------------------------------
alter table public.weekly_questions
  add column if not exists stage text not null default 'early';

alter table public.weekly_questions drop constraint if exists weekly_questions_stage_check;
alter table public.weekly_questions
  add constraint weekly_questions_stage_check check (stage in ('early', 'child', 'teen', 'young'));

-- 주(week_start)만으로 하나이던 유니크를 (주, 시기)로 바꾼다.
alter table public.weekly_questions drop constraint if exists weekly_questions_week_start_key;
alter table public.weekly_questions drop constraint if exists weekly_questions_week_stage_key;
alter table public.weekly_questions
  add constraint weekly_questions_week_stage_key unique (week_start, stage);

-- ---------------------------------------------------------------------------
-- question_bank: 시기별 예시 질문. 예전(시기 없던) 예시 질문은 더 이상 보이지 않게 한다.
--  - active = false 인 행은 "바꾸기"에서 뽑지 않는다. 이미 누군가 고른 질문(week_question_choices 참조)은 지울 수 없어 숨기기만 한다.
-- ---------------------------------------------------------------------------
alter table public.question_bank
  add column if not exists stage text not null default 'early',
  add column if not exists active boolean not null default true;

alter table public.question_bank drop constraint if exists question_bank_stage_check;
alter table public.question_bank
  add constraint question_bank_stage_check check (stage in ('early', 'child', 'teen', 'young'));

-- 2026-10-28 00:00(KST) 이전에 만들어진 은행 행은 모두 옛 예시 질문이다: 숨기고, 참조가 없는 것은 지운다.
-- 날짜로 가르기 때문에 새 은행(시드)을 넣은 뒤 이 파일을 다시 실행해도 새 행은 건드리지 않는다.
update public.question_bank set active = false where created_at < timestamptz '2026-10-28 00:00:00+09';
delete from public.question_bank q
  where q.created_at < timestamptz '2026-10-28 00:00:00+09'
    and not exists (select 1 from public.week_question_choices c where c.bank_question_id = q.id);
