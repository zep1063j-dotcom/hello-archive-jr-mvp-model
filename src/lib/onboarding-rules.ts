// 첫 가입 환영 온보딩을 어느 단계에서 시작할지의 순수 규칙 (D-040). Next.js에 묶이지 않는 순수 TS (D-015).
//  - 아이가 없다                        → "welcome": 환영 → 아이 등록 → 환영 (처음부터)
//  - 아이가 있고 완료 시각이 없다         → "finish": 마지막 환영 창부터 이어서 (이미 등록한 아이는 다시 만들지 않는다)
//  - 아이가 있고 완료 시각이 있다         → null: 온보딩 없음 (기존 사용자 포함)
//  - 완료 시각 컬럼이 아직 없는 DB        → 아이가 있으면 null (마이그레이션 전에 기존 사용자를 방해하지 않는다)

export type OnboardingStep = "welcome" | "finish" | null;

/** 계정의 설정 행에서 읽은 온보딩 완료 상태. */
export type OnboardingRecord =
  | { kind: "row"; completedAt: string | null }
  | { kind: "no-row" }
  | { kind: "column-missing" };

export function decideOnboardingStep(hasChild: boolean, record: OnboardingRecord): OnboardingStep {
  if (!hasChild) return "welcome";
  if (record.kind === "column-missing") return null;
  if (record.kind === "no-row") return "finish";
  return record.completedAt === null ? "finish" : null;
}
