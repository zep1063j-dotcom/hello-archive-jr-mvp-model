// 날짜 계산·표시는 한국 시간(Asia/Seoul) 기준으로 이 파일에서만 처리한다.
import type { ChapterPeriod } from "@/types/archive";

const KST = "Asia/Seoul";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026년 10월 20일 (화)" */
export function formatKoreanDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** timestamptz → KST 기준 YYYY-MM-DD */
export function toKstDateKey(iso: string): string {
  return dateKeyFormatter.format(new Date(iso));
}

/** 오늘 날짜 (KST, YYYY-MM-DD). 요청 시점 값이라 쿠키 등 동적 데이터를 읽은 뒤에 호출한다. */
export function todayKst(): string {
  return dateKeyFormatter.format(new Date());
}

/** "2026년 10월 19일 주" 같은 주차 라벨 (weekStart는 KST 월요일 YYYY-MM-DD) */
export function formatWeekLabel(weekStart: string): string {
  const [year, month, day] = weekStart.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일 주`;
}

/** YYYY-MM-DD 에 개월 수를 더한다 (음수 가능). 말일은 대상 달의 말일로 보정. */
export function addMonths(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** YYYY-MM-DD 에 일 수를 더한다 (음수 가능). */
export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

/** "10/19" 형태의 짧은 월/일 */
export function formatMonthDay(dateKey: string): string {
  const [, month, day] = dateKey.split("-").map(Number);
  return `${month}/${day}`;
}

/** 생년월일 → "만 4세 5개월" (기준일 YYYY-MM-DD) */
export function formatAge(birthDate: string, today: string): string {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let totalMonths = (ty - by) * 12 + (tm - bm);
  if (td < bd) totalMonths -= 1;
  if (totalMonths < 0) return "";
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months}개월`;
  return months === 0 ? `만 ${years}세` : `만 ${years}세 ${months}개월`;
}

export const CHAPTER_MONTHS: Record<ChapterPeriod, number> = {
  "1m": 1,
  "3m": 3,
  "1y": 12,
};
