# ARCHITECTURE — 라우팅 · 화면 구조 · 데이터 모델 (설계안)

> 상태: **SESSION 00 설계안. 아직 구현되지 않았다.** 각 세션에서 구현하며 달라지면 이 문서와 `DECISIONS.md`를 함께 갱신한다.

## 1. 폴더 구조 (현재 생성됨)
```
src/
  app/            # App Router (라우트, 레이아웃)
  components/     # 재사용이 필요한 UI만
  lib/
    supabase/     # 브라우저/서버 클라이언트 (SESSION 02~03)
  types/          # DB 타입 등
supabase/
  migrations/     # SQL 마이그레이션 (SESSION 02)
  seed/           # 주간 질문 시드 (SESSION 02/05)
docs/handoff/     # 인수인계 문서
```

## 2. 라우트 설계
`(public)` 그룹은 비로그인 접근 가능, `(app)` 그룹은 인증 필수(`proxy.ts` + 서버 소유권 검증).

| 경로 | 그룹 | 설명 | 세션 |
|---|---|---|---|
| `/` | public | 소개 + 시작하기. 로그인 상태면 `/home`으로 | 01, 03 |
| `/login` | public | 이메일 입력 → 인증 메일 요청. `?next=` 지원 | 03 |
| `/auth/callback` | public(route handler) | 인증 코드 교환, `next` 검증 후 리다이렉트 | 03 |
| `/auth/expired` | public | 만료/사용된 링크 안내 + 재발급 | 03, 07 |
| `/onboarding` | app | 첫 로그인 시 자녀 프로필 등록 | 04 |
| `/home` | app | 대시보드: 이번 주 질문 CTA, 최근 기록 | 01 |
| `/write` | app | 이번 주 질문 + 기록 작성/수정 (**이메일 딥링크 목적지**) | 05 |
| `/archive` | app | 타임라인(최신순) | 06 |
| `/archive/[entryId]` | app | 기록 상세 | 06 |
| `/archive/chapters/[period]` | app | `1m` 미니챕터 / `3m` 이야기집 / `1y` 기록집 | 06 |
| `/profile` | app | 자녀 프로필, 이메일 수신 설정, 로그아웃, 데이터 삭제 요청 | 04, 07 |
| `/api/cron/weekly-email` | route handler | 예약 실행 진입점. `CRON_SECRET` Bearer 검증 | 07 |

모바일 하단 내비게이션(홈 / 기록 쓰기 / 아카이브 / 프로필)을 기본으로 하고 데스크톱에서는 중앙 정렬 컬럼 + 상단 내비게이션으로 확장한다.

## 3. 사용자 흐름
1. 신규: `/` → `/login` → 메일 인증 → `/onboarding`(자녀 등록) → `/write`.
2. 재방문(세션 유효): `/home` → `/write` → 저장 → 저장 상태 표시 → `/archive`.
3. 이메일 링크: 메일의 `/write` 링크 클릭 → 세션 유효하면 즉시 작성 화면 / 없으면 `/login?next=/write` → 인증 메일 → `/auth/callback?next=/write` → `/write`.
4. 링크 만료: `/auth/expired` → 같은 이메일로 재발급(`next` 유지).

## 4. 인증 리다이렉트 설계 원칙 (SESSION 03에서 구체화)
- `next` 값은 **같은 사이트의 내부 경로 허용 목록**(예: `/write`, `/home`, `/archive…`)만 허용한다. 외부 URL, `//`, `\` 포함 값은 버리고 `/home`으로 보낸다 (open redirect 방지).
- 주간 안내 이메일 링크는 `APP_URL/write` 형태의 **일반 링크**다. 로그인 토큰을 포함하지 않는다.
- 인증 메일의 링크/코드는 Supabase Auth의 일회성·짧은 만료를 사용한다. 실제 만료 시간·이메일 보안 스캐너가 링크를 먼저 열어 토큰을 소모하는 문제(→ 일회용 코드 입력 방식과의 비교)는 **SESSION 03에서 공식 문서와 실제 메일로 확인해 결정**한다 (미확정).
- 서버 컴포넌트/route handler에서 `getUser()`로 사용자를 확인한다 (세션 쿠키만 믿지 않는다).

## 5. 데이터 모델 (PostgreSQL / Supabase) — 설계안
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
- 타임라인 정렬 기준은 `created_at desc`. 기간 묶음(1/3/12개월)의 기준일·경계는 SESSION 06에서 KST 기준 반개구간 `[start, end)`로 정의한다.

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
- 검증: SESSION 02에서 서로 다른 두 사용자로 교차 접근 테스트를 작성한다.

## 6. 개인정보·삭제 요구 구조
- 계정 삭제 시 `auth.users` 삭제 → 모든 하위 데이터 cascade 삭제.
- 수집 항목 최소화: 이메일(로그인), 자녀 별명·생년월일, 기록 본문, 수신 동의 여부.
- 분석 이벤트에는 본문·자녀 정보·이메일을 보내지 않는다 (SESSION 09 지표는 집계/익명 단위).
- 개인정보 처리방침·삭제 요청 절차의 문구는 법률 검토 필요 (미정).

## 7. 미결정 사항
- 인증 방식 최종안: 매직 링크 vs 일회용 코드 (SESSION 03).
- 주간 이메일 발송 요일·시간 (SESSION 07, 사용자 결정).
- 이메일 발송 서비스·발신 도메인 (SESSION 07).
- 기간별 묶음의 기준일 정의 (SESSION 06).
- 주간 질문 콘텐츠와 시드 분량 (SESSION 02/05).
