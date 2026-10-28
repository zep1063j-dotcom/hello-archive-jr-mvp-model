import Link from "next/link";
import { PhotoStrip } from "@/components/entry-photo-field";
import { toKstDateKey } from "@/lib/date";
import type { Entry } from "@/types/archive";

// 카드 대신 가는 선으로 나뉜 한 줄 항목: 왼쪽 날짜 숫자, 오른쪽 질문과 본문.
export function EntryCard({ entry }: { entry: Entry }) {
  const [, month, day] = toKstDateKey(entry.createdAt).split("-");

  return (
    <Link
      href={`/archive/${entry.id}`}
      transitionTypes={["nav-forward"]}
      className="group grid grid-cols-[4rem_1fr] gap-4 border-t border-line py-5 first:border-t-0 md:grid-cols-[5rem_1fr]"
    >
      <time
        dateTime={entry.createdAt}
        className="font-serif leading-none text-ink-mute group-hover:text-brand"
      >
        <span className="block text-3xl font-semibold tracking-tight md:text-4xl">
          {day}
        </span>
        <span className="mt-1 block text-xs">{Number(month)}월</span>
      </time>
      <div>
        <p className="text-[13px] leading-snug text-ink-soft">
          {entry.question.body}
        </p>
        <p className="mt-2 line-clamp-3 font-serif text-[1.125rem] leading-[1.8] text-ink">
          {entry.body}
        </p>
        {entry.photos.length > 0 && (
          <div className="mt-3">
            <PhotoStrip photos={entry.photos} size="sm" />
          </div>
        )}
      </div>
    </Link>
  );
}
