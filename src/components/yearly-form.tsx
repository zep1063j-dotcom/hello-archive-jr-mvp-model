"use client";

import { useActionState } from "react";
import { saveYearlyAnswers, type YearlyFormState } from "@/app/actions/yearly";
import { YEARLY_ANSWER_MAX_LENGTH } from "@/lib/yearly-questions";

type QuestionBlock = {
  key: string;
  label: string;
  hint: string;
  /** 지금 연도의 내 답(없으면 빈 문자열) */
  current: string;
  /** 지난 연도의 답 (최근 해 먼저, 읽기 전용) */
  past: { year: number; body: string }[];
  /** 목록에 없는 옛 질문은 지금 연도에 쓸 수 없다 */
  editable: boolean;
};

// 해마다 같은 질문: 지금 연도는 쓰고 고칠 수 있고, 지난 연도의 답은 질문 아래에 나란히 읽기 전용으로 보인다.
export function YearlyForm({ year, questions }: { year: number; questions: QuestionBlock[] }) {
  const [state, formAction, pending] = useActionState<YearlyFormState, FormData>(saveYearlyAnswers, {
    status: "idle",
  });

  return (
    <form action={formAction} noValidate className="flex flex-col gap-8">
      {questions.map((question) => (
        <section key={question.key} aria-labelledby={`yq-${question.key}`}>
          <h2 id={`yq-${question.key}`} className="font-serif text-lg leading-snug font-bold">
            {question.label}
          </h2>
          {question.hint && <p className="mt-1 text-sm text-ink-soft">{question.hint}</p>}

          {question.editable && (
            <div className="mt-3">
              <label htmlFor={`a-${question.key}`} className="text-[13px] font-semibold text-brand">
                {year}년
              </label>
              <textarea
                id={`a-${question.key}`}
                name={`a_${question.key}`}
                defaultValue={question.current}
                maxLength={YEARLY_ANSWER_MAX_LENGTH}
                rows={3}
                className="mt-1 min-h-24 w-full resize-y border border-ink/40 bg-paper px-4 py-3 leading-relaxed focus:border-ink rounded-xl"
                placeholder="비워 두면 답하지 않은 것으로 둬요"
              />
            </div>
          )}

          {question.past.length > 0 && (
            <ol className="mt-3 divide-y divide-line border-y border-line">
              {question.past.map((answer) => (
                <li key={answer.year} className="grid grid-cols-[3.5rem_1fr] gap-3 py-3">
                  <span className="font-serif text-sm text-ink-mute">{answer.year}년</span>
                  <p className="font-serif leading-[1.8] whitespace-pre-wrap">{answer.body}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}

      <div className="flex flex-col gap-3">
        {state.status === "saved" && (
          <p role="status" className="border-l-4 border-brand bg-sheet px-4 py-3 text-sm rounded-r-xl">
            {state.message}
          </p>
        )}
        {state.status === "error" && (
          <p role="alert" className="border-l-4 border-brand bg-sheet px-4 py-3 text-sm rounded-r-xl">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-12 w-full items-center justify-between bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40 rounded-xl"
        >
          {pending ? "저장하는 중…" : `${year}년 답 저장하기`}
          <span aria-hidden>↗</span>
        </button>
        <p className="text-[13px] leading-relaxed text-ink-mute">
          {year + 1}년이 되면 {year}년에 쓴 답변은 수정할 수 없어요. 그때부터는 지난 답으로 나란히 보여요.
        </p>
      </div>
    </form>
  );
}
