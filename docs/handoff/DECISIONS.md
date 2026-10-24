# DECISIONS

최신 결정을 아래에 추가한다. 기존 항목은 삭제하지 않고, 번복 시 새 항목에서 이전 항목을 참조한다.

## D-001 · 2026-10-24 · 프로젝트를 빈 폴더에서 새로 시작
- 결정: 이 폴더(`Hello_Archive jr`)를 프로젝트 루트로 삼아 Next.js를 새로 생성한다.
- 배경: SESSION 00 시작 시 폴더에는 학습용 HTML/CSS/JS, `PROJECT_CONTEXT.md`, `AGENTS.md`, 그리고 Next.js 16.4.2 기반 `mvp/`(단일 클라이언트 컴포넌트, 순수 CSS, 일회용 코드 인증, 체험 모드, 태어난 달만 저장)가 있었다. 분석 중 사용자가 "다 지웠어 처음부터 새로 생성해"라고 지시했고, 폴더가 비어 있음을 확인한 뒤 새로 시작했다.
- 선택 이유: 지침의 스택(Tailwind, App Router 라우트 구조, 세션 순서)에 맞춰 깨끗하게 시작.
- 고려한 대안: 기존 `mvp/` 확장 (사용자가 삭제하여 불가).
- 영향: 이전 `mvp/`의 구현(한국 시간 주차 계산, RLS 스키마 아이디어)은 코드로 남아 있지 않다. 필요한 로직은 해당 세션에서 다시 작성하고 테스트한다. 이전 `PROJECT_CONTEXT.md`의 Meta 광고·인터뷰 계획 등 맥락은 사라졌으므로 `PROJECT_BRIEF.md`에는 확인된 요약만 담았다.

## D-002 · 2026-10-24 · Next.js 16.4.3 + 스캐폴드 기본 설정 유지
- 결정: `create-next-app@16.4.3` (TypeScript, Tailwind v4, ESLint, App Router, `src/`, Turbopack, npm, React Compiler 미사용). 의존성은 `package-lock.json`으로 고정.
- 스캐폴드 기본값으로 `next.config.ts`에 `cacheComponents: true`, `partialPrefetching: true`가 켜져 있다. 임의로 끄지 않았다.
- 영향: Cache Components에서는 쿠키·세션처럼 요청 시점 데이터를 읽는 컴포넌트에 `<Suspense>` 경계가 필요할 수 있다. **SESSION 03(인증)에서 공식 문서(`node_modules/next/dist/docs`)로 호환성을 확인**하고, 방해가 되면 이 설정을 끄는 결정을 새 항목으로 남긴다.
- `middleware`는 이 버전에서 `proxy.ts`로 이름이 바뀌었다. 보호 라우트는 `src/proxy.ts`로 구현한다 (SESSION 03). proxy는 낙관적 차단용이고 최종 권한 검증은 서버 코드·RLS에서 한다.

## D-003 · 2026-10-24 · 프로젝트 이름과 폴더명
- 폴더명 `Hello_Archive jr`는 공백·대문자 때문에 npm 패키지명으로 쓸 수 없어, 임시 위치에서 `hello-archive-jr`로 생성한 뒤 루트로 복사하고 `npm ci`로 설치했다. 폴더명은 바꾸지 않았다.

## D-004 · 2026-10-24 · 한국어 폰트는 시스템 폰트 스택
- 결정: 외부 웹폰트 없이 시스템 한글 폰트 스택 사용 (스캐폴드의 Geist는 한글 미지원이라 제거).
- 이유: 로딩 속도·외부 요청 최소화. 디자인 요구가 생기면 SESSION 01에서 재검토.

## D-005 · 2026-10-24 · 데이터 모델 초안 (상세는 ARCHITECTURE.md)
- 주간 질문은 `weekly_questions(week_start unique)` 단일 테이블 시드. 모든 부모가 같은 주에 같은 질문.
- 기록 중복 방지: `entries unique(child_id, weekly_question_id)`. 주 1회 한 개 기록이 원칙이므로 같은 주 재작성은 수정으로 처리.
- 소유권: `entries`와 `children` 복합 FK `(child_id, user_id)`.
- 자녀는 테이블상 다중 허용, MVP UI/로직은 1명.
- 생년월일은 `birth_date`(date) 저장 (지침의 "생년월일"). 개인정보 최소화 관점에서 월 단위만 받을지는 미결정.
- 상태: **설계안**. SESSION 02에서 구현·검증하며 확정한다.

## D-006 · 2026-10-24 · 인증 방식은 미확정
- 매직 링크 vs 일회용 코드 중 어느 쪽인지는 SESSION 03에서 결정한다. 확정된 것은 "주간 안내 링크에는 로그인 토큰을 넣지 않는다"는 원칙뿐이다.
