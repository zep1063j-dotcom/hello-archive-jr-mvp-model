import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Eyebrow, PageSkeleton } from "@/components/states";
import { formatKoreanDate, formatWeekLabel } from "@/lib/date";
import { allMockEntryIds, findMockEntry } from "@/lib/mock-data";

export function generateStaticParams() {
  return allMockEntryIds().map((entryId) => ({ entryId }));
}

export default function EntryDetailPage(props: PageProps<"/archive/[entryId]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={2} />}>
      <EntryDetail params={props.params} />
    </Suspense>
  );
}

async function EntryDetail({
  params,
}: {
  params: PageProps<"/archive/[entryId]">["params"];
}) {
  const { entryId } = await params;
  const entry = findMockEntry(entryId);
  if (!entry) notFound();

  const edited = entry.updatedAt !== entry.createdAt;

  return (
    <>
      <Link
        href="/archive"
        transitionTypes={["nav-back"]}
        className="text-sm text-ink-soft underline underline-offset-4"
      >
        ← 아카이브
      </Link>
      <article>
        <header className="border-b border-ink pb-6">
          <Eyebrow>{formatWeekLabel(entry.question.weekStart)}의 질문</Eyebrow>
          <h1 className="mt-4 font-serif text-2xl font-bold leading-[1.5]">
            {entry.question.body}
          </h1>
        </header>
        <p className="mt-6 whitespace-pre-wrap font-serif text-[1.0625rem] leading-[2]">
          {entry.body}
        </p>
        <footer className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-ink-mute">
          <p>
            작성{" "}
            <time dateTime={entry.createdAt}>
              {formatKoreanDate(entry.createdAt)}
            </time>
          </p>
          {edited && (
            <p>
              수정{" "}
              <time dateTime={entry.updatedAt}>
                {formatKoreanDate(entry.updatedAt)}
              </time>
            </p>
          )}
        </footer>
      </article>
      {/* 수정·삭제는 SESSION 05에서 연결한다. */}
    </>
  );
}
