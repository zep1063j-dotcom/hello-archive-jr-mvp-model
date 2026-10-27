-- 3번: 기록을 쓴 뒤에도 질문 바꾸기 허용 (D-034). 개발 DB → 정식 DB 순서로, 앱 배포(push)보다 먼저 SQL Editor에서 실행한다.
-- 여러 번 실행해도 안전하다(정책을 지웠다 다시 만든다).

drop policy if exists week_question_choices_insert_own on public.week_question_choices;
drop policy if exists week_question_choices_update_own on public.week_question_choices;
drop policy if exists week_question_choices_delete_own on public.week_question_choices;

create policy week_question_choices_insert_own on public.week_question_choices
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy week_question_choices_update_own on public.week_question_choices
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy week_question_choices_delete_own on public.week_question_choices
  for delete to authenticated
  using (user_id = (select auth.uid()));
