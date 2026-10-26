// 질문 은행·이번 주 질문 바꾸기의 순수 규칙. Next.js에 묶이지 않는 순수 TS (D-015). 정책은 D-025.
//  - 기본 질문은 모두에게 같다. 부모는 이번 주 질문을 은행의 다른 질문이나 직접 쓴 질문으로 바꿀 수 있다.
//  - 기록을 남기면 그 주 질문은 고정된다(서버 확인 + DB RLS). 한 주에 기록은 하나다.
import type { WeeklyQuestion } from "../types/archive.ts";

export const CUSTOM_QUESTION_MAX_LENGTH = 100;

// 공백으로 보이지 않는 글자가 하나라도 있어야 한다 (DB 정규식 검사와 같은 기준, D-014)
const HAS_VISIBLE_CHAR = /[^\s​]/u;

export type CustomQuestionValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** 직접 쓴 질문 검증. 연속 공백·줄바꿈은 한 칸으로 줄이고 앞뒤 공백을 지운다. */
export function validateCustomQuestion(raw: unknown): CustomQuestionValidation {
  if (typeof raw !== "string") return { ok: false, error: "질문을 입력해 주세요." };
  const value = raw.replace(/\s+/gu, " ").trim();
  if (!HAS_VISIBLE_CHAR.test(value)) return { ok: false, error: "질문을 입력해 주세요." };
  if (value.length > CUSTOM_QUESTION_MAX_LENGTH) {
    return { ok: false, error: `질문은 ${CUSTOM_QUESTION_MAX_LENGTH}자까지 쓸 수 있어요.` };
  }
  return { ok: true, value };
}

export type BankQuestion = { id: string; body: string };

/**
 * 은행에서 무작위로 하나. `excludeBodies`(현재 질문·이미 답한 질문 등)는 가능하면 피하고,
 * 후보가 없으면 현재 질문만 피한다. 은행이 비었거나 현재 질문뿐이면 null.
 */
export function pickRandomBankQuestion(input: {
  bank: BankQuestion[];
  excludeBodies: Set<string>;
  currentBody: string;
  random?: () => number;
}): BankQuestion | null {
  const random = input.random ?? Math.random;
  const notCurrent = input.bank.filter((q) => q.body !== input.currentBody);
  const fresh = notCurrent.filter((q) => !input.excludeBodies.has(q.body));
  const pool = fresh.length > 0 ? fresh : notCurrent;
  if (pool.length === 0) return null;
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index];
}

export type QuestionChoiceLike = {
  source: "bank" | "custom";
  body: string;
};

/** 부모가 바꾼 질문이 있으면 그 문구로 보여 준다(기본 질문의 도움말은 함께 숨긴다). 주 id는 그대로라 기록과의 연결은 변하지 않는다. */
export function applyChoice(
  question: WeeklyQuestion,
  choice: QuestionChoiceLike | undefined | null,
): WeeklyQuestion {
  if (!choice) return question;
  return { id: question.id, weekStart: question.weekStart, body: choice.body, source: choice.source };
}

// 질문 옆 장식 이모티콘. 질문마다 정해진 값이라 서버·브라우저 렌더링이 같고, 질문이 바뀌면 이모티콘도 바뀐다.
const QUESTION_EMOJIS = [
  "🌱", "🧸", "🎈", "🌈", "🍓", "🚀", "🐣", "🎨", "🌻", "🍪", "⭐", "🐻",
  "🦋", "🎵", "🍀", "🌙", "☀️", "🐥", "🍎", "🎁", "🧩", "🚲", "🐢", "🌸",
];

export function emojiForQuestion(key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return QUESTION_EMOJIS[hash % QUESTION_EMOJIS.length];
}
