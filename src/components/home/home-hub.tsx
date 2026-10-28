"use client";

import { useState } from "react";
import Link from "next/link";
import { ChildAvatar } from "@/components/child-avatar";
import { EntryTimeline } from "@/components/home/entry-timeline";
import { WeekComposer } from "@/components/home/week-composer";
import { MissedQuestions } from "@/components/home/missed-questions";
import { WeekStrip } from "@/components/home/week-strip";
import { EmptyState } from "@/components/states";
import { formatAge, toKstDateKey, weekStartOf } from "@/lib/date";
import { currentStreak, recentWeeks } from "@/lib/entries";
import { joinedWeekStart } from "@/lib/past-questions";
import { entryOfWeek, questionForWeekCard } from "@/lib/week-question";
import type { Child, Entry, WeeklyQuestion } from "@/types/archive";

const WEEKS_SHOWN = 8;

// 메인 화면. 첫 달의 읽는 순서는 ① 이번 주 질문에 기록 ② 지난 기록 다시 보기 ③ 한 달 이야기 카드 보기이고,
// 매년 같은 질문 같은 보조 기능은 그 아래에 작게 둔다 (첫 사용자의 핵심 행동을 가리지 않게).
// 기록은 서버에서 읽은 값이고, 저장하면 서버 액션이 데이터를 갱신해 props로 다시 내려온다.
export function HomeHub({
  userId,
  child,
  recommended,
  entries,
  missed,
  photoUrl,
  today,
}: {
  userId: string;
  child: Child;
  /** 지금 아이 시기의 이번 주 추천 질문. 해당 주·시기 질문이 없으면 null. 이미 쓴 기록이 있으면 카드는 기록의 질문을 보인다 (D-039) */
  recommended: WeeklyQuestion | null;
  entries: Entry[];
  /** 아직 답하지 않은 지난 질문(최근 주 먼저, D-024) */
  missed: WeeklyQuestion[];
  /** 자녀 프로필 사진의 서명 URL. 없으면 별명 첫 글자 (D-027) */
  photoUrl: string | null;
  today: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const thisWeekStart = weekStartOf(today);
  // 같은 주면 질문 행의 시기가 달라도 같은 기록이다. 카드의 질문은 저장된 기록의 질문 → 없으면 추천 질문.
  const thisWeekEntry = entryOfWeek(entries, thisWeekStart);
  const question = questionForWeekCard(recommended, thisWeekEntry);
  // 가입한 주부터 보여 준다: 가입 전의 주가 "기록 없음"으로 보이지 않게 한다.
  const weeks = recentWeeks(entries, thisWeekStart, WEEKS_SHOWN, joinedWeekStart(child.createdAt));
  const streak = currentStreak(entries, thisWeekStart);
  // 최근 8주 현황 칸과 같은 범위의 기록만 보여준다. 전체는 아카이브에서 본다.
  const recent = weeks.flatMap((week) => (week.entry ? [week.entry] : [])).reverse();
  // 이야기 카드는 가장 최근 기록이 있는 달 것으로 연결한다 (entries는 최신순).
  const cardMonthKey = entries[0] ? toKstDateKey(entries[0].createdAt).slice(0, 7) : null;

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
          <h1 className="font-serif text-2xl font-bold leading-tight break-all">{child.nickname}</h1>
          <p className="text-sm text-ink-soft">{formatAge(child.birthDate, today)}</p>
        </div>
        {streak > 0 && (
          <p
            aria-live="polite"
            className="shrink-0 rounded-2xl border border-blush-deep bg-blush px-3 py-2 text-center leading-tight"
          >
            <span className="block font-serif text-2xl font-bold">{streak}</span>
            <span className="block text-[11px] text-ink-soft">주 연속</span>
          </p>
        )}
      </header>

      {question ? (
        <WeekComposer
          key={question.id}
          question={question}
          entry={thisWeekEntry}
          userId={userId}
          firstRecord={entries.length === 0}
        />
      ) : (
        <EmptyState
          title="이번 주 질문을 준비하고 있어요"
          description="질문이 준비되면 이곳에 나타나요. 지난 기록은 아래에서 볼 수 있어요."
        />
      )}

      <section aria-labelledby="weeks">
        <h2 id="weeks" className="mb-3 font-serif text-base font-bold">
          함께한 주
        </h2>
        <WeekStrip
          weeks={weeks}
          missedWeekStarts={new Set(missed.map((item) => item.weekStart))}
          onSelect={selectFromStrip}
        />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          {entries.length === 0
            ? "첫 기록을 남기면 이곳에 한 칸씩 채워져요."
            : streak === 0
              ? "쉬어 가는 주가 있어도 괜찮아요. 이번 주 질문부터 다시 이어 가요."
              : weeks.length < WEEKS_SHOWN
                ? "가입한 주부터 보여요."
                : ""}
        </p>
        <MissedQuestions missed={missed} />
      </section>

      <section aria-labelledby="timeline">
        <div className="mb-4 flex items-end justify-between gap-3 border-b border-ink pb-2">
          <h2 id="timeline" className="font-serif text-base font-bold">
            지난 기록 다시 보기
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
          <p className="rounded-2xl border border-dashed border-ink-mute px-5 py-8 leading-relaxed text-ink-soft">
            {entries.length === 0
              ? question
                ? "아직 쌓인 기록이 없어요. 위 질문에 한 문장만 적어도 첫 기록이 돼요."
                : "아직 쌓인 기록이 없어요. 질문이 준비되면 한 문장만 적어도 첫 기록이 돼요."
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

      {cardMonthKey ? (
        <Link
          href={`/archive/card/${cardMonthKey}`}
          transitionTypes={["nav-forward"]}
          className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-ink px-5 hover:bg-blush"
        >
          <span>
            <span className="block font-serif text-lg font-bold">한 달 이야기 카드 보기</span>
            <span className="block text-[13px] text-ink-soft">이번 달의 질문과 답이 카드 한 장으로 모여요</span>
          </span>
          <span aria-hidden>↗</span>
        </Link>
      ) : (
        <p className="rounded-2xl bg-paper-deep/60 px-5 py-4 text-[13px] leading-relaxed text-ink-soft">
          기록이 쌓이면 한 달의 이야기를 카드 한 장으로 볼 수 있어요.
        </p>
      )}

      <Link
        href="/yearly"
        transitionTypes={["nav-forward"]}
        className="flex min-h-12 items-center justify-between gap-3 rounded-xl px-1 text-[13px] text-ink-soft hover:text-brand"
      >
        <span>
          <span className="font-semibold text-ink">매년 같은 질문</span> · 1년 전의 아이와 지금의 아이를 나란히
        </span>
        <span aria-hidden>↗</span>
      </Link>
    </>
  );
}
