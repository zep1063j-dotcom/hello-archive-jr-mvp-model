import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EntryDetailBody } from "@/components/entry-detail-body";
import { Eyebrow, PageSkeleton } from "@/components/states";
import { requireChild } from "@/lib/children";
import { formatKoreanDate, formatWeekLabel } from "@/lib/date";
import { getMyEntry } from "@/lib/my-entries";

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
  await requireChild("/archive");
  const { entryId } = await params;
  // 내 기록이 아니거나 없는 id는 구분 없이 404 (타인 기록의 존재 여부를 알려주지 않는다).
  const entry = await getMyEntry(entryId);
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
        <EntryDetailBody entryId={entry.id} body={entry.body} photos={entry.photos} />
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
    </>
  );
}
