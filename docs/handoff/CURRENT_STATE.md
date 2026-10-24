# CURRENT STATE

최종 갱신: 2026-10-24 (SESSION 01 종료)

## 세션 현황
- 현재 세션: 없음 (다음 채팅에서 **SESSION 02** 시작)
- 마지막 완료 세션: **SESSION 01 — UI/UX 구현 (목 데이터)** (DONE, 2026-10-24). 그 전: SESSION 00 (DONE).

## 구현 완료된 것
- SESSION 00: Next.js 16.4.3 / React 19.3.0 / TypeScript / Tailwind v4 / ESLint 스캐폴드, 폴더 구조, `.env.example`, 문서 시스템.
- SESSION 01 (**목 데이터, 아무것도 저장하지 않음**):
  - 라우트: `/`(소개), `/home`, `/write`, `/archive`, `/archive/[entryId]`, `/archive/chapters/[1m|3m|1y]`, `/profile`, 전역 not-found, `(app)` loading/error. `(public)`/`(app)` 라우트 그룹.
  - 홈 허브(D-009): 한 화면에서 이번 주 질문에 바로 쓰기·수정, 최근 8주 현황 칸, 기간 탭(전체/1개월/3개월/1년)으로 필터되는 월별 목록 인라인 펼침, 연속 기록 주 수. 기록 상태는 React 메모리(새로고침하면 초기화).
  - 내비게이션: 상단 고정 헤더 (D-010). 이동 애니메이션(D-011): 방향 슬라이드 + 메뉴 밑줄 이동, `prefers-reduced-motion` 존중.
  - 디자인: 에디토리얼 기록장 스타일(D-008) — 직각·가는 선·명조 본문·`h·` 로고, 새 `icon.svg`(기본 favicon 제거), 개발 인디케이터 끔. 색 원칙(D-012): 큰 면은 종이·살구빛, 검정은 글씨·선, 레드는 포인트.
  - 공통 코드: `src/lib/date.ts`(KST 날짜), `src/lib/entries.ts`(기간 필터·월별 묶음·최근 N주·연속 주 수), `src/lib/mock-data.ts`(교체 대상), `src/types/archive.ts`(화면 계약 타입), `src/components/states.tsx`(빈/오류/로딩).
  - 목 시나리오 URL: `?mock=written|empty|error`, `/home?fail=1`·`/write?fail=1` (표는 `sessions/SESSION_01.md`, 결정은 D-007).
- 종료 시점 검증: `npm run typecheck`, `npm run lint`, `npm run build` 통과 (2026-10-24 재실행).

## 아직 구현하지 않은 것
Supabase 연결, 인증/로그인/보호 라우트(`proxy.ts`), DB 스키마·RLS, 자녀 프로필 입력·저장, 실제 기록 저장·수정·삭제, 기간 묶음의 실제 기준, 주간 이메일, `/login`·`/auth/*`·`/onboarding`·`/api/*`. 지금 `(app)` 화면은 로그인 없이 누구나 열린다 (미리보기 단계). 프로필의 수정·로그아웃·삭제 요청은 비활성 자리표시자.

## 미검증
- 이동 애니메이션의 실제 체감(전환 타입·애니메이션 실행은 API로 확인, 프레임 단위 시각 확인은 못 함), Safari·모바일 실기기. 브라우저 뒤로가기 버튼은 슬라이드되지 않음(방향 타입이 없음).
- 홈 허브의 `?mock=empty` 빈 상태 화면, "수정하기" 재저장 흐름.
- 키보드·스크린리더 접근성, 프로덕션 환경의 not-found HTTP 상태 코드, 기간 경계.
- 허브·연속 주 수가 부모에게 동기가 되는지 부담이 되는지, 상단 2단 메뉴의 모바일 사용성은 **가설**이다 (베타에서 확인).
- 로고(`h·`)와 아이콘은 임시 제작. 브랜드 원본이 있는지 사용자 확인 필요.
- 자동화 테스트 없음.

## 진행 중인 작업
없음. **커밋하지 않았다** — 작업 트리에 SESSION 01 변경이 모두 남아 있다 (사용자 요청 또는 동의 시 로컬 커밋, push는 사용자가 직접).

## 미해결 사항 · 차단 요소
- Supabase 프로젝트, Resend 계정, Vercel/GitHub 원격 저장소 존재 여부는 미확인 (SESSION 02 이후 필요).
- `cacheComponents` 켜진 상태에서 SESSION 01 화면은 문제없이 빌드된다. 인증 세션(쿠키) 호환성은 SESSION 03에서 확인 (D-002).
- `next build`는 Google Fonts(Noto Serif KR)를 받으므로 네트워크가 필요하다 (D-008).
- 개발 서버 주의: 오래 떠 있던 `next dev`는 `globals.css` 변경을 반영하지 못한 적이 있다. 스타일이 이상하면 서버를 재시작한다. 이 폴더에 이미 `next dev`가 떠 있으면 새 `npm run dev`는 "already running"으로 실패한다.
- 원격 push는 사용자가 직접 한다. Claude는 push하지 않는다.

## 개발 실행 방법
```bash
npm ci            # 처음 한 번
npm run dev       # http://localhost:3000
```
검증: `npm run typecheck && npm run lint && npm run build`

## 다음에 수행할 정확한 작업
1. (선택) SESSION 01 변경을 로컬 커밋.
2. 새 채팅에서 **SESSION 02 — Supabase 데이터베이스**: `ARCHITECTURE.md` 5절 데이터 모델을 마이그레이션·RLS로 구현하고 두 사용자 교차 접근 테스트. 시작 전 사용자에게 확인: Supabase 프로젝트 존재 여부, 로컬 개발 방식(CLI 로컬 DB vs 원격), 생년월일을 월 단위만 받을지(D-005 미결정). DB 연결 후 `src/lib/mock-data.ts`, `?mock`·`?fail` 처리, `MockNotice`는 실제 데이터로 교체·제거한다. 디자인 수정은 데이터 연결 후 실제 기록으로 보며 하는 편이 낫다.

## 다음 작업 관련 파일
- `docs/handoff/ARCHITECTURE.md` (데이터 모델), `docs/handoff/DECISIONS.md` (D-005, D-007, D-009)
- `src/types/archive.ts` (화면 계약 타입), `src/lib/mock-data.ts`, `src/lib/entries.ts`, `src/lib/date.ts`
- `.env.example`, `supabase/migrations/`
