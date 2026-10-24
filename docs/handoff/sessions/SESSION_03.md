# SESSION 03

## 1. 세션 목표
부모 인증: 이메일 패스워드리스, 세션 유지, 로그아웃, 보호 라우트, 안전한 리다이렉트. 완료 기준: 인증 전후 흐름과 만료된 링크를 검증한다.

## 2. 시작 당시 프로젝트 상태
SESSION 02까지 커밋(`279a016 phase2 문서 갱신`), 작업 트리 clean. `CURRENT_STATE.md`는 종료 문서가 미커밋이라고 적었지만 실제로는 이미 커밋돼 있었다(코드 기준으로 보고). `src/lib/supabase/`는 `.gitkeep`뿐, `proxy.ts`·로그인 라우트 없음. 다른 채팅의 `next dev`(PID 5312)가 3000 포트를 쓰고 있어 종료하지 않고, 이 세션은 프로덕션 서버를 **3100 포트**(`.claude/launch.json`의 `prod-3100`)로 띄워 확인했다.

## 3. 사용자 결정 (진행 중 확인)
- 인증 방식: 처음에 매직 링크로 정했다가, **6자리 일회용 코드**로 확정(4자리 제안은 거부 — 경우의 수 1만 개로 약하고 Supabase 최소 길이는 6으로 알고 있으나 공식 문서로 확인하지 못함). → D-016.
- Supabase 기본 메일 발송에서는 템플릿 수정이 막혀 있어 **Resend SMTP 연결**을 선택. 도메인은 아직 없음. 연결·템플릿 수정은 사용자가 대시보드에서 직접 했다. → D-017.
- 사용자가 장기 계획(웹 → PWA → 네이티브 앱: 사진·공유·오디오)을 밝혀 개발 원칙을 기록. → D-015, `PROJECT_BRIEF.md`.
- 수익 모델 아이디어(제작 부문 유료, 구독 시 일부 무료 부여)는 논의만 했고 **결정·기록하지 않았다** (CURRENT_STATE의 열린 질문 참고).
- git 커밋·푸시는 사용자가 직접 한다.

## 4. 수행한 작업
1. 문서 확인: Next 인증 가이드(`authentication.md`, `authentication-with-cache-components.md`), `proxy.md`, 설치된 `@supabase/ssr` README와 `@supabase/auth-js` 타입. (Supabase 공식 사이트 문서는 요청 1회가 중단, 1회는 404여서 **읽지 못했다** — 설치된 패키지의 타입·README를 근거로 삼았다.)
2. `@supabase/ssr@0.12.7` 설치.
3. 서버 Supabase 클라이언트(`createServerClient`, 쿠키 세션), `requireUser()`(서버에서 `getUser()` 검증), `safeNextPath()`(허용 목록 기반 open redirect 방지).
4. 서버 액션 `submitLogin`(intent: send/verify/resend/change): `signInWithOtp` → `verifyOtp(type: "email")` → `parent_settings` upsert(ignoreDuplicates) → 검증된 경로로 redirect. 이메일/코드 형식 검증, 오류 코드별 안내 문구.
5. `/login` 페이지 + 2단계 폼(`useActionState`, 중복 제출 방지, 레이블·aria-live·`autocomplete="one-time-code"`).
6. `src/proxy.ts`: 세션 쿠키 갱신 + `getClaims()`로 낙관적 차단. 비로그인이 `/home·/write·/archive/*·/profile`에 오면 `/login?next=`, 로그인 상태에서 `/login`이면 `/home`.
7. `(app)/layout.tsx`: `Suspense` 안의 `AuthGate`가 `requireUser()`로 서버 재검증. 프로필: 로그인 이메일 표시 + 로그아웃 서버 액션. 소개 페이지의 CTA를 `/login`으로 연결.
8. 테스트 중 발견한 `code-verifier` 쿠키 누적을 고침(발송 전·로그인 후 정리).
9. Resend SMTP 연결 후 실제 메일로 로그인 흐름 검증.

## 5. 생성 및 수정한 파일
- 생성: `src/proxy.ts`, `src/lib/auth.ts`, `src/lib/supabase/env.ts`, `src/lib/supabase/server.ts`, `src/app/actions/auth.ts`, `src/app/(public)/login/page.tsx`, `src/components/login-form.tsx`
- 수정: `src/app/(app)/layout.tsx`, `src/app/(app)/profile/page.tsx`, `src/app/(public)/page.tsx`, `package.json`/`package-lock.json`(`@supabase/ssr`), `.claude/launch.json`(`prod-3100`), `docs/handoff/*`
- 삭제: `src/lib/supabase/.gitkeep`
- 환경(Git 제외): 변경 없음. Supabase 대시보드에서 사용자가 SMTP·메일 템플릿 설정(코드 아님).

## 6. 핵심 구현 및 설계 결정
`DECISIONS.md` D-015 ~ D-018 참고.
- 코드 확인은 서버 액션에서 하므로 `/auth/callback`·`/auth/expired` 라우트를 **만들지 않았다**. 만료·오류는 폼 안의 안내 + "코드 다시 받기"로 처리.
- 코드 길이는 Supabase 대시보드 설정값이다(이 프로젝트는 **8자리**를 발급). 앱은 6~10자리 숫자를 받는다.
- 세션 확인 이중화: proxy(낙관적) + 서버 `getUser()` + RLS. 단, `(app)` 레이아웃의 게이트만으로 데이터를 보호하지 않는다 — **실제 데이터를 읽는 서버 코드는 각자 `requireUser()`를 호출**해야 한다.
- 오류 로그에는 오류 코드만 남기고 이메일·코드 값은 남기지 않는다.

## 7. 실행한 테스트와 결과
| 항목 | 결과 |
|---|---|
| `npm run typecheck`, `lint`, `build` (종료 시점) | 통과 |
| 비로그인으로 `/home·/write·/archive·/archive/chapters/1m·/profile` 접근 | 307 → `/login?next=…` (경로·쿼리 보존) |
| 잘못된 이메일 형식 / `example.com` / 너무 잦은 요청 | 각각 안내 문구 표시 (`email_address_invalid`, `over_email_send_rate_limit` 로그 확인) |
| 실제 메일(Resend SMTP) 코드 발송·재발송 | 성공, 제목·숫자 코드 수신 |
| 코드 입력 → `/archive`에서 시작한 로그인 | 로그인 후 `/archive`로 복귀 |
| `next` 없이 로그인 | `/home` |
| 로그인 상태에서 `/login` | `/home`으로 이동 |
| 틀린 코드(`otp_expired`) / 너무 짧은 코드 | 각각 오류 문구, 이후 올바른 코드로 로그인 가능 |
| 프로필 | 로그인 이메일 표시 |
| 로그아웃 | 쿠키 삭제, 이후 보호 라우트 차단 |
| 로그인 후 쿠키 | `sb-…-auth-token` 하나만 남음 (code-verifier 정리 확인) |
| `parent_settings` | 로그인 후 `email_consent=false` 행 생성 확인 (service role로 읽기) |

자동화 테스트 코드는 없다(수동·브라우저 검증). 시험용 임시 사용자(`auth-e2e-session03@example.com`)와 토큰 파일은 삭제했고, 남은 사용자는 사용자 본인 계정 1개.

## 8. 발견한 오류와 해결 내역
- **기본 메일 발송은 템플릿 수정 불가**(대시보드 안내) → 코드가 담긴 메일을 못 보냄 → Resend SMTP 연결(D-017).
- **저장한 템플릿이 몇 분간 적용되지 않음**: 저장 직후 3번 발송은 모두 옛 템플릿(링크만)이었고, 시간이 지난 뒤 발송에서 반영됐다. 로컬 서버 재시작과 무관해 보이나 정확한 반영 시간은 확인하지 못했다.
- **발급 코드가 8자리**: 앱이 6자리만 받으면 로그인이 막힐 뻔 → 6~10자리 허용.
- **`code-verifier` 쿠키 누적**: `signInWithOtp`가 PKCE 쿠키를 발송마다 남김 → 정리 추가.
- 처음 가짜 주소(`example.com`) 발송 시 `email_address_invalid`: Supabase가 예약 도메인을 거부. 앱 문제 아님, 안내 문구만 보강.
- 임시 사용자의 세션 토큰을 브라우저로 옮기려던 시도는 보안 검사에서 차단돼 중단했다(우회하지 않음). 실제 메일 시험으로 대체.

## 9. 미완료 작업 및 이유
- **새 이메일 가입 경로(Confirm sign up 템플릿) 미검증**: Resend 시험 단계에서는 본인 이메일에만 발송할 수 있어 새 주소로 못 해봤다. 도메인 연결 후 SESSION 08 QA에서 확인.
- 며칠 뒤 세션 유지·만료 후 갱신, Safari·아이폰·메일 앱 내장 브라우저, 발송 한도(시간당 수치) 미확인.
- 화면은 여전히 목 데이터(로그인 이메일 표시만 실제). 자녀 연동은 SESSION 04.
- 소개 페이지(`/`)는 정적이라 로그인 상태 분기를 하지 않는다(`/login`에서 proxy가 `/home`으로 보냄).
- 코드는 아직 커밋되지 않았다(사용자가 직접 커밋·푸시).

## 10. 다음 세션 인계
SESSION 04 자녀 프로필: 온보딩(`/onboarding`) + `children` 연동. 로그인한 부모가 자기 자녀만 보게 서버 코드에서 `requireUser()` 후 조회(RLS와 이중). 자녀 1명 제한은 앱 로직(D-013). 목 데이터 `mockChild`를 실제 데이터로 교체. 시작 전: 로그인 상태에서 새 사용자가 첫 방문 시 `/onboarding`으로 보내는 규칙을 정한다(자녀가 없으면 `/home`에서 이동). Resend는 현재 본인 이메일만 가능하므로 다른 사람을 초대하는 시험은 도메인 연결 뒤에.
