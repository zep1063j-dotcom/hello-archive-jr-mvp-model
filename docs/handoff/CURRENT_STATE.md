# CURRENT STATE

최종 갱신: 2026-10-24 (SESSION 04 종료)

## 세션 현황
- 현재 세션: 없음 (다음 채팅에서 **SESSION 05 — 주간 질문 및 기록 CRUD** 시작)
- 마지막 완료 세션: **SESSION 04 — 자녀 프로필** (DONE, 2026-10-24). 그 전: 03 (인증), 02 (DB), 01 (UI/UX 목 데이터), 00.
- 진행 단계: 전체 10세션(00~09) 중 00~04 완료, 5개 완료 / 5개 남음.

## 구현 완료된 것
- SESSION 00: Next.js 16.4.3 / React 19.3.0 / TypeScript / Tailwind v4 / ESLint 스캐폴드, 폴더 구조, `.env.example`, 문서 시스템.
- SESSION 01 (**목 데이터, 아무것도 저장하지 않음**):
  - 라우트: `/`(소개), `/home`, `/write`, `/archive`, `/archive/[entryId]`, `/archive/chapters/[1m|3m|1y]`, `/profile`, 전역 not-found, `(app)` loading/error. `(public)`/`(app)` 라우트 그룹.
  - 홈 허브(D-009), 상단 고정 내비게이션(D-010), 이동 애니메이션(D-011), 에디토리얼 기록장 디자인(D-008, D-012).
  - 공통 코드: `src/lib/date.ts`(KST), `src/lib/entries.ts`, `src/lib/mock-data.ts`(교체 대상), `src/types/archive.ts`, `src/components/states.tsx`.
  - 목 시나리오 URL: `?mock=written|empty|error`, `/home?fail=1`·`/write?fail=1` (D-007).
- SESSION 02 (DB, 개발용 Supabase에 적용·검증됨): 테이블 5개(`parent_settings`, `children`, `weekly_questions`, `entries`, `email_deliveries`), 전 테이블 RLS, 컬럼 단위 GRANT, 복합 FK, 중복 방지 unique (D-013, D-014). 마이그레이션 2개, 시드(12주, 문구 초안), `src/types/database.ts`(손으로 작성). `npm run test:rls` 25/25 통과.
- **SESSION 03 (인증, 실제 메일로 검증됨)**:
  - **이메일 일회용 코드 로그인** (D-016): `/login`에서 이메일 입력 → 메일의 숫자 코드 입력 → 로그인. 서버 액션 `submitLogin`(`src/app/actions/auth.ts`). 코드 길이는 Supabase 설정값(이 프로젝트는 8자리), 앱은 6~10자리 허용.
  - 세션: `@supabase/ssr@0.12.7` 쿠키 세션, `src/lib/supabase/server.ts`, `src/lib/auth.ts`(`requireUser()`, `safeNextPath()`).
  - 보호 라우트: `src/proxy.ts`(`/home·/write·/archive/*·/profile` 비로그인 시 `/login?next=`, 로그인 상태 `/login`은 `/home`) + `(app)` 레이아웃의 서버 재검증 (D-018).
  - 프로필: 로그인 이메일 표시, **로그아웃 동작**. 첫 로그인 시 `parent_settings`(`email_consent=false`) 생성.
  - 메일 발송: **Resend SMTP**를 Supabase에 연결(사용자가 대시보드에서 설정), 템플릿 2개에 `{{ .Token }}` (D-017). 장기 방향(앱 전환) 원칙은 D-015.
- **SESSION 04 (자녀 프로필, 실제 DB로 검증됨)**:
  - `/onboarding`(별도 화면): 별명·생년월일 등록. 자녀가 없으면 `/home·/write·/archive*·/profile`이 `requireChild(next)`로 `/onboarding?next=`에 보내고 등록 후 복귀(D-019).
  - `/profile`: 자녀 조회 + `?edit=1` 수정 폼 + 저장 안내. `/home`은 실제 자녀 이름·나이. 서버 액션 `createChild`/`updateChild`(`src/app/actions/children.ts`), 조회 `src/lib/children.ts`, 검증 `src/lib/child-validation.ts`(순수 TS).
  - 자녀 1명 제한: 앱 로직 + **DB 유니크 인덱스 `children_one_per_parent_idx`**(마이그레이션 `20261024000200`, 개발용 DB 적용됨). 동시 요청 경합을 실측으로 확인해 추가.
  - **질문·기록은 아직 목 데이터**(`mock-data.ts`, `?mock`·`?fail`, `MockNotice` 남아 있음). `mockChild`만 제거됨.
- 종료 시점 검증 (2026-10-24): `typecheck`, `lint`, `build` 통과, `npm run test:unit` 16/16, `npm run test:children` 7/7, `npm run test:rls` 25/25.

## 아직 구현하지 않은 것
실제 기록 저장·수정·삭제, 주간 질문의 DB 연결(**질문·기록 화면은 아직 목 데이터** — 로그인 이메일과 자녀만 실제), 기간 묶음의 실제 기준, 주간 이메일(`/api/*`), 데이터 삭제 요청. `/auth/callback`·`/auth/expired`는 코드 방식이라 만들지 않는다. 소개 페이지(`/`)는 정적이라 로그인 분기가 없다(`/login`에서 `/home`으로 간다).

## DB·외부 서비스 환경 (확인된 사실)
- 개발용 원격 Supabase 프로젝트(ref는 `.env.local`의 URL). 마이그레이션 3개(`…000000`, `…000100`, `…000200`)와 시드 적용됨. 사용자 데이터 테이블: `parent_settings` 1행(사용자 본인), 나머지 0행(자녀도 0행 — 사용자가 다음에 로그인하면 온보딩이 뜬다). `weekly_questions` 12행.
- `.env.local`(Git 제외)에 URL·publishable 키·service role 키(테스트용). service role 키는 앱의 브라우저 코드에서 쓰지 않는다.
- Supabase Auth: 이 프로젝트는 커스텀 SMTP(**Resend**, 발신 `onboarding@resend.dev` 이름 "Hello Archive jr")가 연결돼 있고 "Magic link or OTP"·"Confirm sign up" 템플릿이 코드(`{{ .Token }}`) 형태로 바뀌어 있다. 이 설정은 코드가 아니라 **대시보드 설정**이다(SETUP 참고).
- Resend: 계정은 있고 도메인은 없다 → 현재 **사용자 본인 이메일에만** 발송 가능(조건은 직접 확인하지 못함). 정식(베타용) Supabase 프로젝트, 도메인, Vercel/배포 상태는 **없거나 미확인**. GitHub `origin`은 설정돼 있고 push는 사용자가 직접.

## 미검증
- **새 이메일 가입 경로**(Confirm sign up 템플릿으로 코드가 오는지): 본인 이메일은 이미 가입돼 있어 못 해봤다. 도메인 연결 후 SESSION 08 QA.
- 며칠 뒤 세션 유지·만료 후 갱신, Safari·아이폰·메일 앱 내장 브라우저, Supabase/Resend 발송 한도(시간당 수치), 키보드·스크린리더 접근성.
- SESSION 01 이월: 이동 애니메이션 체감, Safari·모바일 실기기, 홈 허브 `?mock=empty`·"수정하기" 재저장, 프로덕션 not-found HTTP 상태, 기간 경계.
- `src/types/database.ts`가 실제 DB와 일치하는지는 자동 검증하지 않는다. 이번 주가 아닌 과거 질문 기록은 DB가 막지 않는다(SESSION 05 서버 규칙).
- 허브·연속 주 수 효과, 상단 2단 메뉴 모바일 사용성, 코드 입력 한 단계의 체감 마찰은 **가설**. 로고(`h·`)는 임시. 주간 질문 문구는 초안.
- **SESSION 04 미검증**: iOS Safari의 날짜 입력, 스크린리더 실제 읽기, 앱 화면에서 두 계정 교차 확인(Resend 도메인 필요), 생년월일 18년 하한(`MAX_CHILD_AGE_YEARS`)의 적절성(가정), 제출 오류 시 포커스가 첫 오류 필드로 안 가는 점(개선 여지), 이 Mac은 전체 Xcode가 없어 iOS 시뮬레이터 도구 사용 불가.
- 자동화 테스트: 순수 로직(`test:unit`), DB(`test:rls`, `test:children`). 인증·화면 테스트는 수동 검증만 했다.

## 진행 중인 작업
없음. **SESSION 04의 코드·문서는 아직 커밋되지 않았다**(사용자가 직접 커밋·푸시; SESSION 03 코드는 `5db5fe9`에 이미 커밋됨). 변경 파일: `src/lib/{child-validation(.test),children,date}.ts`, `src/app/actions/children.ts`, `src/components/child-form.tsx`, `src/app/onboarding/*`, `(app)` 페이지 6개, `src/proxy.ts`, `tsconfig.json`, `package.json`, `supabase/migrations/20261024000200_…sql`, `supabase/tests/children-app.test.ts`, `docs/handoff/*`.

## 미해결 사항 · 차단 요소
- **베타 전 도메인 필요**: Resend 발신 도메인 인증 없이는 본인 외에게 메일을 못 보낸다(D-017). 도메인은 Vercel 배포 주소·주간 메일(SESSION 07)에도 쓴다. SESSION 08 전에 구한다.
- 정식 Supabase 프로젝트를 새로 만들어 마이그레이션·시드·SMTP·템플릿·리다이렉트(Site URL) 설정을 다시 해야 한다 (SESSION 08).
- 메일 템플릿 저장 후 몇 분간 옛 템플릿으로 발송됐다. 템플릿을 바꾸면 시간을 두고 시험한다.
- **수익 모델 논의(미결정, 문서화하지 않음)**: "기록은 무료, 제작물(책 등)에서만 유료", "구독 시 일부 사용자 무료 부여 가능(권한과 결제 분리 설계)". 사용자가 확정하지 않았다. 필요하면 SESSION 09에서 성공 기준과 함께 가설로 정리.
- `next build`는 Google Fonts를 받으므로 네트워크가 필요하다 (D-008).
- 개발 서버 주의: 이 폴더에 다른 채팅의 `next dev`(PID 5312, 3000 포트)가 떠 있을 수 있다. 임의로 종료하지 않는다. 확인용 프로덕션 서버는 `.claude/launch.json`의 `prod-3100`(포트 3100, 먼저 `npm run build`).
- `npm run test:rls`는 Node `MODULE_TYPELESS_PACKAGE_JSON` 경고를 낸다 (무해).
- 원격 push는 사용자가 직접 한다. Claude는 push하지 않는다.

## 개발 실행 방법
```bash
npm ci            # 처음 한 번
npm run dev       # http://localhost:3000
```
로그인이 필요한 화면을 보려면 `.env.local`과 Supabase SMTP 설정이 필요하다 (`SETUP.md`). 검증: `npm run typecheck && npm run lint && npm run build`, DB는 `npm run test:rls`(개발용 프로젝트에서만).

## 다음에 수행할 정확한 작업
1. (사용자) SESSION 04 변경(코드·마이그레이션·문서)을 로컬 커밋·푸시.
2. 새 채팅에서 **SESSION 05 — 주간 질문 및 기록 CRUD**: 시작 전 이 문서와 `sessions/SESSION_04.md`를 읽는다. `weekly_questions` 조회(이번 주 = KST 월요일 `week_start`, 해당 주 질문이 없으면 빈/오류 상태), `entries` 작성·수정·삭제(서버 코드에서 `requireUser()`+`getMyChild()`, RLS와 이중 검증), **이번 주 질문에만 기록 가능**(DB는 막지 않음, D-013), 같은 주 재작성은 수정(unique 위반 처리), 본문 trim·5000자 검증(`child-validation.ts`와 같은 방식의 순수 모듈), `/home`의 허브 쓰기 카드와 `/write` 폼을 하나로 합칠지 결정(D-009), 저장 중·오류·중복 제출 방지.
3. 목 데이터 제거 계획: 05에서 `weekly_questions`/`entries` 연결 후 `mock-data.ts`, `?mock`·`?fail`, `MockNotice`, `MOCK_TODAY` 제거. 아카이브 화면(06)이 목 데이터를 쓰는 부분은 06에서 교체하되 05에서 임시로 깨지지 않게 한다.
4. 사용자에게 확인할 것: 주간 질문 문구·분량(12주 초안, 05 전에 확정 필요), 기록 삭제 시 확인 UI 방식.

## 다음 작업 관련 파일
- `docs/handoff/ARCHITECTURE.md` (라우트·데이터 모델 5절), `DECISIONS.md` (D-005, D-009, D-013, D-014, D-018, D-019)
- `src/lib/children.ts`(`getMyChild`), `src/lib/auth.ts`, `src/lib/supabase/server.ts`, `src/types/database.ts`, `src/lib/mock-data.ts`, `src/lib/entries.ts`, `src/components/home/*`, `src/components/write-form.tsx`, `src/app/(app)/write/page.tsx`
- `supabase/migrations/*`, `supabase/seed/weekly_questions.sql`, `supabase/tests/*`
