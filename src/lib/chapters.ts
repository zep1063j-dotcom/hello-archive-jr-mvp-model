// 성장 아카이브의 기간 묶음(챕터). Next.js에 묶이지 않는 순수 TS (D-015).
// 기준: 달력 고정 구간(월 / 분기 / 연)을 한국 시간(KST) 반개구간 [start, end)로 정의한다.
//  - 1m 미니챕터 = 한 달, 3m 이야기집 = 분기(1~3월, 4~6월, 7~9월, 10~12월), 1y 기록집 = 한 해
//  - 기록은 작성일(`createdAt`의 KST 날짜)이 구간에 들어가는 챕터에 속한다. 화면에 보이는 날짜와 같은 기준이다.
//  - 구간은 고정이라 완결된 챕터의 내용은 이후 기록이 쌓여도 바뀌지 않는다(지난 기록을 새로 쓰는 것은 막혀 있다).
import { addDays, addMonths, toKstDateKey } from "./date.ts";
import type { ChapterPeriod, Entry } from "@/types/archive";

export function isChapterPeriod(value: string): value is ChapterPeriod {
  return value === "1m" || value === "3m" || value === "1y";
}

export const CHAPTER_TITLES: Record<ChapterPeriod, { name: string; summary: string }> = {
  "1m": { name: "1개월 미니챕터", summary: "한 달씩 묶은 기록" },
  "3m": { name: "3개월 이야기집", summary: "분기별로 묶은 기록" },
  "1y": { name: "1년 기록집", summary: "한 해씩 묶은 기록" },
};

const PERIOD_MONTHS: Record<ChapterPeriod, number> = { "1m": 1, "3m": 3, "1y": 12 };

/** 챕터 구간. start·end는 KST 날짜(YYYY-MM-DD)이고 end는 포함하지 않는다. */
export type ChapterRange = {
  /** URL에 쓰는 식별자: 1m `2026-10`, 3m `2026-q4`, 1y `2026` */
  key: string;
  start: string;
  end: string;
};

export type Chapter = ChapterRange & {
  period: ChapterPeriod;
  title: string;
  /** 읽는 순서(오래된 기록 → 최신) */
  entries: Entry[];
  /** 아직 끝나지 않은 구간(오늘이 end 이전) → 기록이 더 쌓일 수 있다 */
  isOpen: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** 날짜(YYYY-MM-DD)가 속한 챕터 구간 */
export function chapterRangeOf(period: ChapterPeriod, dateKey: string): ChapterRange {
  const year = dateKey.slice(0, 4);
  const month = Number(dateKey.slice(5, 7));
  let key: string;
  let start: string;
  if (period === "1m") {
    key = `${year}-${pad(month)}`;
    start = `${year}-${pad(month)}-01`;
  } else if (period === "3m") {
    const quarter = Math.floor((month - 1) / 3) + 1;
    key = `${year}-q${quarter}`;
    start = `${year}-${pad((quarter - 1) * 3 + 1)}-01`;
  } else {
    key = year;
    start = `${year}-01-01`;
  }
  return { key, start, end: addMonths(start, PERIOD_MONTHS[period]) };
}

const KEY_PATTERNS: Record<ChapterPeriod, RegExp> = {
  "1m": /^(20\d{2})-(0[1-9]|1[0-2])$/,
  "3m": /^(20\d{2})-q([1-4])$/,
  "1y": /^(20\d{2})$/,
};

/** URL 식별자 → 구간. 형식이 틀리면 null. */
export function parseChapterKey(period: ChapterPeriod, key: string): ChapterRange | null {
  const match = KEY_PATTERNS[period].exec(key);
  if (!match) return null;
  const year = match[1];
  const dateKey =
    period === "1m"
      ? `${year}-${match[2]}-01`
      : period === "3m"
        ? `${year}-${pad((Number(match[2]) - 1) * 3 + 1)}-01`
        : `${year}-01-01`;
  return chapterRangeOf(period, dateKey);
}

/** "2026년 10월" / "2026년 4분기" / "2026년" */
export function chapterTitle(period: ChapterPeriod, range: ChapterRange): string {
  const year = range.start.slice(0, 4);
  if (period === "1y") return `${year}년`;
  if (period === "3m") return `${year}년 ${range.key.slice(-1)}분기`;
  return `${year}년 ${Number(range.start.slice(5, 7))}월`;
}

/** "10월 1일 ~ 12월 31일" (end는 포함하지 않으므로 하루 전을 마지막 날로 보여준다) */
export function chapterSpanLabel(range: ChapterRange): string {
  const [, sm, sd] = range.start.split("-").map(Number);
  const [, em, ed] = addDays(range.end, -1).split("-").map(Number);
  return `${sm}월 ${sd}일 ~ ${em}월 ${ed}일`;
}

/** 작성일(KST)이 구간 [start, end)에 드는지 */
export function isInRange(entry: Entry, range: ChapterRange): boolean {
  const day = toKstDateKey(entry.createdAt);
  return day >= range.start && day < range.end;
}

/** 구간을 챕터로 만든다. 구간에 드는 기록을 오래된 순으로 담는다. */
export function makeChapter(
  period: ChapterPeriod,
  range: ChapterRange,
  entries: Entry[],
  today: string,
): Chapter {
  return {
    ...range,
    period,
    title: chapterTitle(period, range),
    entries: entries
      .filter((entry) => isInRange(entry, range))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    isOpen: today < range.end,
  };
}

/** 기록이 하나 이상 있는 챕터 목록 (최신 챕터 먼저). */
export function buildChapters(
  entries: Entry[],
  period: ChapterPeriod,
  today: string,
): Chapter[] {
  const ranges = new Map<string, ChapterRange>();
  for (const entry of entries) {
    const range = chapterRangeOf(period, toKstDateKey(entry.createdAt));
    ranges.set(range.key, range);
  }
  return [...ranges.values()]
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((range) => makeChapter(period, range, entries, today));
}
