import Link from "next/link";
import { formatWeekLabel } from "@/lib/date";
import type { WeeklyQuestion } from "@/types/archive";

const VISIBLE = 3;

// 놓친 지난 질문 목록 (D-024). 가장 최근 3개만 보이고 나머지는 펼쳐서 본다 — 숙제처럼 쌓여 보이지 않게.
export function MissedQuestions({ missed }: { missed: WeeklyQuestion[] }) {
  if (missed.length === 0) return null;
  const visible = missed.slice(0, VISIBLE);
  const rest = missed.slice(VISIBLE);

  return (
    <section aria-labelledby="missed" className="mt-5">
      <h3 id="missed" className="text-sm font-semibold">
        놓친 질문 {missed.length}개 <span className="font-normal text-ink-soft">— 지금 남겨도 돼요</span>
      </h3>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {visible.map((question) => (
          <MissedItem key={question.id} question={question} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="mt-1">
          <summary className="min-h-10 cursor-pointer content-center text-[13px] text-ink-soft underline underline-offset-4">
            이전 질문 {rest.length}개 더 보기
          </summary>
          <ul className="divide-y divide-line border-y border-line">
            {rest.map((question) => (
              <MissedItem key={question.id} question={question} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function MissedItem({ question }: { question: WeeklyQuestion }) {
  return (
    <li>
      <Link
        href={`/write?week=${question.weekStart}`}
        className="group flex min-h-14 items-center justify-between gap-3 py-3 hover:text-brand"
      >
        <span className="min-w-0">
          <span className="block text-[11px] text-ink-mute">{formatWeekLabel(question.weekStart)}</span>
          <span className="line-clamp-2 font-serif leading-snug">{question.body}</span>
        </span>
        <span aria-hidden className="shrink-0 text-ink-mute group-hover:text-brand">
          ✎
        </span>
      </Link>
    </li>
  );
}
