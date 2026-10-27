-- 기록을 남긴 뒤에도 그 주 질문을 바꿀 수 있게 한다 (D-034, D-025의 "저장하면 고정" 변경).
-- 기존 정책은 "그 주에 이미 기록이 있으면 선택의 추가·수정·삭제 불가"였다. 이 마이그레이션은 그 조건만 없애고
-- "본인 것만"이라는 소유 조건은 그대로 둔다. 질문을 바꾸면 이미 쓴 답은 바뀐 질문 아래에 보인다(기록은 주 질문에 매달려 있고
-- 보이는 질문 문구만 선택을 따른다). 적용 순서: 앱 배포보다 먼저 (아니면 기록 후 질문 바꾸기가 실패한다).

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
