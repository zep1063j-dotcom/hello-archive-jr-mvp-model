-- 6번: 첫 가입 환영 온보딩 완료 상태 (D-040). 개발 DB → 정식 DB 순서로, 앱 배포(push)보다 먼저 SQL Editor에서 실행한다.
-- 1~5번을 이미 적용한 DB에서 실행한다. 여러 번 실행해도 안전하다.
-- (이 SQL을 적용하기 전에 앱을 배포해도 기존 사용자는 온보딩이 뜨지 않는다. 다만 신규 가입자는 마지막 환영 창을 닫아도 완료가 기록되지 않아
--  로그인할 때마다 그 창이 다시 보이므로, 적용 후에 배포하는 것이 맞다.)

alter table public.parent_settings
  add column if not exists onboarding_completed_at timestamptz;

update public.parent_settings ps
  set onboarding_completed_at = now()
  where ps.onboarding_completed_at is null
    and exists (select 1 from public.children c where c.user_id = ps.user_id);

grant update (onboarding_completed_at) on public.parent_settings to authenticated;
