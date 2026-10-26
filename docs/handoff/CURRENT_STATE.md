# CURRENT STATE

최종 갱신: 2026-10-26 (SESSION 08 진행 중 — 도메인·Resend 연결 완료, Cron 첫 실행·시험 데이터 정리 남음)

## 세션 현황
- 현재 세션: **SESSION 08 — QA 및 실제 배포 (IN_PROGRESS)**: 전체 테스트 재통과·보안 헤더 추가, **Vercel 배포(`hello-archive-jr-mvp-model.vercel.app`)와 정식 Supabase(`helloarchive beta -v`) 연결·코드 로그인·자녀 등록 확인(사용자 보고)**. 남은 것: 스모크 나머지, Cron(월 19시 KST), 도메인(`sessions/SESSION_08.md`, 체크리스트 `SETUP.md`).
- 직전 완료 세션: **SESSION 07 — 주간 이메일 자동화 (DONE)**. 구현·로컬 검증에 더해 실제 Resend 발송 1통이 사용자 받은편지함에 도착함을 확인했다(발송 작업 직접 호출). Vercel Cron 실동작은 SESSION 08.
- 마지막 완료 세션: **SESSION 06 — 성장 아카이브** (DONE, 2026-10-25). 그 전: 05 (질문·기록), 04 (자녀), 03 (인증), 02 (DB), 01 (UI/UX), 00.
- 진행 단계: 전체 10세션(00~09) 중 00~06 완료(7개), 07 진행 중, 08~09 남음.

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
- **SESSION 05 (질문·기록 CRUD, 실제 DB로 검증됨, D-020)**:
  - 목 데이터 전부 제거(`mock-data.ts`, `?mock`·`?fail`, `MockNotice`). 홈·`/write`·아카이브·상세·챕터가 실제 `weekly_questions`/`entries`를 읽는다 (`src/lib/my-entries.ts`).
  - 이번 주 질문 = 오늘(KST)이 속한 월요일(`weekStartOf()`). 새 기록은 이번 주 질문에만, 같은 주 재작성은 수정, 동시 요청도 1행(`saveThisWeekEntry`, 서버 액션 `src/app/actions/entries.ts`). 지난 기록은 상세에서 본문 수정·삭제(삭제는 확인 단계 후 `/archive`로).
  - `/write`는 홈의 `WeekComposer`를 펼친 채로 보여준다(이메일 딥링크 목적지). 본문 검증은 순수 모듈 `src/lib/entry-validation.ts`.
- **SESSION 06 (성장 아카이브, 실제 DB 시험 데이터로 검증됨, D-021)**:
  - 기간 묶음 = **달력 고정 구간**(월/분기/연), KST 반개구간 `[start, end)`, 기록 소속은 작성일(KST). 순수 모듈 `src/lib/chapters.ts`. 임시 `filterByPeriod`·홈 기간 탭 제거.
  - `/archive/chapters/[period]`(챕터 목록, 진행 중/완결) → `/archive/chapters/[period]/[chapterKey]`(챕터 상세, 키 `2026-10`·`2026-q4`·`2026`, 이전·다음 챕터). 잘못된 키·미래 구간은 404. 홈은 "최근 기록"(최근 8주 범위) + 아카이브 링크, 전체·월별 열람은 `/archive`.
  - 검증: `test:unit` 62/62(챕터 30개 추가), typecheck·lint·build 통과, 브라우저로 KST 자정 경계·분기·연·빈 상태·404·375px 확인(시험 데이터는 삭제해 자녀·기록 0행 복구).
- **SESSION 07 (주간 이메일, 로컬·DB 검증됨, 실제 발송·수신 확인됨, D-022)**:
  - 정책: **전원 월요일 19:00 KST**, 수신 동의자만, 자녀 있어야 함, 이번 주 발송 시각 이후에 가입·동의한 부모는 다음 월요일부터, 이번 주 이미 기록한 부모는 건너뜀(`skipped`). 시각은 `WEEKLY_EMAIL_SEND_HOUR_KST` + `vercel.json`.
  - `GET /api/cron/weekly-email`(`CRON_SECRET` Bearer) → `runWeeklyEmailJob`(`src/lib/weekly-email-job.ts`): `email_deliveries` 유니크 행 점유 후 Resend 발송(`src/lib/resend.ts`, `Idempotency-Key`), `failed` 최대 3회, 오래된 `processing`은 이어서. `vercel.json` = 월·화 10:00 UTC(화는 보충). service role 클라이언트는 `src/lib/supabase/admin.ts`(예약 실행 전용).
  - 메일 본문: 질문 + `/write` 일반 링크 + 프로필 링크. 로그인 토큰·자녀 정보·추적 요소 없음.
  - 수신 동의 UI: 온보딩의 선택 체크박스(기본 해제), 프로필의 켜기/끄기(`setEmailConsent`, 사용자 세션·RLS).
  - 검증: `test:unit` 80/80, `test:weekly-email` 10/10(실제 DB+가짜 발송기, 동시 실행 1통 포함), 크론 인증 401/401/200, 브라우저로 온보딩·프로필 동의 확인.
- 이전 검증 (2026-10-25, SESSION 05): `typecheck`, `lint`, `build` 통과, `npm run test:unit` 32/32, `test:children` 7/7, `test:rls` 25/25, `test:entries` 9/9. 브라우저로 작성→새로고침→수정→상세 수정→삭제→404·빈 상태 확인.

## 아직 구현하지 않은 것
데이터 삭제 요청, 이메일 발송 이력 화면(DB에는 `email_deliveries`로 기록됨). `/auth/callback`·`/auth/expired`는 코드 방식이라 만들지 않는다. 소개 페이지(`/`)는 정적이라 로그인 분기가 없다(`/login`에서 `/home`으로 간다).

## DB·외부 서비스 환경 (확인된 사실)
- 개발용 원격 Supabase 프로젝트(ref는 `.env.local`의 URL). 마이그레이션 3개(`…000000`, `…000100`, `…000200`)와 시드 적용됨. 사용자 데이터 테이블: `parent_settings` 1행(사용자 본인), 나머지 0행(자녀·기록 0행 — SESSION 06 시험용 자녀·기록도 삭제해 되돌렸으므로 사용자가 다음에 로그인하면 온보딩이 뜬다). `weekly_questions` 12행(**2026-09-28 ~ 2026-12-14 주**, 이후 주는 질문이 없어 홈에 "질문을 준비하고 있어요"가 뜬다).
- `.env.local`(Git 제외)에 URL·publishable 키·service role 키(테스트용). **`RESEND_API_KEY`·`EMAIL_FROM`·`CRON_SECRET`은 비어 있다**(SESSION 07 시점 확인, 값은 보지 않음). `email_deliveries`는 0행. service role 키는 앱의 브라우저 코드에서 쓰지 않는다.
- Supabase Auth: 이 프로젝트는 커스텀 SMTP(**Resend**, 발신 `onboarding@resend.dev` 이름 "Hello Archive jr")가 연결돼 있고 "Magic link or OTP"·"Confirm sign up" 템플릿이 코드(`{{ .Token }}`) 형태로 바뀌어 있다. 이 설정은 코드가 아니라 **대시보드 설정**이다(SETUP 참고).
- Resend: 계정은 있고 도메인은 없다 → 현재 **사용자 본인 이메일에만** 발송 가능(조건은 직접 확인하지 못함). 정식(베타용) Supabase 프로젝트, 도메인, Vercel/배포 상태는 **없거나 미확인**. GitHub `origin`은 설정돼 있고 push는 사용자가 직접.

## 미검증
- **새 이메일 가입 경로**(Confirm sign up 템플릿으로 코드가 오는지): 본인 이메일은 이미 가입돼 있어 못 해봤다. 도메인 연결 후 SESSION 08 QA.
- 며칠 뒤 세션 유지·만료 후 갱신, Safari·아이폰·메일 앱 내장 브라우저, Supabase/Resend 발송 한도(시간당 수치), 키보드·스크린리더 접근성.
- SESSION 01 이월: 이동 애니메이션 체감, Safari·모바일 실기기, 홈 허브 `?mock=empty`·"수정하기" 재저장, 프로덕션 not-found HTTP 상태, 기간 경계.
- `src/types/database.ts`가 실제 DB와 일치하는지는 자동 검증하지 않는다. 이번 주가 아닌 과거 질문 기록은 DB가 막지 않는다(SESSION 05 서버 규칙).
- 허브·연속 주 수 효과, 상단 2단 메뉴 모바일 사용성, 코드 입력 한 단계의 체감 마찰은 **가설**. 로고(`h·`)는 임시. 주간 질문 문구는 초안.
- **SESSION 04 미검증**: iOS Safari의 날짜 입력, 스크린리더 실제 읽기, 앱 화면에서 두 계정 교차 확인(Resend 도메인 필요), 생년월일 18년 하한(`MAX_CHILD_AGE_YEARS`)의 적절성(가정), 제출 오류 시 포커스가 첫 오류 필드로 안 가는 점(개선 여지), 이 Mac은 전체 Xcode가 없어 iOS 시뮬레이터 도구 사용 불가.
- **SESSION 05 미검증**: 세션 만료 중 저장(로그인으로 이동, 쓴 내용 소실), 앱 화면 두 계정 교차 확인, iOS Safari, 스크린리더. (주 경계·질문 없는 주·네트워크 실패·5000자는 종료 직전 화면으로 확인함.) 프로덕션 서버 로그의 `Date.now() while prerendering` 메시지는 이번 변경과 무관한 코드에서도 나며(가설: supabase-js 세션 로딩), 동작 영향은 없다.
- **SESSION 07 미검증**: 크론 라우트 경유 실제 발송(이번엔 발송 작업을 직접 호출), Resend 한도·여러 명 발송, Vercel Cron 동작(미배포)·UTC 해석, 메일 클라이언트별 렌더링·스팸 분류, 메일 링크로 비로그인 진입 후 작성 화면 복귀(실제 메일로), 법률 검토(광고성 정보 해당 여부·수신 거부 표기·처리방침). 월요일 저녁 19시가 최적인지는 가설.
- **SESSION 06 미검증**: 프로덕션 404의 HTTP 상태 코드, 앱 화면 두 계정 교차 확인, iOS Safari, 스크린리더, 기록이 많을 때의 성능·가독성, 연 경계의 실제 동작(단위 테스트만). 분기·연 챕터가 부모에게 "책 같은 묶음"으로 느껴지는지, 챕터가 1개뿐인 초기 화면의 체감은 **가설**.
- 자동화 테스트: 순수 로직(`test:unit`), DB(`test:rls`, `test:children`, `test:entries`). 인증·화면 테스트는 수동 검증만 했다.

## 도메인 연결 완료 (2026-10-26, 일시 중단 해제)
- 도메인 `helloblank.net`을 Namecheap에서 구매(사용자). 앱 주소 **`https://archivejr.helloblank.net`**(Vercel 도메인, DNS CNAME). 기존 `hello-archive-jr-mvp-model.vercel.app`도 열린다(베타 부모에게는 새 주소만 안내).
- Resend에 `helloblank.net` 인증(DKIM TXT·`rsend`/`send` CNAME·DMARC `p=none`)을 추가하고 Verified 확인(사용자 보고). Supabase SMTP 발신 주소 `hello@helloblank.net`, Site URL·Vercel `NEXT_PUBLIC_APP_URL`·`EMAIL_FROM` 변경 후 재배포(사용자 수행). **본인 외 이메일로 코드 메일 도착·로그인 확인은 사용자 보고**(Claude 미확인, 스팸 분류·도착 시간 미기록).
- Claude가 외부에서 확인: 새 주소 `/`·`/login` 200, 보호 라우트 307, 크론 401, 보안 헤더·HSTS, DNS 5개 레코드 반영.
- 남은 것: Vercel Cron 첫 실행(2026-10-26 월요일 19:00~19:59 KST, `email_deliveries`·Cron 로그 확인 — 시험 계정은 가입 주 규칙으로 대상이 아닐 수 있다), 시험 데이터 정리, 두 계정 교차 화면 확인, noindex 결정, 브랜드 페이지(루트 `helloblank.net`, 별도·후순위). 이후 SESSION 08 DONE → SESSION 09.
- 정식 Supabase OTP는 6자리(개발용은 8자리).

## 진행 중인 작업
SESSION 06은 `e327067`, SESSION 07 구현은 `da6fa68`까지 커밋됨(push는 사용자가 직접). 그 뒤 `createClient()`의 `io()` 추가와 문서는 별도 커밋. 변경: `src/lib/{weekly-email(.test),weekly-email-job,resend,email-consent}.ts`, `src/lib/supabase/admin.ts`, `src/app/api/cron/weekly-email/route.ts`, `src/app/actions/{settings,children}.ts`, `src/components/child-form.tsx`, `src/app/(app)/profile/page.tsx`, `supabase/tests/weekly-email.test.ts`, `vercel.json`, `package.json`, `.env.example`, `docs/handoff/*`.

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
1. (사용자) 로컬 커밋 확인 후 push.
2. (선택) 받은 메일의 `/write` 링크 → 로그인 → 작성 화면 흐름, 모바일 메일 앱 렌더링, 스팸함 분류 확인(배포 주소·도메인이 정해진 뒤에 의미가 있다).
3. 사용자 확인: 월요일 19시 발송 시각, 메일 문구·제목, 주간 질문 12주 문구·분량(시드는 2026-12-14 주까지, 베타 전 질문 추가), 챕터 문구(SESSION 06), 삭제 확인 UI·지난 기록 수정 정책(D-020).
4. **SESSION 08 — QA 및 실제 배포**: 도메인 확보(Resend 인증·Vercel 주소), 정식 Supabase 프로젝트(마이그레이션 3개·시드·SMTP·템플릿·Site URL), Vercel 배포(환경 변수 7개, `CRON_SECRET`, Cron 동작·UTC 해석 확인), 통합·보안·모바일·접근성 점검.

## 다음 작업 관련 파일
- `docs/handoff/DECISIONS.md` (D-017, D-022), `SETUP.md`(환경 변수·Cron), `sessions/SESSION_07.md`(미검증 목록)
- `src/lib/weekly-email-job.ts`, `src/lib/resend.ts`, `supabase/tests/weekly-email.test.ts`, `vercel.json`

