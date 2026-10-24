-- 공백만 있는 텍스트 거부 보강 (SESSION 02 테스트에서 발견)
-- btrim()은 공백(스페이스)만 지우므로 줄바꿈·탭만 있는 본문이 "비어 있지 않음"으로 통과했다.
-- 줄바꿈·탭·전각 공백(U+3000)·NBSP·zero-width space 만으로 이뤄진 값을 거부한다.
-- 길이 상한은 원본 문자열 기준으로 건다 (앱이 저장 전에 trim 한다).

alter table public.entries
  drop constraint entries_body_length,
  add constraint entries_body_length
    check (body ~ '[^\s 　​]' and char_length(body) <= 5000);

alter table public.children
  drop constraint children_nickname_length,
  add constraint children_nickname_length
    check (nickname ~ '[^\s 　​]' and char_length(nickname) <= 30);

alter table public.weekly_questions
  drop constraint weekly_questions_body_not_blank,
  add constraint weekly_questions_body_not_blank
    check (body ~ '[^\s 　​]');
