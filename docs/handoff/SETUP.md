# SETUP

비밀키의 실제 값은 이 문서에 쓰지 않는다.

## 요구 사항
- Node.js 20.9 이상 (SESSION 00 확인 환경: Node v24.21.0, npm 11.19.0)
- Git

## 로컬 실행
```bash
npm ci
npm run dev        # http://localhost:3000
```
SESSION 03부터 `(app)` 화면은 로그인이 필요해서 `.env.local`(Supabase)과 아래 "인증 메일(SMTP)" 설정이 필요하다. 이 설정이 없으면 `/login`에서 코드를 받을 수 없다.

> `next build`는 Google Fonts(Noto Serif KR)를 내려받으므로 네트워크가 필요하다 (D-008).

## 검증 명령
```bash
npm run typecheck  # next typegen && tsc --noEmit
npm run lint
npm run build
npm run test:unit  # 순수 로직 단위 테스트 (DB 불필요, SESSION 04~)
npm run test:rls   # DB 교차 접근 테스트 (.env.local + 개발용 Supabase 필요, SESSION 02~)
npm run test:children  # 자녀 프로필 앱 쿼리·동시 등록 테스트 (개발용 Supabase, 마이그레이션 3개 적용 필요)
npm run test:entries   # 기록 앱 쿼리·두 계정 교차·동시 insert (개발용 Supabase)
npm run test:weekly-email  # 주간 이메일 발송 작업(가짜 발송기, 실제 메일 없음)·수신 동의 (개발용 Supabase)
```

## 환경 변수 (이름만 — `.env.example` 참고)
| 이름 | 공개 여부 | 사용 세션 | 설명 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 | 02~ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개(RLS로 보호) | 02~ | publishable(anon) 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버 전용** | 07(예약 실행), 테스트 | RLS 우회 가능. 절대 클라이언트·저장소에 노출 금지 |
| `NEXT_PUBLIC_APP_URL` | 공개 | 07 | 이메일 링크 기준 주소. 코드 방식 로그인(SESSION 03)은 쓰지 않는다 |
| `RESEND_API_KEY` | **서버 전용** | 07 | 이메일 발송 |
| `EMAIL_FROM` | 서버 | 07 | 발신 주소 (도메인 인증 필요) |
| `CRON_SECRET` | **서버 전용** | 07 | 예약 실행 엔드포인트 보호 |

`.env*`는 Git에서 제외되고 `.env.example`만 추적된다.

## 데이터베이스 (SESSION 02)
**개발용 원격 Supabase 프로젝트**를 쓴다 (D-013). 실서비스(베타) 프로젝트와 반드시 분리한다. 이 PC에는 Supabase CLI·Docker가 없어 SQL Editor로 적용한다.

1. Supabase 대시보드에서 개발용 프로젝트를 만든다. 리전은 한국 사용자 기준 가까운 곳(예: Northeast Asia/Seoul).
2. `.env.example`을 `.env.local`로 복사하고 **본인이 직접** 값을 채운다 (채팅에 붙여넣지 않는다):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — 대시보드 Project Settings → API Keys
   - `SUPABASE_SERVICE_ROLE_KEY` (secret key) — 같은 곳. 지금은 RLS 테스트가 임시 사용자를 만들 때만 쓴다.
3. SQL Editor에서 순서대로 실행:
   1. `supabase/migrations/20261024000000_initial_schema.sql`
   2. `supabase/migrations/20261024000100_fix_blank_text_checks.sql` (공백 검사 보강)
   3. `supabase/migrations/20261024000200_children_one_per_parent.sql` (부모당 자녀 1명, SESSION 04)
   3. `supabase/seed/weekly_questions.sql` (질문 문구는 초안)
4. 검증: `npm run test:rls` — 임시 사용자 2명을 만들어 교차 접근·권한·제약·삭제 전파를 확인하고 모두 지운다. **개발용 프로젝트에서만 실행한다.**

마이그레이션을 고치면 같은 SQL을 반영하고 `src/types/database.ts`(손으로 작성한 타입)도 같이 고친다. 나중에 CLI를 쓰게 되면 `supabase gen types typescript`로 대체할 수 있다.

> 주의: 같은 SQL을 두 번 실행하면 `already exists` 오류가 난다. 다시 적용해야 하면 개발용 프로젝트에서만 테이블을 지우고 처음부터 다시 실행한다.

## 인증 메일 설정 (SESSION 03) — 대시보드에서 사용자가 직접
로그인은 메일로 받은 **숫자 코드**를 입력하는 방식이다 (D-016). Supabase 기본 메일 발송은 템플릿을 고칠 수 없어 코드가 오지 않으므로 커스텀 SMTP가 필요하다 (D-017).
1. Resend에서 계정을 만들고 **API 키**를 만든다 (발송 권한). 키는 채팅·코드에 붙여넣지 않는다.
2. Supabase → Authentication → Emails → **SMTP Settings**에서 Custom SMTP를 켠다. Host `smtp.resend.com`, Port `465`, Username `resend`, Password = 1번 API 키, 발신 주소와 이름(도메인 없이는 `onboarding@resend.dev`, 이름 `Hello Archive jr`). 값은 Resend 문서·화면 안내를 따른다.
3. **Templates** 탭에서 **"Magic link or OTP"**와 **"Confirm sign up"** 두 템플릿의 제목·본문을 코드 형태로 바꿔 저장한다. 본문에 `{{ .Token }}`이 반드시 있어야 하고 `{{ .ConfirmationURL }}` 링크는 넣지 않는다.
   ```html
   <h2>Hello Archive jr 로그인 코드</h2>
   <p>아래 코드를 로그인 화면에 입력해 주세요.</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>이 코드는 잠시 후 만료돼요. 본인이 요청하지 않았다면 이 메일은 무시하셔도 돼요.</p>
   ```
4. 코드 길이는 Authentication → Sign In / Providers → Email의 OTP 길이 설정이다(개발용 프로젝트는 8자리, 정식 프로젝트는 6자리). 앱은 6~10자리를 받는다.
5. 저장 후 **몇 분간은 옛 템플릿으로 발송될 수 있다**. 제목이 `Your sign-in link`(링크만)이면 시간이 지난 뒤 다시 시험한다.
6. **도메인이 없으면 Resend 가입 이메일에만 발송**된다. 베타 전에 도메인을 구해 Resend에서 인증하고 발신 주소를 바꾼다. 정식(베타용) Supabase 프로젝트에도 2~4번을 다시 한다.
7. 확인: 로그인 화면(`/login`)에서 본인 이메일로 코드를 받아 로그인하고 `/profile`에서 로그아웃. 같은 주소로는 1분에 한 번만 보낼 수 있다.

## 주간 이메일 (SESSION 07) — 정책은 D-022
- **발송**: 전원 월요일 19:00 KST, 수신 동의자만, 가입·동의가 그 주 월요일 19시 이후면 다음 월요일부터. 이번 주 이미 기록한 부모는 건너뜀.
- **필요한 값(사용자가 `.env.local`에 직접 입력, 채팅에 붙이지 않는다)**: `RESEND_API_KEY`(Resend에서 발송 권한 키), `EMAIL_FROM`(발신 주소. 도메인 인증 전에는 Resend 테스트 발신 주소이고 Resend 가입 이메일에만 발송됨), `CRON_SECRET`(긴 무작위 문자열), `NEXT_PUBLIC_APP_URL`(메일 링크 기준 주소). 인증 메일용 SMTP 설정(위)과는 별개다.
- **로컬에서 크론 라우트 호출**: 서버를 띄운 뒤 `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/weekly-email` (헤더가 없거나 틀리면 401, 응답은 집계 숫자만). 월요일 19:00 이전에는 `too_early`, 동의가 이번 주 월요일 19시 이후면 대상이 아니다. `next dev`는 크론을 실행하지 않으므로 직접 호출한다.
- **Vercel Cron**: `vercel.json`의 `0 10 * * 1,2`(UTC 기준 월·화 10:00 = 한국 19:00, 화요일은 누락·실패 보충). Vercel 문서(2026-10 조회): Hobby는 하루 1회까지, 지정한 시 안의 임의 시각(19:00~19:59), 실패해도 재시도 없음, 드물게 누락·중복 실행. 배포 후 UTC 해석과 `CRON_SECRET` 동작을 확인해야 한다(미검증). Vercel 프로젝트에 `CRON_SECRET`을 같은 이름으로 등록한다.
- 발송 이력은 DB `email_deliveries`(status·attempts·error_code)에 남는다 (service role만 접근).

## 배포 (SESSION 08, 체크리스트 — 아직 배포하지 않았다)
Vercel 예정. 아래는 순서이며 각 항목은 실행 후 결과를 SESSION_08.md에 기록한다.
1. **정식 Supabase 프로젝트 생성**(개발용과 분리, 서울 리전). SQL Editor에서 마이그레이션 3개 → 시드 순으로 실행. 시드 질문은 베타 기간만큼 늘린다(현재 2026-12-14 주까지).
2. 정식 프로젝트에 인증 메일 설정 반복(위 "인증 메일 설정" 2~4번): Resend SMTP, 템플릿 2개(`{{ .Token }}`), OTP 길이. Authentication → URL Configuration의 Site URL을 배포 주소로.
3. **도메인**을 Resend에서 인증하고 `EMAIL_FROM`을 그 도메인 주소로, Supabase SMTP 발신 주소도 같이 변경.
4. **Vercel 프로젝트** 생성(GitHub `origin` 연결, push는 사용자가 직접). 환경 변수 7개 등록: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`(HTTPS 주소), `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`(새로 만든 긴 무작위 값). 정식 프로젝트 키를 쓰고 개발용 키와 섞지 않는다.
5. 배포 후 스모크: `/` 200 → `/home` 비로그인 시 `/login` → 새 이메일로 코드 로그인(가입 경로) → 온보딩 → 기록 저장·수정·삭제 → 아카이브 → 수신 동의 켜기/끄기 → 로그아웃. 응답 헤더(보안 헤더) 확인.
6. **Cron 확인**: Vercel 대시보드의 Cron Jobs에서 `0 10 * * 1,2`(UTC) 등록 확인, 가능하면 수동 실행 후 `email_deliveries`·응답 집계 확인. `CRON_SECRET` Bearer가 맞는지(401이면 변수 이름·값 불일치).
7. 두 계정으로 서로의 기록이 안 보이는지 앱 화면에서 확인(Resend 도메인 인증 후 가능).

### 배포 실제 값 메모 (비밀 아님)
- 앱 주소 `https://archivejr.helloblank.net`, 발신 `Hello Archive jr <hello@helloblank.net>`. 공개 변수(`NEXT_PUBLIC_*`)와 `EMAIL_FROM`은 Vercel에서 Sensitive를 끈다. `NEXT_PUBLIC_*`은 빌드에 박히므로 바꾸면 Build Cache 없이 Redeploy. Supabase URL은 `https://<ref>.supabase.co`만(경로·끝 `/` 금지). 로컬 `.env.local`은 개발용 Supabase·`http://localhost:3000`을 유지한다.

## 브라우저 미리보기 (Claude Code 데스크톱)
`.claude/launch.json`의 `dev`(npm run dev, 포트 3000) 또는 `prod-3100`(npm run start -p 3100, 먼저 `npm run build`)으로 미리보기를 시작할 수 있다. 다른 채팅의 dev 서버가 3000 포트를 쓰고 있으면 `prod-3100`을 쓴다.
