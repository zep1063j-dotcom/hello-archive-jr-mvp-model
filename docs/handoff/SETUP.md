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
환경 변수 없이도 현재(SESSION 00) 화면은 실행된다. Supabase를 연결하는 SESSION 02부터 `.env.local`이 필요하다.

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
| `NEXT_PUBLIC_APP_URL` | 공개 | 03, 07 | 인증 리다이렉트·이메일 링크 기준 주소 |
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

## 배포 (SESSION 08에서 작성)
Vercel 예정. 아직 배포하지 않았다.

## 브라우저 미리보기 (Claude Code 데스크톱)
`.claude/launch.json`의 `dev` 구성(npm run dev, 포트 3000)으로 미리보기를 시작할 수 있다.
