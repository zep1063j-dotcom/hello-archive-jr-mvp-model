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
npm run test:rls   # DB 교차 접근 테스트 (.env.local + 개발용 Supabase 필요, SESSION 02~)
```

## 환경 변수 (이름만 — `.env.example` 참고)
| 이름 | 공개 여부 | 사용 세션 | 설명 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 | 02~ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개(RLS로 보호) | 02~ | publishable(anon) 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버 전용** | 07 | RLS 우회 가능. 절대 클라이언트·저장소에 노출 금지 |
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
4. 코드 길이는 Authentication → Sign In / Providers → Email의 OTP 길이 설정이다(이 프로젝트는 8자리). 앱은 6~10자리를 받는다.
5. 저장 후 **몇 분간은 옛 템플릿으로 발송될 수 있다**. 제목이 `Your sign-in link`(링크만)이면 시간이 지난 뒤 다시 시험한다.
6. **도메인이 없으면 Resend 가입 이메일에만 발송**된다. 베타 전에 도메인을 구해 Resend에서 인증하고 발신 주소를 바꾼다. 정식(베타용) Supabase 프로젝트에도 2~4번을 다시 한다.
7. 확인: 로그인 화면(`/login`)에서 본인 이메일로 코드를 받아 로그인하고 `/profile`에서 로그아웃. 같은 주소로는 1분에 한 번만 보낼 수 있다.

## 배포 (SESSION 08에서 작성)
Vercel 예정. 아직 배포하지 않았다.

## 브라우저 미리보기 (Claude Code 데스크톱)
`.claude/launch.json`의 `dev`(npm run dev, 포트 3000) 또는 `prod-3100`(npm run start -p 3100, 먼저 `npm run build`)으로 미리보기를 시작할 수 있다. 다른 채팅의 dev 서버가 3000 포트를 쓰고 있으면 `prod-3100`을 쓴다.
