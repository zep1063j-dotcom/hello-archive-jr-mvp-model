"use client";

import { formatMonthDay } from "@/lib/date";
import type { WeekSlot } from "@/lib/entries";

// 최근 8주 기록 현황. 쓴 주를 누르면 아래 타임라인에서 그 기록이 펼쳐진다.
export function WeekStrip({
  weeks,
  onSelect,
}: {
  weeks: WeekSlot[];
  onSelect: (entryId: string) => void;
}) {
  return (
    <ol className="grid grid-cols-8 gap-1.5">
      {weeks.map((week) => {
        const label = week.isCurrent ? "이번 주" : formatMonthDay(week.weekStart);
        const base = "flex h-12 w-full items-center justify-center text-sm transition-all";
        return (
          <li key={week.weekStart} className="flex flex-col items-center gap-1.5">
            {week.entry ? (
              <button
                type="button"
                onClick={() => week.entry && onSelect(week.entry.id)}
                aria-label={`${formatMonthDay(week.weekStart)} 주 기록 보기`}
                className={`${base} bg-brand text-white hover:-translate-y-0.5 hover:bg-brand-deep`}
              >
                ✓
              </button>
            ) : (
              <span
                aria-label={`${formatMonthDay(week.weekStart)} 주 ${week.isCurrent ? "아직 기록 전" : "기록 없음"}`}
                className={`${base} ${
                  week.isCurrent
                    ? "animate-pulse border-2 border-dashed border-brand text-brand"
                    : "border border-line bg-paper-deep/50 text-ink-mute"
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
