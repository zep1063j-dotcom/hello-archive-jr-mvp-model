import Link from "next/link";
import { Suspense } from "react";
import { EntryCard } from "@/components/entry-card";
import { EmptyState, ErrorState, Eyebrow, PageSkeleton } from "@/components/states";
import { groupByMonth } from "@/lib/entries";
import { CHAPTER_TITLES, getMockEntries, parseScenario } from "@/lib/mock-data";
import type { ChapterPeriod } from "@/types/archive";

export const metadata = { title: "아카이브 · Hello Archive jr" };

const PERIODS: ChapterPeriod[] = ["1m", "3m", "1y"];

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
  const scenario = parseScenario((await searchParams).mock);
  if (scenario === "error") {
    return <ErrorState title="기록을 불러오지 못했어요" />;
  }

  const entries = getMockEntries(scenario);

  return (
    <>
      <header>
        <Eyebrow>The archive of growing up</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl font-bold">성장 아카이브</h1>
        <p className="mt-2 text-sm text-ink-soft">
          지금까지 쌓은 기록 {entries.length}개
        </p>
      </header>

      <nav aria-label="기간별 모아보기">
        <ul className="grid grid-cols-3 border border-ink">
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

      {entries.length === 0 ? (
        <EmptyState
          title="아직 기록이 없어요"
          description="이번 주 질문에 답하면 여기에 시간순으로 쌓여요."
          action={{ href: "/write", label: "첫 기록 남기기" }}
        />
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
        </div>
      )}
    </>
  );
}
