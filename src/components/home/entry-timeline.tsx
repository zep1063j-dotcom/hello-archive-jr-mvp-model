"use client";

import Link from "next/link";
import { PhotoStrip } from "@/components/entry-photo-field";
import { toKstDateKey } from "@/lib/date";
import { groupByMonth } from "@/lib/entries";
import type { Entry } from "@/types/archive";

// 월별로 묶인 기록 목록. 항목을 누르면 그 자리에서 전문이 펼쳐진다.
export function EntryTimeline({
  entries,
  openId,
  onToggle,
}: {
  entries: Entry[];
  openId: string | null;
  onToggle: (entryId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      {groupByMonth(entries).map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="border-b border-ink pb-2 font-serif text-base font-bold">
            {group.label}
          </h3>
          <ol>
            {group.entries.map((entry) => {
              const isOpen = openId === entry.id;
              const [, month, day] = toKstDateKey(entry.createdAt).split("-");
              return (
                <li
                  key={entry.id}
                  id={`entry-${entry.id}`}
                  className={`scroll-mt-28 border-t border-line first:border-t-0 ${
                    isOpen ? "rounded-2xl bg-sheet" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggle(entry.id)}
                    aria-expanded={isOpen}
                    className="group grid w-full grid-cols-[3.5rem_1fr_1.5rem] gap-3 px-1 py-4 text-left md:grid-cols-[4.5rem_1fr_1.5rem] md:px-2"
                  >
                    <span
                      className={`font-serif leading-none ${isOpen ? "text-brand" : "text-ink-mute group-hover:text-brand"}`}
                    >
                      <span className="block text-3xl font-semibold tracking-tight">{day}</span>
                      <span className="mt-1 block text-xs">{Number(month)}월</span>
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold text-brand">
                        {entry.question.body}
                      </span>
                      <span
                        className={`mt-2 block font-serif leading-[1.85] whitespace-pre-wrap ${
                          isOpen ? "" : "line-clamp-2"
                        }`}
                      >
                        {entry.body}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={`pt-1 text-ink-mute transition-transform ${isOpen ? "rotate-180" : ""}`}
                    >
                      ⌄
                    </span>
                  </button>
                  {isOpen && entry.photos.length > 0 && (
                    <div className="px-2 pb-3 md:pl-[4.5rem]">
                      <PhotoStrip photos={entry.photos} />
                    </div>
                  )}
                  {isOpen && (
                    <div className="flex justify-end px-2 pb-4">
                      <Link
                        href={`/archive/${entry.id}`}
                        transitionTypes={["nav-forward"]}
                        className="text-sm text-ink-soft underline underline-offset-4 hover:text-brand"
                      >
                        상세 페이지로 →
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
