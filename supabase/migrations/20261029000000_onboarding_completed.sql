-- 첫 가입 환영 온보딩 완료 상태 (D-040, SESSION 09)
-- "아이 등록"(children 행)과 "온보딩 전체 완료"를 구분한다: 아이를 등록한 뒤 마지막 환영 창 전에 이탈해도 이어서 마무리할 수 있다.
-- 완료 시각은 브라우저가 아니라 계정(parent_settings)에 둔다. NULL = 아직 끝나지 않음.
-- 이 마이그레이션 전에 이미 아이를 등록한 부모는 온보딩 대상이 아니므로 완료로 채운다(기존 사용자에게 새 온보딩이 뜨지 않게).
-- 적용 순서: 앱 배포보다 먼저. 여러 번 실행해도 안전하다.

alter table public.parent_settings
  add column if not exists onboarding_completed_at timestamptz;

update public.parent_settings ps
  set onboarding_completed_at = now()
  where ps.onboarding_completed_at is null
    and exists (select 1 from public.children c where c.user_id = ps.user_id);

-- 앱이 사용자 세션으로 완료 시각을 기록한다. 소유권은 기존 RLS(본인 행만)가 지킨다.
grant update (onboarding_completed_at) on public.parent_settings to authenticated;
