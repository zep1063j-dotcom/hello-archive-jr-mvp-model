import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EntryCard } from "@/components/entry-card";
import { EmptyState, Eyebrow, PageSkeleton } from "@/components/states";
import { requireChild } from "@/lib/children";
import {
  CHAPTER_TITLES,
  getMockChapterEntries,
  isChapterPeriod,
} from "@/lib/mock-data";

export function generateStaticParams() {
  return [{ period: "1m" }, { period: "3m" }, { period: "1y" }];
}

// 조회용 묶음. 기간 경계·기준일은 SESSION 06에서 정의한다 (여기서는 목 필터).
export default function ChapterPage(
  props: PageProps<"/archive/chapters/[period]">,
) {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <Chapter params={props.params} />
    </Suspense>
  );
}

async function Chapter({
  params,
}: {
  params: PageProps<"/archive/chapters/[period]">["params"];
}) {
  await requireChild("/archive");
  const { period } = await params;
  if (!isChapterPeriod(period)) notFound();

  const { name, summary } = CHAPTER_TITLES[period];
  const entries = getMockChapterEntries(period);

  return (
    <>
      <Link
        href="/archive"
        transitionTypes={["nav-back"]}
        className="text-sm text-ink-soft underline underline-offset-4"
      >
        ← 아카이브
      </Link>
      <header className="border-b border-ink pb-5">
        <Eyebrow>{summary}</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl font-bold">{name}</h1>
        <p className="mt-2 text-sm text-ink-soft">기록 {entries.length}개</p>
      </header>
      {entries.length === 0 ? (
        <EmptyState
          title="이 기간에는 기록이 없어요"
          description="기록이 쌓이면 이곳에 모아서 보여 드려요."
          action={{ href: "/write", label: "기록 남기기" }}
        />
      ) : (
        <ol className="-mt-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <EntryCard entry={entry} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
