// 기록 목록 가공(월별 묶음·주차 현황·연속 기록). 기간 챕터의 경계는 `chapters.ts`에서 정의한다.
import { addDays, toKstDateKey } from "@/lib/date";
import type { Entry } from "@/types/archive";

/** 최신순 기록을 KST 기준 연·월로 묶는다. */
export function groupByMonth(
  entries: Entry[],
): { label: string; entries: Entry[] }[] {
  const groups: { label: string; entries: Entry[] }[] = [];
  for (const entry of entries) {
    const [year, month] = toKstDateKey(entry.createdAt).split("-");
    const label = `${year}년 ${Number(month)}월`;
    const last = groups.at(-1);
    if (last?.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}

export type WeekSlot = {
  weekStart: string;
  entry: Entry | null;
  isCurrent: boolean;
};

/** 이번 주를 맨 오른쪽으로 하는 최근 count주 (오래된 주 → 이번 주 순). */
export function recentWeeks(
  entries: Entry[],
  thisWeekStart: string,
  count: number,
): WeekSlot[] {
  const byWeek = new Map(entries.map((e) => [e.question.weekStart, e]));
  return Array.from({ length: count }, (_, i) => {
    const weekStart = addDays(thisWeekStart, -7 * (count - 1 - i));
    return {
      weekStart,
      entry: byWeek.get(weekStart) ?? null,
      isCurrent: weekStart === thisWeekStart,
    };
  });
}

/** 연속으로 기록한 주 수. 이번 주를 아직 안 썼으면 지난주부터 센다. */
export function currentStreak(entries: Entry[], thisWeekStart: string): number {
  const written = new Set(entries.map((e) => e.question.weekStart));
  let week = written.has(thisWeekStart) ? thisWeekStart : addDays(thisWeekStart, -7);
  let streak = 0;
  while (written.has(week)) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}
