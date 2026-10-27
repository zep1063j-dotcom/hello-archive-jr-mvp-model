import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EntryCard } from "@/components/entry-card";
import { EmptyState, Eyebrow, PageSkeleton } from "@/components/states";
import {
  buildChapters,
  CHAPTER_TITLES,
  chapterSpanLabel,
  isChapterPeriod,
  makeChapter,
  parseChapterKey,
} from "@/lib/chapters";
import { requireChild } from "@/lib/children";
import { todayKst } from "@/lib/date";
import { getMyEntries } from "@/lib/my-entries";

// 챕터 하나: 구간 [start, end)에 작성한 기록을 오래된 순(읽는 순서)으로 보여준다.
export default function ChapterPage(
  props: PageProps<"/archive/chapters/[period]/[chapterKey]">,
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
  params: PageProps<"/archive/chapters/[period]/[chapterKey]">["params"];
}) {
  const child = await requireChild("/archive");
  const { period, chapterKey } = await params;
  if (!isChapterPeriod(period)) notFound();
  const range = parseChapterKey(period, chapterKey);
  const today = todayKst();
  // 형식이 틀렸거나 아직 시작하지 않은 구간은 없는 챕터로 본다.
  if (!range || range.start > today) notFound();

  const entries = await getMyEntries(child.id);
  const chapter = makeChapter(period, range, entries, today);

  // 이전·다음 챕터는 기록이 있는 챕터끼리만 잇는다 (목록은 최신 먼저).
  const all = buildChapters(entries, period, today);
  const index = all.findIndex((c) => c.key === chapter.key);
  const newer = index > 0 ? all[index - 1] : null;
  const older = index >= 0 ? (all[index + 1] ?? null) : null;

  return (
    <>
      <Link
        href={`/archive/chapters/${period}`}
        transitionTypes={["nav-back"]}
        className="text-sm text-ink-soft underline underline-offset-4"
      >
        ← {CHAPTER_TITLES[period].name}
      </Link>
      <header className="border-b border-ink pb-5">
        <Eyebrow>{chapter.isOpen ? "진행 중인 챕터" : "완결된 챕터"}</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl font-bold">{chapter.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {chapterSpanLabel(chapter)} · 기록 {chapter.entries.length}개
        </p>
      </header>
      {period === "1m" && chapter.entries.length > 0 && (
        <Link
          href={`/archive/card/${chapter.key}`}
          transitionTypes={["nav-forward"]}
          className="-mt-3 flex min-h-14 items-center justify-between gap-3 bg-brand px-5 font-semibold text-white hover:bg-brand-deep"
        >
          <span>
            이야기 카드 만들기
            <span className="block text-[13px] font-normal text-white/80">
              이미지로 저장하고 공유해요
            </span>
          </span>
          <span aria-hidden>↗</span>
        </Link>
      )}
      {chapter.entries.length === 0 ? (
        <EmptyState
          title="이 기간에는 기록이 없어요"
          description={
            chapter.isOpen
              ? "이번 주 질문에 답하면 이 챕터에 쌓여요."
              : "지난 기간에는 새로 기록을 남길 수 없어요."
          }
          action={chapter.isOpen ? { href: "/write", label: "기록 남기기" } : undefined}
        />
      ) : (
        <ol className="-mt-3">
          {chapter.entries.map((entry) => (
            <li key={entry.id}>
              <EntryCard entry={entry} />
            </li>
          ))}
        </ol>
      )}
      {(older || newer) && (
        <nav
          aria-label="다른 챕터"
          className="flex justify-between gap-4 border-t border-ink pt-4 text-sm"
        >
          {older ? (
            <Link
              href={`/archive/chapters/${period}/${older.key}`}
              transitionTypes={["nav-back"]}
              className="underline underline-offset-4 hover:text-brand"
            >
              ← {older.title}
            </Link>
          ) : (
            <span />
          )}
          {newer && (
            <Link
              href={`/archive/chapters/${period}/${newer.key}`}
              transitionTypes={["nav-forward"]}
              className="underline underline-offset-4 hover:text-brand"
            >
              {newer.title} →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
