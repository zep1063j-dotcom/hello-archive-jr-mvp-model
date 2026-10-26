-- 적용 1/2: 질문 은행·부모별 질문 선택 + 시드 + 매년 같은 질문 (D-025, D-026)
-- 개발용 Supabase SQL Editor에서 통째로 한 번 실행한다. 이미 실행했다면 다시 실행하지 않는다(시드 부분만 여러 번 안전).

-- ===== 20261026000000_question_bank_and_choices.sql =====
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

-- ===== seed/question_bank.sql =====
-- 질문 은행 시드: 예시 질문 100개 (초안 — 문구는 사용자가 검토해 확정한다, D-025)
-- 여러 번 실행해도 안전하다 (이미 있는 문구는 건드리지 않음). 마이그레이션 20261026000000 적용 뒤에 실행한다.
-- 1~12번은 기존 주간 시드와 같은 문구, 13~52번은 아래 주간 시드(weekly_questions.sql)에도 쓴다.

insert into public.question_bank (body) values
  ('이번 주에 아이가 처음 해본 일이 있나요?'),
  ('아이가 요즘 푹 빠져 있는 놀이는 무엇인가요?'),
  ('아이가 최근에 가장 크게 웃은 순간은 언제인가요?'),
  ('요즘 아이가 자주 하는 말이나 말투는 무엇인가요?'),
  ('아이가 이번 주에 가장 열심히 했던 일은 무엇인가요?'),
  ('아이가 좋아하는 음식이나 싫어하는 음식에 대해 새로 알게 된 점이 있나요?'),
  ('아이가 잠들기 전에 하는 말이나 행동은 무엇인가요?'),
  ('이번 주에 아이에게 고마웠던 순간이 있나요?'),
  ('아이가 가족에게 해 준 말 중 기억에 남는 것은 무엇인가요?'),
  ('아이가 무서워하거나 낯설어한 것이 있었나요?'),
  ('요즘 아이가 가장 자주 묻는 질문은 무엇인가요?'),
  ('아이와 함께한 시간 중 가장 편안했던 순간은 언제인가요?'),
  ('이번 주 아침에 아이가 가장 먼저 한 말은 무엇이었나요?'),
  ('아이가 요즘 가장 좋아하는 노래나 소리는 무엇인가요?'),
  ('아이가 이번 주에 고집을 부린 일이 있었나요? 무엇 때문이었나요?'),
  ('아이가 이번 주에 새로 알게 된 단어나 표현은 무엇인가요?'),
  ('아이가 요즘 가장 아끼는 물건은 무엇인가요?'),
  ('아이가 화가 났을 때 어떻게 표현했나요?'),
  ('아이의 울음을 그치게 한 말이나 행동은 무엇이었나요?'),
  ('아이가 이번 주에 가장 신나 보였던 순간은 언제인가요?'),
  ('아이가 누군가를 도와주려 했던 일이 있었나요?'),
  ('아이가 이번 주에 분명하게 싫다고 말한 일은 무엇인가요?'),
  ('아이가 좋아하는 책이나 이야기는 무엇인가요? 어떤 장면을 좋아하나요?'),
  ('아이가 그리거나 만든 것 중 기억에 남는 것은 무엇인가요?'),
  ('아이가 이번 주에 지어낸 상상 속 이야기가 있나요?'),
  ('아이가 혼자 놀 때 하는 행동 중 귀여웠던 것은 무엇인가요?'),
  ('아이가 가장 좋아하는 장소는 어디인가요? 그곳에서 무엇을 하나요?'),
  ('아이가 이번 주에 만난 사람 중 가장 반가워한 사람은 누구인가요?'),
  ('아이가 또래와 함께 놀며 한 말이나 행동은 무엇인가요?'),
  ('아이가 요즘 따라 하는 사람이나 흉내 내는 것이 있나요?'),
  ('아이가 이번 주에 실수하고 나서 어떤 반응을 보였나요?'),
  ('아이가 새로운 도전 앞에서 어떤 표정을 지었나요?'),
  ('아이가 몸으로 새로 해낸 동작이나 기술이 있나요?'),
  ('아이가 이번 주에 가장 궁금해한 것은 무엇이었나요?'),
  ('아이가 왜냐고 물었던 질문 중 대답하기 어려웠던 것은 무엇인가요?'),
  ('아이가 이번 주 하루 중 가장 좋았다고 말한 일은 무엇인가요?'),
  ('아이가 가족에게 특별히 애정을 표현한 순간이 있었나요?'),
  ('아이가 요즘 자주 입거나 고집하는 옷은 무엇인가요?'),
  ('아이가 밥 먹을 때 보인 재미있는 모습은 무엇인가요?'),
  ('아이가 목욕할 때 하는 놀이나 말은 무엇인가요?'),
  ('아이가 이번 주에 처음 먹어 본 음식이 있나요?'),
  ('아이가 좋아하는 색이나 모양이 바뀌었나요?'),
  ('아이가 하늘, 동물, 식물을 보고 한 말은 무엇인가요?'),
  ('비 오는 날이나 눈 오는 날 아이는 어떤 반응을 보였나요?'),
  ('아이가 무언가를 기다려야 했던 순간이 있었나요? 그때 어떻게 했나요?'),
  ('아이가 나눠 주거나 양보한 순간이 있었나요?'),
  ('아이가 쑥스러워하거나 부끄러워한 순간은 언제였나요?'),
  ('아이가 이번 주에 자랑하고 싶어 한 것은 무엇인가요?'),
  ('아이가 스스로 하겠다고 하며 해낸 일은 무엇인가요?'),
  ('요즘 아침에 일어난 아이의 모습은 어떤가요?'),
  ('아이가 하루 중 가장 에너지가 넘치는 시간은 언제인가요?'),
  ('이번 주에 아이에게서 가장 크게 느낀 변화는 무엇인가요?'),
  ('아이가 자랐다고 느낀 순간이 있었나요?'),
  ('아이가 요즘 좋아하는 장난감이나 놀이터 놀이는 무엇인가요?'),
  ('아이가 역할놀이를 하며 한 말은 무엇인가요?'),
  ('아이가 인형이나 장난감에게 한 말 중 기억에 남는 것은 무엇인가요?'),
  ('아이가 이번 주에 해 준 말 중 마음이 따뜻해진 말은 무엇인가요?'),
  ('아이가 안아 주거나 환하게 웃어 준 순간은 언제였나요?'),
  ('이번 주에 아이와 함께 웃었던 일은 무엇인가요?'),
  ('이번 주에 아이에게 미안했던 순간이 있나요? 어떻게 풀었나요?'),
  ('이번 주에 아이를 보며 걱정되었던 일이 있나요?'),
  ('이번 주에 아이에게서 배운 것이 있나요?'),
  ('이번 주에 아이와 단둘이 보낸 시간이 있었나요? 무엇을 했나요?'),
  ('아이와 함께 읽거나 본 것 중 기억에 남는 것은 무엇인가요?'),
  ('아이와 함께 간 곳 중 기억에 남는 곳은 어디인가요?'),
  ('아이와 함께 만들어 본 요리나 간식이 있나요?'),
  ('아이가 이번 주에 가장 좋아한 간식은 무엇인가요?'),
  ('요즘 아이의 잠버릇이나 잠드는 모습은 어떤가요?'),
  ('아이가 꿈 이야기를 한 적이 있나요?'),
  ('아이가 이번 주에 가장 많이 한 말은 무엇인가요?'),
  ('아이에게 새로 생긴 습관이 있나요?'),
  ('아이가 이번 주에 크게 놀란 일이 있었나요?'),
  ('아이가 용기를 낸 순간은 언제였나요?'),
  ('아이가 속상한 일을 어떻게 털어냈나요?'),
  ('아이가 안아 달라고 한 때는 주로 언제인가요?'),
  ('아이가 거울이나 사진 속 자신을 보고 어떤 반응을 보였나요?'),
  ('아이가 이번 주에 가장 즐겁게 논 친구나 놀이 상대는 누구인가요?'),
  ('아이가 노래나 춤을 따라 한 모습은 어땠나요?'),
  ('아이가 숫자, 글자, 모양에 관심을 보인 일이 있나요?'),
  ('아이가 커서 되고 싶은 것을 말한 적이 있나요?'),
  ('아이가 소원이나 바람을 말한 적이 있나요?'),
  ('아이가 이번 주에 가장 좋아한 날씨나 계절의 모습은 무엇인가요?'),
  ('아이가 혼자서 옷이나 신발을 챙겨 본 일이 있나요?'),
  ('아이가 정리정돈이나 집안일을 도와준 일이 있나요?'),
  ('병원이나 낯선 장소에서 아이는 어떻게 지냈나요?'),
  ('아이가 쓴 말투 중 어른스러웠던 것은 무엇인가요?'),
  ('이번 주에 아이가 가장 아기 같았던 순간은 언제인가요?'),
  ('아이가 웃기려고 일부러 한 행동이 있나요?'),
  ('아이가 요즘 가장 신경 쓰는 일은 무엇인가요?'),
  ('아이가 사람들에게 건넨 인사는 어땠나요?'),
  ('요즘 아이가 한결같이 좋아하는 것과 달라진 것은 무엇인가요?'),
  ('저녁 식탁에서 아이가 들려준 이야기는 무엇인가요?'),
  ('이번 주 아이의 하루를 한 문장으로 표현한다면 무엇인가요?'),
  ('이번 주 아이에 대해 오래 기억하고 싶은 장면은 무엇인가요?'),
  ('1년 뒤의 아이에게 지금의 모습을 들려준다면 어떻게 말해 주고 싶나요?'),
  ('이번 주에 사진으로 남기고 싶었지만 놓친 순간이 있나요?'),
  ('이번 주에 아이를 가장 많이 웃게 만든 사람이나 물건은 무엇인가요?'),
  ('이번 주 아이의 컨디션과 기분은 대체로 어땠나요?'),
  ('이번 주에 아이에게 꼭 해 주고 싶었던 말은 무엇인가요?'),
  ('아이가 이번 주에 가장 오래 집중해서 한 일은 무엇인가요?')
on conflict (body) do nothing;

-- ===== seed/weekly_questions.sql (52주로 확장, 이미 있는 주는 건드리지 않음) =====
-- 주간 질문 시드 (초안 — 문구는 사용자가 검토해 확정한다)
-- week_start는 한국 시간 기준 월요일. 여러 번 실행해도 안전하다 (이미 있는 주는 건드리지 않음).
-- 운영 질문 분량·문구는 SESSION 05 전에 확정한다 (ARCHITECTURE.md 7절).
-- 2026-12-21 주부터 2027-09-20 주까지 40주는 질문 은행(question_bank.sql)의 13~52번과 같은 문구다 (D-025).

insert into public.weekly_questions (week_start, body, hint) values
  ('2026-09-28', '이번 주에 아이가 처음 해본 일이 있나요?', null),
  ('2026-10-05', '아이가 요즘 푹 빠져 있는 놀이는 무엇인가요?', null),
  ('2026-10-12', '아이가 최근에 가장 크게 웃은 순간은 언제인가요?', null),
  ('2026-10-19', '요즘 아이가 자주 하는 말이나 말투는 무엇인가요?', '오늘 들은 한마디도 좋아요. 그때 아이의 표정이나 상황을 함께 적어 두면 나중에 더 생생해요.'),
  ('2026-10-26', '아이가 이번 주에 가장 열심히 했던 일은 무엇인가요?', null),
  ('2026-11-02', '아이가 좋아하는 음식이나 싫어하는 음식에 대해 새로 알게 된 점이 있나요?', null),
  ('2026-11-09', '아이가 잠들기 전에 하는 말이나 행동은 무엇인가요?', null),
  ('2026-11-16', '이번 주에 아이에게 고마웠던 순간이 있나요?', null),
  ('2026-11-23', '아이가 가족에게 해 준 말 중 기억에 남는 것은 무엇인가요?', null),
  ('2026-11-30', '아이가 무서워하거나 낯설어한 것이 있었나요?', null),
  ('2026-12-07', '요즘 아이가 가장 자주 묻는 질문은 무엇인가요?', null),
  ('2026-12-14', '아이와 함께한 시간 중 가장 편안했던 순간은 언제인가요?', null),
  ('2026-12-21', '이번 주 아침에 아이가 가장 먼저 한 말은 무엇이었나요?', null),
  ('2026-12-28', '아이가 요즘 가장 좋아하는 노래나 소리는 무엇인가요?', null),
  ('2027-01-04', '아이가 이번 주에 고집을 부린 일이 있었나요? 무엇 때문이었나요?', null),
  ('2027-01-11', '아이가 이번 주에 새로 알게 된 단어나 표현은 무엇인가요?', null),
  ('2027-01-18', '아이가 요즘 가장 아끼는 물건은 무엇인가요?', null),
  ('2027-01-25', '아이가 화가 났을 때 어떻게 표현했나요?', null),
  ('2027-02-01', '아이의 울음을 그치게 한 말이나 행동은 무엇이었나요?', null),
  ('2027-02-08', '아이가 이번 주에 가장 신나 보였던 순간은 언제인가요?', null),
  ('2027-02-15', '아이가 누군가를 도와주려 했던 일이 있었나요?', null),
  ('2027-02-22', '아이가 이번 주에 분명하게 싫다고 말한 일은 무엇인가요?', null),
  ('2027-03-01', '아이가 좋아하는 책이나 이야기는 무엇인가요? 어떤 장면을 좋아하나요?', null),
  ('2027-03-08', '아이가 그리거나 만든 것 중 기억에 남는 것은 무엇인가요?', null),
  ('2027-03-15', '아이가 이번 주에 지어낸 상상 속 이야기가 있나요?', null),
  ('2027-03-22', '아이가 혼자 놀 때 하는 행동 중 귀여웠던 것은 무엇인가요?', null),
  ('2027-03-29', '아이가 가장 좋아하는 장소는 어디인가요? 그곳에서 무엇을 하나요?', null),
  ('2027-04-05', '아이가 이번 주에 만난 사람 중 가장 반가워한 사람은 누구인가요?', null),
  ('2027-04-12', '아이가 또래와 함께 놀며 한 말이나 행동은 무엇인가요?', null),
  ('2027-04-19', '아이가 요즘 따라 하는 사람이나 흉내 내는 것이 있나요?', null),
  ('2027-04-26', '아이가 이번 주에 실수하고 나서 어떤 반응을 보였나요?', null),
  ('2027-05-03', '아이가 새로운 도전 앞에서 어떤 표정을 지었나요?', null),
  ('2027-05-10', '아이가 몸으로 새로 해낸 동작이나 기술이 있나요?', null),
  ('2027-05-17', '아이가 이번 주에 가장 궁금해한 것은 무엇이었나요?', null),
  ('2027-05-24', '아이가 왜냐고 물었던 질문 중 대답하기 어려웠던 것은 무엇인가요?', null),
  ('2027-05-31', '아이가 이번 주 하루 중 가장 좋았다고 말한 일은 무엇인가요?', null),
  ('2027-06-07', '아이가 가족에게 특별히 애정을 표현한 순간이 있었나요?', null),
  ('2027-06-14', '아이가 요즘 자주 입거나 고집하는 옷은 무엇인가요?', null),
  ('2027-06-21', '아이가 밥 먹을 때 보인 재미있는 모습은 무엇인가요?', null),
  ('2027-06-28', '아이가 목욕할 때 하는 놀이나 말은 무엇인가요?', null),
  ('2027-07-05', '아이가 이번 주에 처음 먹어 본 음식이 있나요?', null),
  ('2027-07-12', '아이가 좋아하는 색이나 모양이 바뀌었나요?', null),
  ('2027-07-19', '아이가 하늘, 동물, 식물을 보고 한 말은 무엇인가요?', null),
  ('2027-07-26', '비 오는 날이나 눈 오는 날 아이는 어떤 반응을 보였나요?', null),
  ('2027-08-02', '아이가 무언가를 기다려야 했던 순간이 있었나요? 그때 어떻게 했나요?', null),
  ('2027-08-09', '아이가 나눠 주거나 양보한 순간이 있었나요?', null),
  ('2027-08-16', '아이가 쑥스러워하거나 부끄러워한 순간은 언제였나요?', null),
  ('2027-08-23', '아이가 이번 주에 자랑하고 싶어 한 것은 무엇인가요?', null),
  ('2027-08-30', '아이가 스스로 하겠다고 하며 해낸 일은 무엇인가요?', null),
  ('2027-09-06', '요즘 아침에 일어난 아이의 모습은 어떤가요?', null),
  ('2027-09-13', '아이가 하루 중 가장 에너지가 넘치는 시간은 언제인가요?', null),
  ('2027-09-20', '이번 주에 아이에게서 가장 크게 느낀 변화는 무엇인가요?', null)
on conflict (week_start) do nothing;

-- ===== 20261026000100_yearly_answers.sql =====
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
