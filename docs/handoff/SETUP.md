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

## 검증 명령
```bash
npm run typecheck  # next typegen && tsc --noEmit
npm run lint
npm run build
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

## 데이터베이스 (SESSION 02에서 작성)
아직 없음. 마이그레이션은 `supabase/migrations/`, 시드는 `supabase/seed/`.

## 배포 (SESSION 08에서 작성)
Vercel 예정. 아직 배포하지 않았다.

## 브라우저 미리보기 (Claude Code 데스크톱)
`.claude/launch.json`의 `dev` 구성(npm run dev, 포트 3000)으로 미리보기를 시작할 수 있다.
