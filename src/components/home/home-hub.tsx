"use client";

import { useState } from "react";
import Link from "next/link";
import { ChildAvatar } from "@/components/child-avatar";
import { EntryTimeline } from "@/components/home/entry-timeline";
import { WeekComposer } from "@/components/home/week-composer";
import { MissedQuestions } from "@/components/home/missed-questions";
import { WeekStrip } from "@/components/home/week-strip";
import { EmptyState } from "@/components/states";
import { formatAge, weekStartOf } from "@/lib/date";
import { currentStreak, recentWeeks } from "@/lib/entries";
import type { Child, Entry, WeeklyQuestion } from "@/types/archive";

const WEEKS_SHOWN = 8;

// 메인 화면 하나에서 쓰기 · 최근 8주 현황 · 기간별 열람을 모두 한다.
// 기록은 서버에서 읽은 값이고, 저장하면 서버 액션이 데이터를 갱신해 props로 다시 내려온다.
export function HomeHub({
  child,
  question,
  entries,
  missed,
  photoUrl,
  today,
}: {
  child: Child;
  /** 이번 주 질문. 해당 주 질문이 없으면 null */
  question: WeeklyQuestion | null;
  entries: Entry[];
  /** 아직 답하지 않은 지난 질문(최근 주 먼저, D-024) */
  missed: WeeklyQuestion[];
  /** 자녀 프로필 사진의 서명 URL. 없으면 별명 첫 글자 (D-027) */
  photoUrl: string | null;
  today: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const thisWeekStart = weekStartOf(today);
  const thisWeekEntry =
    entries.find((entry) => entry.question.weekStart === thisWeekStart) ?? null;
  const weeks = recentWeeks(entries, thisWeekStart, WEEKS_SHOWN);
  const streak = currentStreak(entries, thisWeekStart);
  // 최근 8주 현황 칸과 같은 범위의 기록만 보여준다. 전체는 아카이브에서 본다.
  const recent = weeks.flatMap((week) => (week.entry ? [week.entry] : [])).reverse();

  function selectFromStrip(entryId: string) {
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
        <ChildAvatar nickname={child.nickname} photoUrl={photoUrl} />
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

      {question ? (
        <WeekComposer key={question.id} question={question} entry={thisWeekEntry} />
      ) : (
        <EmptyState
          title="이번 주 질문을 준비하고 있어요"
          description="질문이 준비되면 이곳에 나타나요. 지난 기록은 아래에서 볼 수 있어요."
        />
      )}

      <section aria-labelledby="weeks">
        <h2 id="weeks" className="mb-3 font-serif text-base font-bold">
          최근 8주
        </h2>
        <WeekStrip
          weeks={weeks}
          missedWeekStarts={new Set(missed.map((item) => item.weekStart))}
          onSelect={selectFromStrip}
        />
        <MissedQuestions missed={missed} />
      </section>

      <Link
        href="/yearly"
        transitionTypes={["nav-forward"]}
        className="flex min-h-14 items-center justify-between gap-3 border border-ink/30 px-4 hover:border-ink hover:bg-blush"
      >
        <span>
          <span className="block font-serif font-bold">매년 같은 질문</span>
          <span className="block text-[13px] text-ink-soft">1년 전의 아이와 지금의 아이를 나란히</span>
        </span>
        <span aria-hidden>↗</span>
      </Link>

      <section aria-labelledby="timeline">
        <div className="mb-4 flex items-end justify-between gap-3 border-b border-ink pb-2">
          <h2 id="timeline" className="font-serif text-base font-bold">
            최근 기록
          </h2>
          <Link
            href="/archive"
            transitionTypes={["nav-forward"]}
            className="min-h-10 content-center text-[13px] text-ink-soft underline underline-offset-4 hover:text-brand"
          >
            아카이브에서 전체 보기 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="border border-dashed border-ink-mute px-5 py-8 leading-relaxed text-ink-soft">
            {entries.length === 0
              ? question
                ? "아직 쌓인 기록이 없어요. 위 질문에 한두 줄만 적어도 첫 기록이 돼요."
                : "아직 쌓인 기록이 없어요. 질문이 준비되면 한두 줄만 적어도 첫 기록이 돼요."
              : "최근 8주에는 기록이 없어요. 지난 기록은 아카이브에서 볼 수 있어요."}
          </p>
        ) : (
          <EntryTimeline
            entries={recent}
            openId={openId}
            onToggle={(id) => setOpenId((current) => (current === id ? null : id))}
          />
        )}
      </section>
    </>
  );
}
