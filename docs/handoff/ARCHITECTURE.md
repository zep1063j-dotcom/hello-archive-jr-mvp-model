# ARCHITECTURE — 라우팅 · 화면 구조 · 데이터 모델 (설계안)

> 상태: SESSION 00 설계안. **SESSION 01에서 화면(목 데이터), SESSION 02에서 DB 스키마·RLS, SESSION 03에서 인증(일회용 코드)·보호 라우트 구현·검증됨** (4~5절). 질문·기록 화면의 DB 연결은 SESSION 05에서 완료(목 데이터 제거, D-020). `/api/*`는 아직 없다. 각 세션에서 구현하며 달라지면 이 문서와 `DECISIONS.md`를 함께 갱신한다.

## 1. 폴더 구조 (현재 생성됨)
```
src/
  proxy.ts        # 보호 라우트 낙관적 차단 + 세션 쿠키 갱신 (SESSION 03)
  app/            # App Router (라우트, 레이아웃). actions/auth.ts = 로그인 서버 액션
  components/     # 재사용이 필요한 UI만
  lib/
    supabase/     # 서버 클라이언트(server.ts)·env.ts (SESSION 03). 브라우저 클라이언트는 필요해질 때 추가
    auth.ts       # requireUser(), safeNextPath() (SESSION 03)
    children.ts   # getMyChild(), requireChild() (SESSION 04)
    child-validation.ts  # 자녀 입력 검증, 순수 TS (SESSION 04)
    entry-validation.ts  # 기록 본문 검증, 순수 TS (SESSION 05)
    my-entries.ts        # 이번 주 질문·내 기록 조회, 서버 전용 (SESSION 05)
    chapters.ts          # 기간 챕터(월/분기/연) 구간·묶음, 순수 TS (SESSION 06)
    month-card.ts        # 1개월 이야기 카드 구성·글귀·글자 배치, 순수 TS (D-029)
    weekly-email.ts      # 주간 이메일 규칙(발송 시각·대상·재시도·본문), 순수 TS (SESSION 07)
    weekly-email-job.ts  # 발송 작업: DB·발송기 주입, 멱등·보정형 (SESSION 07)
    resend.ts            # Resend REST 발송, 서버 전용 (SESSION 07)
    email-consent.ts     # 수신 동의 조회·저장(사용자 세션), 서버 전용 (SESSION 07)
    past-questions.ts    # 지난 질문 쓰기 규칙, 순수 TS (D-024)
    entry-search.ts      # 기록 검색어 정리·LIKE 이스케이프, 순수 TS (D-024)
    unsubscribe.ts       # 수신 거부 링크 서명·검증·처리, DB는 주입 (D-024)
    supabase/admin.ts    # service role 클라이언트. 예약 실행에서만 (SESSION 07)
  types/          # DB 타입 등
supabase/
  migrations/     # SQL 마이그레이션 (SESSION 02)
  seed/           # 주간 질문 시드 (SESSION 02/05)
  analytics/      # 베타 지표 조회 SQL, 대시보드 SQL Editor에서 수동 실행 (SESSION 09, D-023)
docs/handoff/     # 인수인계 문서
```

## 2. 라우트 설계
`(public)` 그룹은 비로그인 접근 가능, `(app)` 그룹은 인증 필수(`proxy.ts` + 서버 소유권 검증).

| 경로 | 그룹 | 설명 | 세션 |
|---|---|---|---|
| `/` | public | 소개 + 시작하기(→ `/login`). 정적이라 로그인 분기 없음(`/login`에서 `/home`으로) | 01, 03 |
| `/login` | public | 이메일 입력 → 메일의 숫자 코드 입력. `?next=` 지원. 구현됨 | 03 |
| ~~`/auth/callback`~~ | — | **만들지 않음**: 코드 방식(D-016)이라 서버 액션이 확인한다 | — |
| ~~`/auth/expired`~~ | — | **만들지 않음**: 만료·오류는 폼 안내 + 코드 다시 받기 | — |
| `/onboarding` | 별도(`src/app/onboarding`, 내비 없는 화면) | 첫 로그인 시 자녀 등록. 자녀가 없으면 `requireChild()`가 `?next=`와 함께 이곳으로 보낸다. 구현됨 | 04 |
| `/home` | app | 대시보드: 이번 주 질문 CTA, 최근 기록 | 01 |
| `/write` | app | 이번 주 질문 + 기록 작성/수정, 홈의 이번 주 카드와 같은 컴포넌트를 펼쳐서 보여줌 (**이메일 딥링크 목적지**). 구현됨 | 05 |
| `/archive` | app | 상단에 달별 이야기 카드 가로 목록(D-037, 검색 중 숨김) + 타임라인(최신 먼저, 월별 묶음) + 챕터 목록 링크 + 본문 검색(`?q=`, D-024). 구현됨 | 06, 09 |
| `/archive/[entryId]` | app | 기록 상세 + 수정·삭제(05 구현됨), 기간·정리는 06 | 05, 06 |
| `/archive/chapters/[period]` | app | `1m` 미니챕터 / `3m` 이야기집 / `1y` 기록집의 **챕터 목록**(기록 있는 구간만). 구현됨 | 06 |
| `/archive/chapters/[period]/[chapterKey]` | app | 챕터 상세. 키 `2026-10`·`2026-q4`·`2026`, 구간 `[start,end)` KST, 작성일 기준, 오래된 기록 먼저. 구현됨 (D-021) | 06 |
| `/profile` | app | 자녀 조회·수정(`?edit=1`), 주간 이메일 수신 켜기/끄기, 로그아웃 구현됨 / 데이터 삭제 요청은 미구현 | 04, 07 |
| `/write?week=YYYY-MM-DD` | app | 놓친 지난 질문에 기록(D-024). 쓸 수 없는 주는 안내 화면 | 09 |
| `/archive/card/[monthKey]` | app | 1개월 이야기 카드(키 `2026-10`): 앞면 최근 기록 5개의 질문·답, 뒷면 사진/글귀, 브라우저 캔버스로 그려 PNG 저장·공유. 서버는 기록·사진 URL만 준다 (D-029) | 09 |
| `/terms`, `/privacy` | public | 이용약관·개인정보 처리방침(초안, 법률 검토 필요). 소개·로그인 푸터와 프로필 아래에서 링크 (D-035) | 09 |
| `/make` | app | 제작 탭: 1개월 이야기 카드 링크, 책 한 권 분량 요약, PDF·종이책 "받아보고 싶어요" 표시(실제 생성·주문 없음) (D-036) | 09 |
| `/yearly` | app | 매년 같은 질문 5개: 지금 연도 답 쓰기·수정, 지난 연도 읽기 전용으로 나란히 (D-026) | 09 |
| `/unsubscribe?u=&t=` | public | 메일의 수신 거부 링크 → 확인 화면 → 버튼으로 끔. 서명(HMAC) 검증, 로그인 불필요 (D-024) | 09 |
| `/api/cron/weekly-email` | route handler | 예약 실행 진입점(`vercel.json`: 월·화 10:00 UTC = 19:00 KST). `CRON_SECRET` Bearer 검증, 집계 JSON만 응답. 구현됨, 실제 발송·Cron 동작은 미검증 (D-022) | 07 |

> **SESSION 03 구현 현황**: `/login`, `src/proxy.ts`(보호 라우트), `(app)` 레이아웃 서버 검증, 프로필 로그아웃. 보호 대상 matcher: `/login`, `/onboarding`, `/home`, `/write`, `/archive/:path*`, `/profile`.
>
> **SESSION 01 구현 현황 (목 데이터)**: `/`, `/home`, `/write`, `/archive`, `/archive/[entryId]`, `/archive/chapters/[period]`, `/profile`, 전역 `not-found`, `(app)`의 `loading`/`error`. `/onboarding`, `/api/*`는 미구현. 목 시나리오는 D-007, `/home` 허브 구성은 D-009 참고.

내비게이션(홈 / 기록 쓰기 / 아카이브 / 프로필)은 **상단 고정**이다 (D-010). 모바일은 로고 줄 아래에 메뉴 줄, md 이상은 한 줄. 본문은 중앙 정렬 컬럼.

## 3. 사용자 흐름
1. 신규: `/` → `/login` → 메일 인증 → `/onboarding`(자녀 등록) → `/write`.
2. 재방문(세션 유효): `/home` → `/write` → 저장 → 저장 상태 표시 → `/archive`.
3. 이메일 링크: 메일의 `/write` 링크 클릭 → 세션 유효하면 즉시 작성 화면 / 없으면 `/login?next=/write` → 이메일 입력 → 메일의 코드 입력 → `/write`. (SESSION 07에서 실제 메일로 검증)
4. 코드 만료·오류: 폼 안에서 안내하고 "코드 다시 받기"로 같은 이메일에 새 코드를 보낸다(`next` 유지).

## 4. 인증 리다이렉트 설계 원칙 (SESSION 03 구현됨, D-016·D-018)
- `next` 값은 **같은 사이트의 내부 경로 허용 목록**(예: `/write`, `/home`, `/archive…`)만 허용한다. 외부 URL, `//`, `\` 포함 값은 버리고 `/home`으로 보낸다 (open redirect 방지).
- 주간 안내 이메일 링크는 `APP_URL/write` 형태의 **일반 링크**다. 로그인 토큰을 포함하지 않는다.
- 인증 메일에는 **숫자 코드만** 넣는다(링크 없음). 코드는 Supabase Auth의 일회성·짧은 만료를 쓴다. 이메일 보안 스캐너·메일 앱 내장 브라우저 문제를 피하려고 일회용 코드 방식을 택했다 (D-016). 실제 만료 시간은 Supabase 설정값이며 미확인.
- `next` 허용 목록은 `src/lib/auth.ts`의 `safeNextPath()`가 한 곳에서 처리한다.
- 세션 확인 계층: `proxy.ts`(`getClaims()` 낙관적 차단) → 서버 `requireUser()`(`getUser()`로 Auth 서버 검증) → RLS. 데이터를 읽는 서버 코드는 각자 `requireUser()`를 호출한다. 세션을 읽는 컴포넌트는 `<Suspense>` 안에 둔다 (`cacheComponents`, D-018).

## 5. 데이터 모델 (PostgreSQL / Supabase) — SESSION 02 구현됨
실제 SQL은 `supabase/migrations/`. 설계와 달라진 점: 생년월일은 연·월·일 전체 저장(D-013), 빈 텍스트·길이 검사는 정규식·원본 길이 기준(D-014: 본문 ≤5000자, 별명 ≤30자, 앱이 저장 전 trim), 생성 후 수정 가능한 컬럼은 GRANT로 제한(기록은 `body`만, 자녀는 `nickname`·`birth_date`만, 설정은 `email_consent`만), `parent_settings.consent_updated_at`은 트리거가 기록. `parent_settings`는 자동 생성하지 않고 앱이 upsert한다. 이번 주 질문만 기록 가능한 규칙·자녀 1명 제한은 DB가 아닌 앱 로직(05/04).
모든 테이블에 RLS 활성화. `auth.users`가 부모 계정이다. 부모 삭제 시 하위 데이터가 연쇄 삭제되도록 FK `on delete cascade`.

### parent_settings
| 컬럼 | 타입 | 비고 |
|---|---|---|
| user_id | uuid PK, FK auth.users | 부모 1:1 |
| email_consent | boolean not null default false | 주간 이메일 수신 동의 (기본 거부) |
| consent_updated_at | timestamptz | 동의/철회 시각 |
| created_at / updated_at | timestamptz | |

### children
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK auth.users | 소유 부모 |
| nickname | text not null | 1~30자 |
| birth_date | date not null | 오늘 이후 불가 |
| created_at / updated_at | timestamptz | |
| unique (id, user_id) | | entries의 복합 FK용 |

> UI는 자녀 1명이지만 테이블은 여러 명을 허용한다. MVP에서는 자녀 수를 앱 로직으로 1명으로 제한한다.

### weekly_questions
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| week_start | date unique not null | **한국 시간 기준 월요일** 날짜 |
| body | text not null | 질문 |
| hint | text | 작성 도움말(선택) |

- 모든 부모가 같은 주에 같은 질문을 받는다. 시드로 관리(관리자 화면 없음). 읽기 전용(authenticated select만 허용).
- "이번 주" = 오늘(KST)이 속한 `week_start`의 행. 해당 주 질문이 없으면 빈/오류 상태를 보여준다 (질문 시드 소진 대비).

### entries
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | RLS 기준 |
| child_id | uuid | |
| weekly_question_id | uuid FK weekly_questions | |
| body | text not null | 1~5000자 (trim 후) |
| created_at | timestamptz default now() | 작성 시각 |
| updated_at | timestamptz | 수정 시각 (트리거로 갱신) |
| FK (child_id, user_id) → children(id, user_id) | | 타인 자녀에 기록 쓰기 차단 |
| **unique (child_id, weekly_question_id)** | | 같은 아이·같은 주 질문에 기록 중복 생성 방지 |

- 인덱스: `(user_id, created_at desc)`, `(child_id, created_at desc)`.
- 타임라인 정렬 기준은 `created_at desc`. 기간 묶음은 달력 월·분기·연 고정 구간을 KST 반개구간 `[start, end)`로 정의하고 `created_at`의 KST 날짜로 소속을 정한다 (`src/lib/chapters.ts`, D-021).

### 세션 09 추가 테이블 (SQL은 `supabase/migrations/20261026000*`, 결정 D-025~D-027)
- `question_bank`(읽기 전용 예시 질문), `week_question_choices`(부모·주별 질문 바꾸기, 기록이 있으면 RLS가 변경 차단), `yearly_answers`(자녀·연도·질문 키별 답), `entry_photos`(기록당 3장, 경로만), `weekly_questions.stage`·`question_bank.stage/active`(시기별 질문, D-038; 유니크 `(week_start, stage)`), `product_interests`(부모·상품 `pdf`/`book`당 1행, 제작 관심 표시, 수정 없음), `children.photo_path`, `entries unique (id, user_id)`. 사진 파일은 비공개 Storage 버킷 `photos`(`<부모 id>/<파일>`), 보여줄 때 서명 URL.

### email_deliveries
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK auth.users | |
| weekly_question_id | uuid FK | |
| status | text | `processing` / `sent` / `failed` / `skipped` |
| attempts | int | 재시도 횟수 |
| first_attempt_at / last_attempt_at / sent_at | timestamptz | |
| error_code | text | 본문·이메일 주소 저장 금지 |
| **unique (user_id, weekly_question_id)** | | 중복 발송 방지 |

- 일반 사용자 정책을 만들지 않는다. 서버 전용 service role만 접근한다.

### RLS 원칙
- `children`, `entries`, `parent_settings`: `auth.uid() = user_id`인 행만 select/insert/update/delete.
- `weekly_questions`: authenticated select만.
- `email_deliveries`: anon/authenticated 권한 없음.
- 클라이언트에는 publishable key만 사용. service role 키는 서버 코드(발송 작업)에서만 사용.
- 검증: SESSION 02에서 서로 다른 두 사용자로 교차 접근 테스트를 작성·통과했다 (`npm run test:rls`, 25개).

## 6. 개인정보·삭제 요구 구조
- 계정 삭제 시 `auth.users` 삭제 → 모든 하위 데이터 cascade 삭제.
- 수집 항목 최소화: 이메일(로그인), 자녀 별명·생년월일, 기록 본문, 수신 동의 여부.
- 분석 이벤트에는 본문·자녀 정보·이메일을 보내지 않는다 (SESSION 09 지표는 집계/익명 단위).
- 개인정보 처리방침·삭제 요청 절차의 문구는 법률 검토 필요 (미정).

## 7. 미결정 사항
- (해결) 인증 방식: 일회용 코드로 확정 (D-016).
- 발신 도메인: 베타 전 필요 (D-017). 정식 Supabase 프로젝트·배포 주소 (SESSION 08).
- 장기 방향(PWA → 앱, 사진·공유·오디오) 전환 시기와 방식은 베타 결과 후 (D-015).
- (해결) 주간 이메일 발송: 전원 월요일 19:00 KST, 동의자만, 가입 주 건너뜀 (D-022). 19시가 최적인지는 가설.
- 이메일 발송 서비스: Resend(REST). 발신 도메인은 미확보 (D-017).
- (해결) 기간별 묶음의 기준: 달력 고정 구간·작성일 기준 (D-021).
- 주간 질문 콘텐츠와 시드 분량: 12주 초안 시드가 있으나 문구·분량은 사용자 확정 필요(시드는 2026-12-14 주까지라 베타 전 추가 필요).
