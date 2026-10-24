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

## D-007 · 2026-10-24 · SESSION 01 목 데이터 UI 방식
- 결정: 화면 상태(기록 있음/이번 주 작성/빈 상태/오류)는 `?mock=default|written|empty|error` 쿼리로 바꿔 보고, 저장 오류는 `/write?fail=1`로 본다. "오늘"은 `MOCK_TODAY = 2026-10-24`로 고정한다. 저장은 800ms 지연 후 성공/실패 상태만 흉내 내며 아무것도 저장하지 않는다.
- 이유: Cache Components의 사전 렌더링에서 `new Date()` 같은 요청 시점 값을 피하고, DB 없이 모든 상태를 눈으로 확인하기 위해. 쿼리 접근은 `<Suspense>` 안에서 `await searchParams` 한다.
- 영향: `src/lib/mock-data.ts`, `?mock`/`?fail` 처리와 `(app)/layout.tsx`의 "미리보기" 안내(`MockNotice`)는 **SESSION 02~05에서 실제 데이터로 교체하며 제거**한다. `src/types/archive.ts`는 DB 타입과 맞출 화면 계약이다.
- 날짜·주차 계산은 `src/lib/date.ts` 한 곳에서 KST 기준으로 한다 (`formatKoreanDate`, `toKstDateKey`, `addMonths`, `formatAge`). 기간 묶음 필터는 목용이며 실제 경계는 SESSION 06에서 정의한다.
- 이 Next.js 버전의 `error.tsx`는 `reset`이 아니라 `retry` prop을 받는다.
- 라우트 그룹 `(public)`/`(app)` 도입 (ARCHITECTURE.md의 설계대로). 로그인·콜백·온보딩 라우트는 만들지 않았다.

## D-008 · 2026-10-24 · 디자인 방향 재정의: 에디토리얼 기록장 + 명조 웹폰트 (D-004 일부 번복)
- 계기: 사용자가 SESSION 01 화면을 "Claude Code로 만든 느낌이 너무 강하다"고 평가. 둥근 카드·알약 버튼·흰 박스·시스템 폰트 조합이 원인으로 판단했다.
- 결정: 랜딩페이지(분위기 참고용, 복제 아님)의 결을 따라 ① 둥근 모서리 대신 직각 + 가는 선(구분선) ② 질문·기록 본문은 명조(Noto Serif KR), UI 글씨는 시스템 고딕 ③ 종이색 #f7f3eb / 잉크 #111 / 레드 #d92f3e ④ 레드 점 라벨(Eyebrow), 날짜 큰 숫자 타임라인, 검정 질문 블록, 직각 레드 CTA(↗) ⑤ `h·` 로고. 토큰은 `src/app/globals.css`.
- D-004 번복: 한글 웹폰트는 `next/font/google`의 `Noto_Serif_KR`(400/600/700, `preload: false`)을 쓴다. 빌드 시 Google Fonts에서 내려받아 자체 호스팅하므로 **빌드에 네트워크가 필요**하고 런타임 외부 요청은 없다. 고딕은 여전히 시스템 폰트.
- 파비콘: 스캐폴드 기본 `favicon.ico` 삭제, `src/app/icon.svg`(검정 바탕 + 흰 h + 레드 점)로 교체. 개발 중 모서리의 "N" 아이콘은 `devIndicators: false`로 껐다 (`next.config.ts`).
- 한계: 로고·아이콘은 임시 제작이다. 브랜드 로고 원본이 있으면 교체한다. apple-touch-icon·OG 이미지는 아직 없다.

## D-009 · 2026-10-24 · 홈을 "한 화면 허브"로 재구성 (문서형 레이아웃 탈피)
- 계기: 사용자가 "문서형 레이아웃 같다. 인터랙티브하고 메인 화면에서 다 확인되면 좋겠다"고 피드백.
- 결정: `/home`을 클라이언트 허브(`src/components/home/home-hub.tsx`)로 바꿨다. 한 화면에서 ① 아이 헤더 + 연속 기록 주 수 ② 이번 주 질문 카드에서 **바로 쓰기/수정**(접힘→작성→저장됨) ③ 최근 8주 현황 칸(쓴 주를 누르면 아래 목록에서 그 기록이 펼쳐지고 스크롤) ④ 기간 탭(전체/1개월/3개월/1년)으로 필터되는 월별 기록 목록(항목을 누르면 그 자리에서 펼침)을 모두 한다.
- 상태: 기록은 이 화면의 React 메모리에만 있다(새로고침하면 초기화). 저장하면 연속 주 수·주차 칸·목록이 즉시 갱신된다. 실제 저장은 SESSION 05.
- 공통 로직은 `src/lib/entries.ts`(기간 필터, 월별 묶음, 최근 N주, 연속 주 수)로 분리했다. 기간 경계 정의는 여전히 SESSION 06에서 확정 (D-007).
- `/write`는 이메일 딥링크 목적지로 남겨 두고(기존 폼), 홈의 쓰기 카드와는 별개 구현이다. SESSION 05에서 하나의 폼 컴포넌트로 합칠지 정한다. `/archive`, `/archive/[entryId]`, 챕터 페이지도 그대로 있다.
- 연속 주 수는 "이번 주를 아직 안 썼으면 지난주부터" 센다 (쓰지 않았다고 0으로 깎이지 않게). 부담을 주지 않는 문구를 유지한다. 부모 반응은 베타에서 확인할 가설이다.
- 부수 수정: `/archive/[entryId]`, `/archive/chapters/[period]`가 `params`를 Suspense 밖에서 await해 dev 콘솔에 `instant-shell-url-data` 오류를 냈다. Suspense로 감싸 해결.

## D-010 · 2026-10-24 · 내비게이션을 상단 고정으로 (모바일 하단 탭 번복)
- 계기: 사용자 요청("내비게이션이 상단에 있었으면 좋겠어"). ARCHITECTURE의 "모바일 하단 내비게이션" 설계를 번복한다.
- 구현: `src/components/app-nav.tsx` — sticky 헤더. 375px에서는 로고 줄(48px) + 메뉴 4칸 줄(44px)의 2단, md 이상은 로고·메뉴 한 줄. 본문 하단 여백(탭 높이만큼)은 제거했고 목록 스크롤 오프셋은 `scroll-mt-28`.
- 영향/비용: 모바일에서 상단 약 92px를 항상 차지한다(엄지 도달성은 하단 탭이 유리). 사용성은 베타에서 확인할 가설.

## D-011 · 2026-10-24 · 화면 전환 애니메이션: React `<ViewTransition>` (라이브러리 추가 없음)
- 계기: 사용자 요청("내비게이션 이동 시 스무스한 무빙").
- 결정: React 19.3 `<ViewTransition>` + Next `<Link transitionTypes>` 사용 (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). ① `src/app/(app)/template.tsx`가 페이지를 감싸 방향 슬라이드(`nav-forward`/`nav-back`, 350ms) ② 메뉴 빨간 밑줄은 `name="nav-indicator"`로 선택한 메뉴로 미끄러져 이동 ③ 방향: 메뉴 순서(홈→기록 쓰기→아카이브→프로필)상 오른쪽이면 forward, 왼쪽이면 back. 목록→상세·기간 묶음은 forward, "← 아카이브"는 back ④ `prefers-reduced-motion`이면 애니메이션 끔. CSS는 `globals.css` 하단.
- 레이아웃이 아닌 `template.tsx`를 쓴 이유: 레이아웃은 이동 시 유지되어 enter/exit가 실행되지 않는다. 템플릿은 이동마다 새로 만들어진다 (동작 확인함).
- 타입: ViewTransition 타입은 `react/experimental` 선언에 있어 `src/types/react-experimental.d.ts`로 참조.
- 한계: 브라우저 View Transitions 지원이 필요하다(미지원이면 애니메이션 없이 정상 이동). 브라우저 뒤로가기 버튼은 방향 타입이 없어 슬라이드되지 않는다. 홈 허브의 탭 전환·펼침은 라우트 이동이 아니라 이 효과 대상이 아니다.

## D-012 · 2026-10-24 · 홈의 검은 블록을 살구빛으로 (색 사용 원칙)
- 계기: 사용자 피드백("검은색이라 너무 튄다. 부드럽고 잘 어울리는 색으로").
- 결정: 큰 면적에는 검정을 쓰지 않는다. 검정은 글씨와 가는 선에만, 큰 면은 종이색(`--paper`)·살구빛(`--blush #f6e5da`, 테두리 `--blush-deep #ecd0c0`)을 쓴다. 레드는 버튼·체크·선택 표시 같은 포인트에만 쓰고, 버튼 호버는 검정이 아니라 진한 레드(`--brand-deep #b32432`). 홈의 이번 주 질문 카드, 연속 기록 박스, 아이 이니셜(원형)에 적용. 오류 문구 색도 레드 계열로 통일.
- D-008의 "검정 질문 블록" 항목을 번복한다. 로고 아이콘(`icon.svg`)의 검정 바탕은 유지.
- 확인 환경: 프로덕션 빌드(`next start`)로 확인. 다른 채팅의 dev 서버(PID 1841)는 새 CSS를 반영하지 않는다.
