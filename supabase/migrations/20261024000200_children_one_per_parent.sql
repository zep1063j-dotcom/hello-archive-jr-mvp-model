-- 부모당 자녀 1명 제한을 DB에서도 강제 (SESSION 04 검증에서 발견)
-- 앱의 "개수 확인 → 없으면 insert"는 동시 요청이 겹치면 자녀가 여러 명 생겼다
-- (6개 동시 요청 시 5~6명 생성을 실측). MVP는 UI·로직이 1명이므로 유니크 인덱스로 막는다.
-- 여러 자녀를 지원하게 되면(후속 세션) 이 인덱스를 지우고 앱 로직을 바꾼다.
-- 적용 전에 이미 한 부모에게 자녀가 2명 이상이면 실패한다 (현재 개발용 DB는 자녀 0행).

create unique index children_one_per_parent_idx on public.children (user_id);
