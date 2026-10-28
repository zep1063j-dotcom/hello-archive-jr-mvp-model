import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, Eyebrow, PageSkeleton } from "@/components/states";
import { buildChapters, CHAPTER_TITLES, chapterSpanLabel, isChapterPeriod } from "@/lib/chapters";
import { requireChild } from "@/lib/children";
import { todayKst } from "@/lib/date";
import { getMyEntries } from "@/lib/my-entries";

export function generateStaticParams() {
  return [{ period: "1m" }, { period: "3m" }, { period: "1y" }];
}

// 기간 종류별 챕터 목록. 달력 고정 구간이며 경계 정의는 `lib/chapters.ts` (D-021).
export default function ChapterListPage(
  props: PageProps<"/archive/chapters/[period]">,
) {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <ChapterList params={props.params} />
    </Suspense>
  );
}

async function ChapterList({
  params,
}: {
  params: PageProps<"/archive/chapters/[period]">["params"];
}) {
  const child = await requireChild();
  const { period } = await params;
  if (!isChapterPeriod(period)) notFound();

  const { name, summary } = CHAPTER_TITLES[period];
  const chapters = buildChapters(await getMyEntries(child.id), period, todayKst());

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
        <p className="mt-2 text-sm text-ink-soft">
          {chapters.length === 0 ? "아직 만들어진 챕터가 없어요" : `챕터 ${chapters.length}개`}
        </p>
      </header>
      {chapters.length === 0 ? (
        <EmptyState
          title="아직 묶을 기록이 없어요"
          description="기록을 남기면 그 기간의 챕터가 이곳에 만들어져요."
          action={{ href: "/write", label: "기록 남기기" }}
        />
      ) : (
        <ol className="-mt-3">
          {chapters.map((chapter) => (
            <li key={chapter.key} className="border-t border-line first:border-t-0">
              <Link
                href={`/archive/chapters/${period}/${chapter.key}`}
                transitionTypes={["nav-forward"]}
                className="group flex items-center justify-between gap-4 py-5"
              >
                <span>
                  <span className="block font-serif text-xl font-bold group-hover:text-brand">
                    {chapter.title}
                  </span>
                  <span className="mt-1 block text-xs text-ink-soft">
                    {chapterSpanLabel(chapter)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm">기록 {chapter.entries.length}개</span>
                  <span
                    className={`mt-1 block text-xs ${chapter.isOpen ? "text-brand" : "text-ink-mute"}`}
                  >
                    {chapter.isOpen ? "진행 중" : "완결"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
