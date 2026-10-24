# CURRENT STATE

최종 갱신: 2026-10-24 (SESSION 02 종료)

## 세션 현황
- 현재 세션: 없음 (다음 채팅에서 **SESSION 03 — 부모 인증** 시작)
- 마지막 완료 세션: **SESSION 02 — Supabase 데이터베이스** (DONE, 2026-10-24). 그 전: SESSION 01 (UI/UX 목 데이터), SESSION 00.

## 구현 완료된 것
- SESSION 00: Next.js 16.4.3 / React 19.3.0 / TypeScript / Tailwind v4 / ESLint 스캐폴드, 폴더 구조, `.env.example`, 문서 시스템.
- SESSION 01 (**목 데이터, 아무것도 저장하지 않음**):
  - 라우트: `/`(소개), `/home`, `/write`, `/archive`, `/archive/[entryId]`, `/archive/chapters/[1m|3m|1y]`, `/profile`, 전역 not-found, `(app)` loading/error. `(public)`/`(app)` 라우트 그룹.
  - 홈 허브(D-009), 상단 고정 내비게이션(D-010), 이동 애니메이션(D-011), 에디토리얼 기록장 디자인(D-008, D-012).
  - 공통 코드: `src/lib/date.ts`(KST), `src/lib/entries.ts`, `src/lib/mock-data.ts`(교체 대상), `src/types/archive.ts`(화면 계약 타입), `src/components/states.tsx`.
  - 목 시나리오 URL: `?mock=written|empty|error`, `/home?fail=1`·`/write?fail=1` (D-007).
- **SESSION 02 (DB, 개발용 Supabase 프로젝트에 적용·검증됨)**:
  - 테이블 5개: `parent_settings`, `children`, `weekly_questions`, `entries`, `email_deliveries`. 전 테이블 RLS, 컬럼 단위 GRANT, 복합 FK(타인 자녀에 기록 불가), 중복 기록·중복 발송 방지 unique, 서버 갱신 트리거 (D-013).
  - 빈 텍스트 검사는 정규식 (D-014). 마이그레이션 2개: `supabase/migrations/20261024000000_initial_schema.sql`, `20261024000100_fix_blank_text_checks.sql`. 시드: `supabase/seed/weekly_questions.sql` (12주, **문구 초안**).
  - `@supabase/supabase-js@2.118.0`, `src/types/database.ts`(손으로 작성한 DB 타입).
  - `npm run test:rls`: 임시 사용자 2명으로 교차 접근·권한·제약·cascade 25개 테스트 → **25/25 통과**.
- 종료 시점 검증: `npm run typecheck`, `npm run lint`, `npm run build` 통과 (2026-10-24).

## 아직 구현하지 않은 것
인증/로그인/보호 라우트(`proxy.ts`), `src/lib/supabase/` 앱용 클라이언트(브라우저/서버 쿠키 세션), 자녀 프로필 입력·저장, 실제 기록 저장·수정·삭제, 화면의 DB 연결(**아직 전부 목 데이터**), 기간 묶음의 실제 기준, 주간 이메일, `/login`·`/auth/*`·`/onboarding`·`/api/*`. `(app)` 화면은 로그인 없이 누구나 열린다. 프로필의 수정·로그아웃·삭제 요청은 비활성 자리표시자.

## DB 환경 (확인된 사실)
- 개발용 원격 Supabase 프로젝트가 있고 마이그레이션 2개와 시드가 적용돼 있다. 현재 사용자 데이터 테이블은 모두 0행, `weekly_questions` 12행.
- `.env.local`(Git 제외)에 URL·publishable 키·service role 키(테스트용)가 있다. service role 키는 RLS를 우회하므로 앱의 브라우저 코드에서 쓰지 않는다.
- 정식(베타용) Supabase 프로젝트는 **아직 없다** (SESSION 08 전에 필요). Resend 계정, Vercel/배포 상태는 미확인. GitHub 원격은 `origin`이 설정돼 있으나 push는 사용자가 직접.

## 미검증
- 이동 애니메이션 체감, Safari·모바일 실기기, 홈 허브 `?mock=empty`·"수정하기" 재저장, 키보드·스크린리더 접근성, 프로덕션 not-found HTTP 상태, 기간 경계. (SESSION 01 이월)
- **Supabase Auth**(이메일 로그인, 메일 발송, 리다이렉트 허용 목록)는 아직 시도하지 않았다. 테스트 사용자는 admin API로만 만들었다.
- `src/types/database.ts`가 실제 DB와 정확히 일치하는지는 자동 검증하지 않는다 (타입은 테스트 코드 컴파일로만 간접 확인).
- 이번 주가 아닌 과거 질문에 기록할 수 있는지: DB는 막지 않는다 (SESSION 05 서버 규칙 필요).
- 허브·연속 주 수 동기 부여 효과, 상단 2단 메뉴 모바일 사용성은 **가설**. 로고(`h·`)는 임시 제작. 주간 질문 문구는 초안.
- 자동화 테스트는 DB 테스트(`test:rls`)뿐이다. 화면·로직 테스트는 없다.

## 진행 중인 작업
없음. SESSION 02의 코드·마이그레이션·테스트는 사용자가 `7d19b7d phase 2 end`로 직접 커밋했다. 그 뒤에 바뀐 종료 문서(`CURRENT_STATE`, `ROADMAP`, `ARCHITECTURE`, `SESSION_HISTORY`, `DECISIONS` D-014, `sessions/SESSION_02.md`)는 아직 커밋되지 않았다. 로컬 커밋은 사용자 요청·동의 시, push는 사용자가 직접.

## 미해결 사항 · 차단 요소
- 인증 방식(매직 링크 vs 일회용 코드)은 SESSION 03에서 결정 (D-006). Supabase 기본 이메일 발송 한도·보안 스캐너가 링크를 먼저 여는 문제는 현재 공식 문서로 확인해야 한다.
- `cacheComponents`와 쿠키 세션 호환은 SESSION 03에서 확인 (D-002).
- `next build`는 Google Fonts(Noto Serif KR)를 받으므로 네트워크가 필요하다 (D-008).
- 개발 서버 주의: 이 폴더에 `next dev`가 이미 떠 있으면(다른 채팅·터미널) 새 `npm run dev`는 실패한다. 다른 사람의 서버를 임의로 종료하지 않는다. 오래 떠 있던 서버는 `globals.css` 변경을 반영하지 못한 적이 있다.
- `npm run test:rls`는 Node `MODULE_TYPELESS_PACKAGE_JSON` 경고를 낸다 (무해).
- 원격 push는 사용자가 직접 한다. Claude는 push하지 않는다.

## 개발 실행 방법
```bash
npm ci            # 처음 한 번
npm run dev       # http://localhost:3000
```
검증: `npm run typecheck && npm run lint && npm run build`, DB는 `npm run test:rls` (개발용 프로젝트에서만). 환경 설정은 `SETUP.md`.

## 다음에 수행할 정확한 작업
1. (선택) 종료 문서 변경을 로컬 커밋.
2. 새 채팅에서 **SESSION 03 — 부모 인증**: 시작 전 `node_modules/next/dist/docs/01-app/02-guides/authentication*.md`와 설치된 Supabase 문서로 방식을 정한다. 이메일 패스워드리스, `/login`, `/auth/callback`(안전한 `next` 검증), `/auth/expired`, 세션 유지, 로그아웃, `proxy.ts` 보호 라우트(낙관적 차단) + 서버 `getUser()` 검증, `parent_settings` upsert. 사용자에게 확인할 것: 인증 방식 선호, 로그인 메일 발송 방식(기본 SMTP로 베타 규모 충분한지), 리다이렉트 URL 설정.
3. 목 데이터 교체 계획: 03에서 인증, 04에서 `children` 연결 + 온보딩, 05에서 `weekly_questions`/`entries` 연결 후 `mock-data.ts`, `?mock`·`?fail`, `MockNotice` 제거. 디자인 수정은 실제 기록으로 보며 하는 편이 낫다.

## 다음 작업 관련 파일
- `docs/handoff/ARCHITECTURE.md` (라우트·인증 원칙 4절·데이터 모델 5절), `DECISIONS.md` (D-002, D-006, D-013, D-014)
- `supabase/migrations/*`, `src/types/database.ts`, `supabase/tests/rls.test.ts`
- `.env.example`, `docs/handoff/SETUP.md`
