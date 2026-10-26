// 매년 같은 질문. Next.js에 묶이지 않는 순수 TS (D-015). 정책은 D-026.
//  - 주간 질문과 별개로, 해마다 같은 질문에 답해 한 해 전의 아이와 지금의 아이를 나란히 본다.
//  - 질문 목록은 코드에 고정한다. 이미 저장된 답은 `key`로 남으므로 key는 바꾸지 않는다(문구는 다듬어도 된다).
//  - 연도는 한국 시간 달력 연도다. 지금 연도의 답만 쓰고 고칠 수 있고, 지난 연도는 읽기 전용이다.

export type YearlyQuestion = { key: string; label: string; hint: string };

export const YEARLY_QUESTIONS: YearlyQuestion[] = [
  { key: "growth", label: "요즘 아이의 키와 몸무게, 몸의 모습은 어떤가요?", hint: "숫자도 좋고, 입는 옷 사이즈나 높이로 말해도 좋아요." },
  { key: "favorites", label: "요즘 아이가 가장 좋아하는 것은 무엇인가요?", hint: "음식, 놀이, 사람, 장난감, 노래 무엇이든요." },
  { key: "words", label: "요즘 아이가 자주 하는 말이나 말투는 무엇인가요?", hint: "소리 그대로 적어 두면 나중에 더 생생해요." },
  { key: "dream", label: "아이가 커서 되고 싶다고 하는 것이나 바라는 것이 있나요?", hint: "아직 없다면 없다고 적어도 돼요." },
  { key: "message", label: "1년 뒤의 아이에게 하고 싶은 말은 무엇인가요?", hint: "" },
];

export const YEARLY_ANSWER_MAX_LENGTH = 1000;

export function isYearlyKey(value: string): boolean {
  return YEARLY_QUESTIONS.some((question) => question.key === value);
}

/** 한국 시간 날짜(YYYY-MM-DD)의 연도 */
export function yearOfDateKey(dateKey: string): number {
  return Number(dateKey.slice(0, 4));
}

// 공백으로 보이지 않는 글자가 하나라도 있어야 한다 (DB 정규식 검사와 같은 기준, D-014)
const HAS_VISIBLE_CHAR = /[^\s​]/u;

export type YearlyAnswerValidation =
  | { ok: true; value: string | null } // null = 비어 있음(답하지 않음, 이미 있던 답은 지운다)
  | { ok: false; error: string };

/** 빈 값은 "답하지 않음"이다. 앞뒤 공백을 지운다. 줄바꿈은 유지한다. */
export function validateYearlyAnswer(raw: unknown): YearlyAnswerValidation {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "답을 확인해 주세요." };
  if (!HAS_VISIBLE_CHAR.test(raw)) return { ok: true, value: null };
  const value = raw.trim();
  if (value.length > YEARLY_ANSWER_MAX_LENGTH) {
    return { ok: false, error: `답은 ${YEARLY_ANSWER_MAX_LENGTH}자까지 쓸 수 있어요.` };
  }
  return { ok: true, value };
}

export type YearlyAnswerRow = { year: number; questionKey: string; body: string };

/** 질문 키별로 연도 내림차순(최근 해 먼저)으로 묶는다. 목록에 없는 키(옛 질문)는 버리지 않고 뒤에 둔다. */
export function groupAnswersByQuestion(
  rows: YearlyAnswerRow[],
): { key: string; label: string; hint: string; retired: boolean; answers: { year: number; body: string }[] }[] {
  const known = YEARLY_QUESTIONS.map((q) => ({ ...q, retired: false }));
  const knownKeys = new Set(known.map((q) => q.key));
  const extraKeys = [...new Set(rows.filter((r) => !knownKeys.has(r.questionKey)).map((r) => r.questionKey))];
  const all = [...known, ...extraKeys.map((key) => ({ key, label: "이전에 쓰던 질문", hint: "", retired: true }))];
  return all.map((question) => ({
    ...question,
    answers: rows
      .filter((row) => row.questionKey === question.key)
      .sort((a, b) => b.year - a.year)
      .map(({ year, body }) => ({ year, body })),
  }));
}
