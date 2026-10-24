# SESSION HISTORY

시간순 누적 기록. 기존 항목은 삭제·덮어쓰기 하지 않고 아래에 추가한다.

---

## 2026-10-24 · SESSION 00 · 프로젝트 초기화 및 설계 — DONE
- 시작 상태: 폴더에 학습용 HTML/CSS/JS, `PROJECT_CONTEXT.md`, 기존 `AGENTS.md`, `mvp/`(Next.js 16.4.2 기반 프로토타입)가 있었다. 분석 결과 `mvp/`의 `tsc`와 테스트 8개는 통과했으나 지침의 스택·구조(Tailwind, 라우트 분리, SSR 세션, 매직 링크, 생년월일, 수정일)와 달랐다. 분석 중 사용자가 모든 기존 파일을 삭제하고 처음부터 새로 생성하도록 지시했다 (D-001).
- 수행: `create-next-app@16.4.3`로 새 프로젝트 생성, 루트에 배치 후 `npm ci`. 임시 홈 화면, 브랜드 토큰, 폴더 구조, `.env.example`, `.gitignore` 수정(`!.env.example`), `typecheck` 스크립트(`next typegen && tsc --noEmit`), `.claude/launch.json`.
- 문서: `CLAUDE.md`, `docs/handoff/` (PROJECT_BRIEF, ROADMAP, ARCHITECTURE, CURRENT_STATE, DECISIONS, SETUP, SESSION_HISTORY, sessions/SESSION_00).
- 테스트 결과: typecheck 통과, lint 통과, `next build` 통과, `npm run dev` 실행 후 `/` 정상 렌더링 및 콘솔 오류 없음. 자동화 테스트 코드는 아직 없음.
- 발견: 빈 상태에서 `tsc`만 실행하면 `LayoutProps` 타입이 없어 실패 → `typecheck`에 `next typegen`을 포함해 해결.
- 완료 여부: 완료. 사용자가 "세션 종료"를 지시했고, 종료 시점에 typecheck·lint·build를 다시 실행해 통과를 확인했다. 이후 로컬 커밋 완료 (원격 없음, push는 사용자가 직접 수행).

---

## 2026-10-24 · SESSION 01 · UI/UX 구현 (목 데이터) — DONE
- 시작 상태: SESSION 00 커밋 상태, 작업 트리 clean. 인수인계 문서와 코드 일치 확인.
- 수행: `(public)`/`(app)` 라우트 그룹, 하단 탭(모바일)·상단 바(데스크톱) 내비게이션, 홈, 이번 주 질문·기록 작성(저장 중/완료/오류, 글자 수, 중복 제출 방지), 아카이브 타임라인·상세·1m/3m/1y 묶음, 프로필(읽기 전용), 로딩·오류·빈·not-found 상태, 목 데이터와 KST 날짜 유틸.
- 테스트: typecheck·lint·build 통과. 375px/데스크톱 브라우저에서 주요 화면 확인, 콘솔 오류 없음. 자동화 테스트 없음. `?fail=1` 저장 실패 상태 확인. 접근성·실기기는 미검증.
- 특이사항: 다른 채팅의 dev 서버(PID 1841)가 3000 포트를 사용 중이라 그 서버로 확인했다.
- 후속(같은 날): 사용자 피드백("Claude Code 느낌이 강함", 기본 파비콘)에 따라 디자인 전면 개편, 새 파비콘, dev 인디케이터 제거 (D-008). typecheck·lint·build 통과, 브라우저 재확인.
- 후속(같은 날): "문서형 레이아웃" 피드백으로 `/home`을 인터랙티브 허브로 재구성(D-009): 바로 쓰기, 최근 8주 칸, 기간 탭, 인라인 펼침, 연속 주 수. typecheck·lint·build 통과, 브라우저 조작으로 주요 흐름 확인.
- 후속(같은 날): 내비게이션을 상단 고정으로 이동(D-010).
- 후속(같은 날): 메뉴 이동 애니메이션(방향 슬라이드, 밑줄 이동) 추가 (D-011). typecheck·lint·build 통과, 프로덕션 서버에서 전환 타입·애니메이션 실행 확인.
- 후속(같은 날): 홈의 검은 질문 블록을 살구빛으로 교체, 색 사용 원칙 정리 (D-012).
- 완료 여부: 완료. 사용자가 "이번 세션 마무리하자"고 지시했고 종료 시점에 typecheck·lint·build를 다시 실행해 통과를 확인했다. 아직 로컬 커밋하지 않았다. 미검증 항목(접근성·실기기·Safari·빈 상태 화면 등)은 `CURRENT_STATE.md` 참고. 상세는 `sessions/SESSION_01.md`.

---

## 2026-10-24 · SESSION 02 · Supabase 데이터베이스 — DONE
- 시작 상태: SESSION 01을 사용자가 직접 커밋(`e1aab35`), 작업 트리 clean. `CURRENT_STATE.md`의 "미커밋" 서술은 낡은 것으로 확인. Supabase CLI·Docker 없음. 사용자 결정: 개발용 원격 Supabase 프로젝트 + SQL Editor 적용, 생년월일은 연·월·일 전체 (D-013).
- 수행: 테이블 5개·인덱스·트리거·RLS·컬럼 단위 GRANT 마이그레이션, 주간 질문 시드 12주(초안), `@supabase/supabase-js` 설치, 손으로 쓴 `src/types/database.ts`, 교차 접근 테스트(`npm run test:rls`). 사용자가 Supabase 프로젝트 생성·`.env.local` 작성·SQL 실행을 직접 했고, `.env.local`의 URL(대시보드 주소 → API 주소)을 점검·수정했다.
- 테스트: 1차 24/25 통과 → 줄바꿈만 있는 본문이 CHECK를 통과하는 버그 발견(`btrim`은 스페이스만 제거) → 보정 마이그레이션(D-014) 적용 후 **25/25 통과**. 테스트 데이터 잔여 없음 확인. typecheck·lint·build 통과.
- 범위 밖으로 둔 것: 화면의 목 데이터 교체(로그인 필요 → SESSION 03 이후), "이번 주 질문만 기록 가능" 규칙(SESSION 05), 자녀 1명 제한(SESSION 04), parent_settings 자동 생성.
- 특이사항: 다른 채팅의 `next dev`(PID 5312)가 3000 포트에 떠 있어 서버를 새로 띄우지 않았고 종료하지도 않았다 (변경이 화면과 무관).
- 완료 여부: 완료. 사용자가 "세션 종료"를 지시했다. 코드는 사용자가 `7d19b7d phase 2 end`로 커밋했고, 종료 문서 갱신분은 미커밋. 상세는 `sessions/SESSION_02.md`.

---

## 2026-10-24 · SESSION 03 · 부모 인증 — DONE
- 시작 상태: SESSION 02 문서까지 커밋(`279a016`), 작업 트리 clean. 문서와 코드 일치 확인(다만 CURRENT_STATE의 "문서 미커밋" 서술은 낡음). 다른 채팅의 `next dev`(PID 5312)가 3000 포트 사용 중 → 종료하지 않고 3100 포트 프로덕션 서버로 확인.
- 사용자 결정: 인증은 **6자리 일회용 코드**(매직 링크로 정했다가 변경, 4자리는 보안상 거부) (D-016). Supabase 기본 메일 발송은 템플릿 수정 불가라 **Resend SMTP 연결**(도메인 없음) (D-017). 장기 방향(웹 → PWA → 앱) 기록 (D-015).
- 수행: `@supabase/ssr` 설치, 서버 클라이언트·`requireUser`·`safeNextPath`, 코드 로그인 서버 액션(발송·확인·재발송·이메일 변경), `/login` 2단계 폼, `proxy.ts` 보호 라우트, `(app)` 레이아웃 서버 재검증, 프로필 로그아웃·이메일 표시, 소개 페이지 CTA, `code-verifier` 쿠키 정리, `parent_settings` upsert.
- 테스트: typecheck·lint·build 통과. 실제 메일(Resend)로 코드 수신·로그인·`next` 복귀·로그아웃·보호 라우트 차단·틀린 코드 안내 확인 (상세 `sessions/SESSION_03.md`). 자동화 테스트 없음.
- 발견: Supabase가 이 프로젝트에서 **8자리** 코드를 발급(앱은 6~10자리 허용), 템플릿 저장 후 몇 분간 옛 템플릿으로 발송됨, `code-verifier` 쿠키 누적(수정).
- 범위 밖/미검증: 새 이메일 가입 경로(Confirm sign up 템플릿), 장기 세션 유지, Safari·모바일 실기기. `/auth/callback`·`/auth/expired`는 코드 방식이라 만들지 않았다.
- 완료 여부: 완료. 사용자가 "마무리 준비"를 지시했고 커밋·푸시는 사용자가 직접 한다. 코드·문서 미커밋 상태로 인계.
