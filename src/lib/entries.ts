// 기록 목록 가공(기간 필터·월별 묶음·주차 현황·연속 기록). 화면과 DB 양쪽에서 같은 규칙을 쓰도록 모아 둔다.
// 기간 경계는 SESSION 06에서 확정한다. 지금은 (오늘 - N개월, 오늘] (KST, 오늘 포함).
import { addDays, addMonths, CHAPTER_MONTHS, toKstDateKey } from "@/lib/date";
import type { ChapterPeriod, Entry } from "@/types/archive";

export type PeriodFilter = ChapterPeriod | "all";

export function isChapterPeriod(value: string): value is ChapterPeriod {
  return value === "1m" || value === "3m" || value === "1y";
}

export const CHAPTER_TITLES: Record<ChapterPeriod, { name: string; summary: string }> = {
  "1m": { name: "1개월 미니챕터", summary: "최근 한 달의 기록" },
  "3m": { name: "3개월 이야기집", summary: "최근 석 달의 기록" },
  "1y": { name: "1년 기록집", summary: "최근 1년의 기록" },
};

export function filterByPeriod(
  entries: Entry[],
  period: PeriodFilter,
  today: string,
): Entry[] {
  if (period === "all") return entries;
  const start = addMonths(today, -CHAPTER_MONTHS[period]);
  return entries.filter((entry) => {
    const day = toKstDateKey(entry.createdAt);
    return day > start && day <= today;
  });
}

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
