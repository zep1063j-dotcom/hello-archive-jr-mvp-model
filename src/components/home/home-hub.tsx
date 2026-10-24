"use client";

import { useState } from "react";
import { EntryTimeline, PERIOD_TABS } from "@/components/home/entry-timeline";
import { WeekComposer } from "@/components/home/week-composer";
import { WeekStrip } from "@/components/home/week-strip";
import { formatAge } from "@/lib/date";
import {
  currentStreak,
  filterByPeriod,
  recentWeeks,
  type PeriodFilter,
} from "@/lib/entries";
import type { Child, Entry, WeeklyQuestion } from "@/types/archive";

const WEEKS_SHOWN = 8;

// 메인 화면 하나에서 쓰기 · 최근 8주 현황 · 기간별 열람을 모두 한다.
// 기록 상태는 이 화면의 메모리에만 있다(새로고침하면 초기화). 실제 저장은 SESSION 05.
export function HomeHub({
  child,
  question,
  initialEntries,
  today,
  simulateError,
}: {
  child: Child;
  question: WeeklyQuestion;
  initialEntries: Entry[];
  today: string;
  simulateError: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [filter, setFilter] = useState<PeriodFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const thisWeekEntry =
    entries.find((entry) => entry.question.weekStart === question.weekStart) ?? null;
  const weeks = recentWeeks(entries, question.weekStart, WEEKS_SHOWN);
  const streak = currentStreak(entries, question.weekStart);
  const visible = filterByPeriod(entries, filter, today);

  function saveThisWeek(body: string) {
    // 목 단계: 시각은 고정된 "오늘"의 저녁으로 둔다 (실제 시각 기록은 DB 연결 후).
    const now = `${today}T21:00:00+09:00`;
    setEntries((prev) =>
      thisWeekEntry
        ? prev.map((entry) =>
            entry.id === thisWeekEntry.id ? { ...entry, body, updatedAt: now } : entry,
          )
        : [
            {
              id: `entry-${question.weekStart}`,
              question,
              body,
              createdAt: now,
              updatedAt: now,
            },
            ...prev,
          ],
    );
    setOpenId(null);
  }

  function selectFromStrip(entryId: string) {
    setFilter("all");
    setOpenId(entryId);
    // 목록이 다시 그려진 뒤 해당 기록으로 부드럽게 이동
    requestAnimationFrame(() => {
      document
        .getElementById(`entry-${entryId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <>
      <header className="flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-full bg-blush-deep font-serif text-2xl font-bold text-brand-deep"
        >
          {child.nickname.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-bold leading-tight">{child.nickname}</h1>
          <p className="text-sm text-ink-soft">{formatAge(child.birthDate, today)}</p>
        </div>
        <p
          aria-live="polite"
          className="shrink-0 border border-blush-deep bg-blush px-3 py-2 text-center leading-tight"
        >
          <span className="block font-serif text-2xl font-bold">{streak}</span>
          <span className="block text-[11px] text-ink-soft">주 연속</span>
        </p>
      </header>

      <WeekComposer
        question={question}
        entry={thisWeekEntry}
        simulateError={simulateError}
        onSave={saveThisWeek}
      />

      <section aria-labelledby="weeks">
        <h2 id="weeks" className="mb-3 font-serif text-base font-bold">
          최근 8주
        </h2>
        <WeekStrip weeks={weeks} onSelect={selectFromStrip} />
      </section>

      <section aria-labelledby="timeline">
        <div className="mb-4 flex items-end justify-between gap-3 border-b border-ink pb-2">
          <h2 id="timeline" className="font-serif text-base font-bold">
            기록 모아보기
          </h2>
          <div role="tablist" aria-label="기간" className="flex">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={filter === tab.value}
                onClick={() => setFilter(tab.value)}
                className={`min-h-10 px-2.5 text-[13px] transition-colors ${
                  filter === tab.value
                    ? "border-b-2 border-brand font-bold text-ink"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div role="tabpanel">
          {entries.length === 0 ? (
            <p className="border border-dashed border-ink-mute px-5 py-8 leading-relaxed text-ink-soft">
              아직 쌓인 기록이 없어요. 위 질문에 한두 줄만 적어도 첫 기록이 돼요.
            </p>
          ) : (
            <EntryTimeline
              entries={visible}
              openId={openId}
              onToggle={(id) => setOpenId((current) => (current === id ? null : id))}
              emptyHint="다른 기간을 눌러 보거나, 이번 주 질문부터 기록해 보세요."
            />
          )}
        </div>
      </section>
    </>
  );
}
