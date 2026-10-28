import Link from "next/link";
import { Suspense } from "react";
import { EntryCard } from "@/components/entry-card";
import { MonthCardCarousel } from "@/components/month-card-carousel";
import { EmptyState, Eyebrow, PageSkeleton } from "@/components/states";
import { buildChapters, CHAPTER_TITLES } from "@/lib/chapters";
import { requireChild } from "@/lib/children";
import { todayKst } from "@/lib/date";
import { normalizeSearchQuery, SEARCH_QUERY_MAX_LENGTH } from "@/lib/entry-search";
import { groupByMonth } from "@/lib/entries";
import { buildMonthCard } from "@/lib/month-card";
import { getMyEntries } from "@/lib/my-entries";
import type { ChapterPeriod } from "@/types/archive";

export const metadata = { title: "아카이브 · Hello Archive jr" };

const PERIODS: ChapterPeriod[] = ["1m", "3m", "1y"];

/** 상단 카드 목록에 올리는 달의 최대 개수 (최신 달부터) */
const MAX_CAROUSEL_CARDS = 24;

export default function ArchivePage(props: PageProps<"/archive">) {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <ArchiveContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ArchiveContent({
  searchParams,
}: {
  searchParams: PageProps<"/archive">["searchParams"];
}) {
  const { q } = await searchParams;
  const search = normalizeSearchQuery(q);
  const child = await requireChild();
  const entries = await getMyEntries(child.id, search);

  // 검색 중에는 검색 결과만 보이도록 카드 목록을 숨긴다(검색된 기록만으로는 한 달 카드를 만들 수 없다).
  const today = todayKst();
  const cards = search
    ? []
    : buildChapters(entries, "1m", today)
        .slice(0, MAX_CAROUSEL_CARDS)
        .flatMap((chapter) => {
          const model = buildMonthCard({
            chapter,
            childName: child.nickname,
            birthDate: child.birthDate,
            today,
          });
          return model ? [{ key: chapter.key, isOpen: chapter.isOpen, model }] : [];
        });

  return (
    <>
      <header>
        <Eyebrow>The archive of growing up</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl font-bold">성장 아카이브</h1>
        <p className="mt-2 text-sm text-ink-soft" aria-live="polite">
          {search
            ? `‘${search}’ 검색 결과 ${entries.length}개`
            : `지금까지 쌓은 기록 ${entries.length}개`}
        </p>
      </header>

      <MonthCardCarousel cards={cards} />

      {/* 자바스크립트 없이도 동작하는 GET 폼 (주소에 검색어가 남아 새로고침·뒤로가기가 자연스럽다) */}
      <form role="search" action="/archive" method="get" className="flex gap-2">
        <label htmlFor="archive-search" className="sr-only">
          기록 검색
        </label>
        <input
          id="archive-search"
          type="search"
          name="q"
          defaultValue={search ?? ""}
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          placeholder="기록에서 단어 찾기"
          enterKeyHint="search"
          autoComplete="off"
          className="min-h-12 min-w-0 flex-1 border border-ink/40 bg-paper px-4 focus:border-ink rounded-xl"
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 border border-ink px-5 font-semibold hover:bg-ink hover:text-paper rounded-xl"
        >
          찾기
        </button>
      </form>

      <nav aria-label="기간별 모아보기">
        <ul className="grid grid-cols-3 overflow-hidden rounded-2xl border border-ink">
          {PERIODS.map((period) => (
            <li key={period} className="border-l border-ink first:border-l-0">
              <Link
                href={`/archive/chapters/${period}`}
                transitionTypes={["nav-forward"]}
                className="flex min-h-16 flex-col items-center justify-center px-1 text-center transition-colors hover:bg-blush"
              >
                <span className="font-serif text-lg font-bold leading-none">
                  {period === "1y" ? "1년" : `${period[0]}개월`}
                </span>
                <span className="mt-1 text-[11px] text-ink-soft">
                  {CHAPTER_TITLES[period].name.replace(/^\S+\s/, "")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Link
        href="/yearly"
        transitionTypes={["nav-forward"]}
        className="flex min-h-14 items-center justify-between gap-3 border border-ink/30 px-4 hover:border-ink hover:bg-blush rounded-xl"
      >
        <span>
          <span className="block font-serif font-bold">매년 같은 질문</span>
          <span className="block text-[13px] text-ink-soft">해마다 답을 쌓아 나란히 보기</span>
        </span>
        <span aria-hidden>↗</span>
      </Link>

      {entries.length === 0 ? (
        search ? (
          <EmptyState
            title="찾는 기록이 없어요"
            description="다른 단어로 찾아보거나, 검색을 지우고 전체 기록을 볼 수 있어요."
            action={{ href: "/archive", label: "검색 지우기" }}
          />
        ) : (
          <EmptyState
            title="아직 기록이 없어요"
            description="이번 주 질문에 답하면 여기에 시간순으로 쌓여요."
            action={{ href: "/write", label: "첫 기록 남기기" }}
          />
        )
      ) : (
        <div className="flex flex-col gap-8">
          {groupByMonth(entries).map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="border-b border-ink pb-2 font-serif text-lg font-bold">
                {group.label}
              </h2>
              <ol>
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <EntryCard entry={entry} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {search && (
            <Link
              href="/archive"
              className="min-h-12 content-center text-sm text-ink-soft underline underline-offset-4 hover:text-brand"
            >
              검색 지우고 전체 보기
            </Link>
          )}
        </div>
      )}
    </>
  );
}
