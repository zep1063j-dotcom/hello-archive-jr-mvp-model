// 지난 질문 쓰기(놓친 질문)의 순수 규칙. Next.js에 묶이지 않는 순수 TS (D-015). 정책은 D-024.
//  - 쓸 수 있는 지난 질문 = 부모가 자녀를 등록한 주(KST 월요일) 이후 ~ 지난주, 시드에 있는 주
//  - 이번 주 질문은 기존 흐름(saveThisWeekEntry)이 다루고, 미래 질문은 쓸 수 없다
//  - 등록 전에 지나간 질문은 "놓친" 것이 아니므로 권하지 않는다(가입 직후 12주치 숙제가 쌓이는 것을 막는다)
import { toKstDateKey, weekStartOf } from "./date.ts";

/** 자녀 등록 시각(timestamptz) → 그 주의 월요일(KST). 이 주부터 지난 질문을 쓸 수 있다. */
export function joinedWeekStart(childCreatedAtIso: string): string {
  return weekStartOf(toKstDateKey(childCreatedAtIso));
}

/** YYYY-MM-DD 문자열 비교는 날짜 비교와 같다. */
export function isPastQuestionAnswerable(input: {
  questionWeekStart: string;
  thisWeekStart: string;
  joinedWeekStart: string;
}): boolean {
  return (
    input.questionWeekStart < input.thisWeekStart &&
    input.questionWeekStart >= input.joinedWeekStart
  );
}

type QuestionLike = { id: string; weekStart: string };

/** 아직 답하지 않은 지난 질문 (최근 주 먼저). */
export function missedQuestions<Q extends QuestionLike>(input: {
  questions: Q[];
  answeredQuestionIds: Set<string>;
  thisWeekStart: string;
  joinedWeekStart: string;
}): Q[] {
  return input.questions
    .filter(
      (question) =>
        !input.answeredQuestionIds.has(question.id) &&
        isPastQuestionAnswerable({
          questionWeekStart: question.weekStart,
          thisWeekStart: input.thisWeekStart,
          joinedWeekStart: input.joinedWeekStart,
        }),
    )
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}
