"use client";

import Link from "next/link";
import { formatMonthDay } from "@/lib/date";
import type { WeekSlot } from "@/lib/entries";

// 함께한 주(가입한 주부터 최대 8주)의 기록 현황. 쓴 주를 누르면 아래 타임라인에서 그 기록이 펼쳐진다.
// 비어 있는 주는 실패나 결석처럼 보이지 않게 조용한 빈 칸으로만 둔다.
export function WeekStrip({
  weeks,
  missedWeekStarts,
  onSelect,
}: {
  weeks: WeekSlot[];
  /** 놓쳤지만 지금 쓸 수 있는 지난 질문의 주(D-024). 누르면 그 질문 쓰기로 이동한다 */
  missedWeekStarts: Set<string>;
  onSelect: (entryId: string) => void;
}) {
  return (
    <ol className="grid auto-cols-fr grid-flow-col gap-1">
      {weeks.map((week) => {
        const label = week.isCurrent ? "이번 주" : formatMonthDay(week.weekStart);
        const base = "flex h-11 w-full items-center justify-center border-b text-sm transition-colors";
        return (
          <li key={week.weekStart} className="flex flex-col items-center gap-1.5">
            {week.entry ? (
              <button
                type="button"
                onClick={() => week.entry && onSelect(week.entry.id)}
                aria-label={`${formatMonthDay(week.weekStart)} 주 기록 보기`}
                className={`${base} border-brand bg-transparent font-serif text-lg text-brand hover:bg-blush`}
              >
                ✓
              </button>
            ) : missedWeekStarts.has(week.weekStart) ? (
              <Link
                href={`/write?week=${week.weekStart}`}
                aria-label={`${formatMonthDay(week.weekStart)} 주 질문에 기록 남기기`}
                className={`${base} border-brand/40 text-brand hover:bg-blush`}
              >
                +
              </Link>
            ) : (
              <span
                aria-label={`${formatMonthDay(week.weekStart)} 주 ${week.isCurrent ? "아직 기록 전" : "비어 있는 주"}`}
                className={`${base} ${
                  week.isCurrent
                    ? "border-brand text-brand"
                    : "border-line bg-transparent text-ink-mute"
                }`}
              >
                {week.isCurrent ? "·" : ""}
              </span>
            )}
            <span
              className={`text-[10px] tracking-tight ${week.isCurrent ? "font-bold text-ink" : "text-ink-mute"}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
