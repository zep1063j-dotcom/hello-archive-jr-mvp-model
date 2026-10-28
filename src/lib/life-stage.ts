// 아이의 시기(유년·아동·청소년·청년)를 생년월일로 정하는 순수 규칙 (D-038). Next.js에 묶이지 않는 순수 TS (D-015).
//  - 주간 질문과 질문 은행은 시기마다 따로 있고, 아이는 "질문이 나오는 주(KST 월요일)"의 만 나이로 시기가 정해진다.
//  - 그래서 아이가 자라 구간을 넘으면 그 주부터 다음 시기 질문이 나오고, 이미 쓴 기록은 그때의 질문과 함께 남는다.

export type LifeStage = "early" | "child" | "teen" | "young";

export const LIFE_STAGES: { key: LifeStage; label: string; ageText: string; fromAge: number }[] = [
  { key: "early", label: "유년", ageText: "만 0~6세", fromAge: 0 },
  { key: "child", label: "아동", ageText: "만 7~12세", fromAge: 7 },
  { key: "teen", label: "청소년", ageText: "만 13~18세", fromAge: 13 },
  { key: "young", label: "청년", ageText: "만 19세 이상", fromAge: 19 },
];

/** DB 제약(`weekly_questions.stage`, `question_bank.stage`)과 같은 키. */
export const LIFE_STAGE_KEYS: LifeStage[] = LIFE_STAGES.map((stage) => stage.key);

export function isLifeStage(value: unknown): value is LifeStage {
  return LIFE_STAGE_KEYS.some((key) => key === value);
}

/** 기준일(YYYY-MM-DD)의 만 나이. 기준일이 생일 전이면 0으로 본다(태어나기 전 주의 질문을 계산해도 안전하게). */
export function ageInYearsAt(birthDate: string, dateKey: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = dateKey.split("-").map(Number);
  let years = ty - by;
  if (tm < bm || (tm === bm && td < bd)) years -= 1;
  return Math.max(0, years);
}

export function stageOfAge(age: number): LifeStage {
  let stage: LifeStage = "early";
  for (const candidate of LIFE_STAGES) {
    if (age >= candidate.fromAge) stage = candidate.key;
  }
  return stage;
}

/** 기준일(보통 질문이 나오는 주의 월요일)에 아이가 속한 시기. */
export function stageAt(birthDate: string, dateKey: string): LifeStage {
  return stageOfAge(ageInYearsAt(birthDate, dateKey));
}

export function stageLabel(stage: LifeStage): string {
  return LIFE_STAGES.find((candidate) => candidate.key === stage)?.label ?? "";
}
