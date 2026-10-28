-- Hello Archive jr 베타 지표 조회 (SESSION 09, D-023)
--
-- 사용법: Supabase 대시보드 > SQL Editor(정식 프로젝트)에서 아래 쿼리를 "하나씩" 실행한다.
--   SQL Editor는 여러 문장을 한꺼번에 실행하면 마지막 결과만 보여준다.
--   대시보드의 postgres 역할은 RLS를 우회하므로 서비스 키를 이 Mac이나 앱에 둘 필요가 없다.
--
-- 개인정보 원칙: 기록 본문(body)·이메일·자녀 이름/생년월일은 조회하지 않는다.
--   부모는 "부모 1, 부모 2…"로만 표시한다(가입 순서). 길이(글자 수)와 시각·횟수만 센다.
--   결과를 외부 분석 도구·채팅에 붙여 넣을 때도 이 숫자만 쓴다.
--
-- 제외할 계정(운영자 본인·시험 계정): 쿼리마다 맨 위 `excluded`의 배열에 user_id를 넣는다.
--   user_id는 Authentication > Users에서 복사한다. (쿼리 4개 모두 같은 자리)
--
-- 주 단위는 한국 시간(Asia/Seoul) 월요일 시작이며 weekly_questions.week_start와 같다.
-- 지난 질문 쓰기(D-024) 때문에 "그 주 질문에 대한 기록"이 그 주가 지난 뒤에 만들어질 수 있다.
--   지속률·메일 효과는 그 주 안에 쓴 기록(on_time)만 센다. 나중에 채운 기록은 late_*로 따로 센다.
-- 사용자가 5명 안팎이라 비율은 반드시 분자/분모(n/N)와 같이 읽는다. 5명의 비율은 통계가 아니다.

-- ===========================================================================
-- 쿼리 1. 주별 깔때기: 활성 부모 → 메일 → 기록 → 다음 주 이어짐
--   active_parents : 그 주가 끝나기 전에 자녀를 등록한 부모(주 중간 가입자도 포함)
--   mails_sent     : 그 주 질문 메일이 sent 상태인 부모 수 (failed/skipped는 따로)
--   writers        : 그 주 안에(월~일 KST) 그 주 질문에 기록한 부모 수
--   late_writers   : 그 주가 지난 뒤에 그 주 질문을 채운 부모 수 (지난 질문 쓰기)
--   writers_after_mail : writers 중 메일 발송(sent_at) 이후에 기록을 만든 부모 수
--   prev_writers / retained : 지난주 기록한 부모 수 / 그중 이번 주도 기록한 부모 수
-- ===========================================================================
with
excluded(user_id) as (
  select unnest(array[]::uuid[])          -- 예: array['00000000-0000-0000-0000-000000000000'::uuid]
),
cur as (
  select date_trunc('week', now() at time zone 'Asia/Seoul')::date as week_start
),
weeks as (
  select q.id as question_id, q.week_start
  from public.weekly_questions q, cur
  where q.week_start <= cur.week_start
),
onboarded as (
  select c.user_id, min(c.created_at) as onboarded_at
  from public.children c
  where c.user_id not in (select user_id from excluded)
  group by c.user_id
),
writes as (
  select e.user_id, w.week_start, min(e.created_at) as first_written_at,
         (min(e.created_at) < (w.week_start + 7)::timestamp at time zone 'Asia/Seoul') as on_time
  from public.entries e
  join weeks w on w.question_id = e.weekly_question_id
  where e.user_id not in (select user_id from excluded)
  group by e.user_id, w.week_start
),
mails as (
  select d.user_id, w.week_start, d.status, d.sent_at
  from public.email_deliveries d
  join weeks w on w.question_id = d.weekly_question_id
  where d.user_id not in (select user_id from excluded)
)
select
  w.week_start,
  (w.week_start = (select week_start from cur)) as in_progress,
  (select count(*) from onboarded o
     where o.onboarded_at >= w.week_start::timestamp at time zone 'Asia/Seoul'
       and o.onboarded_at <  (w.week_start + 7)::timestamp at time zone 'Asia/Seoul') as new_parents,
  (select count(*) from onboarded o
     where o.onboarded_at < (w.week_start + 7)::timestamp at time zone 'Asia/Seoul') as active_parents,
  (select count(*) from mails m where m.week_start = w.week_start and m.status = 'sent') as mails_sent,
  (select count(*) from mails m where m.week_start = w.week_start and m.status = 'failed') as mails_failed,
  (select count(*) from mails m where m.week_start = w.week_start and m.status = 'skipped') as mails_skipped,
  (select count(*) from writes x where x.week_start = w.week_start and x.on_time) as writers,
  (select count(*) from writes x where x.week_start = w.week_start and not x.on_time) as late_writers,
  (select count(*) from writes x
     join mails m on m.user_id = x.user_id and m.week_start = x.week_start and m.status = 'sent'
     where x.week_start = w.week_start and x.on_time and x.first_written_at >= m.sent_at) as writers_after_mail,
  (select count(*) from writes x where x.week_start = w.week_start - 7 and x.on_time) as prev_writers,
  (select count(*) from writes x
     where x.week_start = w.week_start and x.on_time
       and exists (select 1 from writes p
                   where p.user_id = x.user_id and p.week_start = w.week_start - 7 and p.on_time)) as retained
-- 시기(stage)별 질문이 한 주에 여러 개라 주 단위로 한 줄만 낸다 (D-038)
from (select distinct week_start from weeks) w
order by w.week_start desc;

-- ===========================================================================
-- 쿼리 2. 메일을 받은 뒤 몇 시간 만에 기록했나 (가설: 월요일 저녁 19시가 적절한가)
--   한 줄이 부모 한 명의 한 주다. 이메일·부모 식별자는 내지 않는다.
--   hours_after_mail : 메일 발송 → 그 주 첫 기록까지 걸린 시간(시간 단위). 음수는 메일 전에 이미 썼다는 뜻.
--   written_hour_kst / written_isodow : 기록을 만든 한국 시각의 시(0~23)와 요일(1=월 … 7=일)
-- ===========================================================================
with
excluded(user_id) as (
  select unnest(array[]::uuid[])
)
select
  q.week_start,
  round((extract(epoch from (fe.first_written_at - d.sent_at)) / 3600)::numeric, 1) as hours_after_mail,
  extract(isodow from fe.first_written_at at time zone 'Asia/Seoul')::int as written_isodow,
  extract(hour from fe.first_written_at at time zone 'Asia/Seoul')::int as written_hour_kst
from public.email_deliveries d
join public.weekly_questions q on q.id = d.weekly_question_id
join lateral (
  select min(e.created_at) as first_written_at
  from public.entries e
  where e.user_id = d.user_id and e.weekly_question_id = d.weekly_question_id
    -- 그 주 안에 쓴 기록만 (지난 질문을 나중에 채운 기록은 메일 효과가 아니다)
    and e.created_at < (q.week_start + 7)::timestamp at time zone 'Asia/Seoul'
) fe on fe.first_written_at is not null
where d.status = 'sent'
  and d.user_id not in (select user_id from excluded)
order by q.week_start desc, hours_after_mail;

-- ===========================================================================
-- 쿼리 3. 부모별 이어짐 (익명: 가입 순서로 "부모 1…")
--   weeks_written   : 그 주 안에 기록한 서로 다른 주 수 (on_time)
--   late_weeks      : 나중에 채운(지난 질문 쓰기) 주 수
--   longest_streak  : 그 주 안에 연속으로 기록한 최대 주 수
--   weeks_since_last: 마지막으로 그 주 안에 기록한 주로부터 지난 주 수 (0 = 이번 주에 기록, 2 이상이면 이탈 징후)
--   hours_to_first  : 자녀 등록 → 첫 기록까지 시간 (첫 기록이 얼마나 빨랐나)
--   avg_chars       : 기록 평균 글자 수 (본문은 읽지 않는다)
--   mail_consent    : 지금 수신 동의 상태
-- ===========================================================================
with
excluded(user_id) as (
  select unnest(array[]::uuid[])
),
cur as (
  select date_trunc('week', now() at time zone 'Asia/Seoul')::date as week_start
),
parents as (
  select c.user_id,
         min(c.created_at) as onboarded_at,
         row_number() over (order by min(c.created_at)) as n
  from public.children c
  where c.user_id not in (select user_id from excluded)
  group by c.user_id
),
writes as (
  select e.user_id, q.week_start,
         min(e.created_at) as first_written_at,
         (min(e.created_at) < (q.week_start + 7)::timestamp at time zone 'Asia/Seoul') as on_time,
         avg(char_length(e.body)) as avg_chars
  from public.entries e
  join public.weekly_questions q on q.id = e.weekly_question_id
  where e.user_id not in (select user_id from excluded)
  group by e.user_id, q.week_start
),
-- 연속 구간(gaps-and-islands): 주 번호에서 순번을 빼면 연속된 주는 같은 값이 된다
islands as (
  select user_id, week_start,
         week_start - (row_number() over (partition by user_id order by week_start) * 7)::int as grp
  from writes
  where on_time
),
streaks as (
  select user_id, max(len) as longest_streak
  from (select user_id, grp, count(*) as len from islands group by user_id, grp) s
  group by user_id
)
select
  '부모 ' || p.n as parent,
  coalesce((select count(*) from writes w where w.user_id = p.user_id and w.on_time), 0) as weeks_written,
  coalesce((select count(*) from writes w where w.user_id = p.user_id and not w.on_time), 0) as late_weeks,
  coalesce(s.longest_streak, 0) as longest_streak,
  (select (cur.week_start - max(w.week_start)) / 7 from writes w where w.user_id = p.user_id and w.on_time) as weeks_since_last,
  (select round((extract(epoch from (min(w.first_written_at) - p.onboarded_at)) / 3600)::numeric, 1)
     from writes w where w.user_id = p.user_id) as hours_to_first,
  (select round(avg(w.avg_chars)::numeric) from writes w where w.user_id = p.user_id) as avg_chars,
  coalesce((select ps.email_consent from public.parent_settings ps where ps.user_id = p.user_id), false) as mail_consent
from parents p
cross join cur
left join streaks s on s.user_id = p.user_id
order by p.n;

-- ===========================================================================
-- 쿼리 4. 전체 요약 (한 줄)
--   signed_up : 로그인해 설정 행이 생긴 부모, onboarded : 자녀까지 등록,
--   consented : 지금 수신 동의, wrote_once : 기록 1회 이상, wrote_2plus_weeks : 서로 다른 2주 이상 (나중에 채운 기록 포함)
-- ===========================================================================
with
excluded(user_id) as (
  select unnest(array[]::uuid[])
),
per_parent as (
  select e.user_id, count(distinct e.weekly_question_id) as weeks_written
  from public.entries e
  where e.user_id not in (select user_id from excluded)
  group by e.user_id
)
select
  (select count(*) from public.parent_settings ps where ps.user_id not in (select user_id from excluded)) as signed_up,
  (select count(distinct c.user_id) from public.children c where c.user_id not in (select user_id from excluded)) as onboarded,
  (select count(*) from public.parent_settings ps
     where ps.email_consent and ps.user_id not in (select user_id from excluded)) as consented,
  (select count(*) from per_parent) as wrote_once,
  (select count(*) from per_parent where weeks_written >= 2) as wrote_2plus_weeks,
  (select count(*) from public.entries e where e.user_id not in (select user_id from excluded)) as total_entries;
