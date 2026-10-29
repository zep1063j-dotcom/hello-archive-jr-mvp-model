import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MonthCard } from "@/components/month-card";
import { EmptyState, Eyebrow, PageSkeleton } from "@/components/states";
import { makeChapter, parseChapterKey } from "@/lib/chapters";
import { requireChild } from "@/lib/children";
import { todayKst } from "@/lib/date";
import { buildMonthCard } from "@/lib/month-card";
import { getMyEntries } from "@/lib/my-entries";

export const metadata = { title: "1개월 이야기 카드 · Hello Archive jr" };

// 한 달의 기록으로 만드는 이야기 카드(D-029). 카드는 브라우저에서 그려지고, 서버는 그 달의 기록·사진 주소만 준다.
export default function MonthCardPage(props: PageProps<"/archive/card/[monthKey]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <MonthCardContent params={props.params} />
    </Suspense>
  );
}

async function MonthCardContent({
  params,
}: {
  params: PageProps<"/archive/card/[monthKey]">["params"];
}) {
  const child = await requireChild();
  const { monthKey } = await params;
  const range = parseChapterKey("1m", monthKey);
  const today = todayKst();
  // 형식이 틀렸거나 아직 시작하지 않은 달은 없는 카드로 본다.
  if (!range || range.start > today) notFound();

  const chapter = makeChapter("1m", range, await getMyEntries(child.id), today);
  const model = buildMonthCard({
    chapter,
    childName: child.nickname,
    birthDate: child.birthDate,
    today,
  });

  return (
    <>
      <Link
        href={`/archive/chapters/1m/${chapter.key}`}
        transitionTypes={["nav-back"]}
        className="text-sm text-ink-soft underline underline-offset-4"
      >
        ← {chapter.title}
      </Link>
      <header className="border-b border-ink pb-5">
        <Eyebrow>{chapter.isOpen ? "진행 중인 달" : "완결된 달"}</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl font-bold">{chapter.title} 이야기 카드</h1>
        <p className="mt-2 text-sm text-ink-soft">
          앞면은 한 달의 사진 앨범, 뒷면은 아이와 나눈 대화예요. 이미지로 저장하거나 공유할 수 있어요.
        </p>
      </header>
      {model ? (
        <MonthCard
          model={model}
          fileBase={`hello-archive-${chapter.key}`}
          fullHref={`/archive/chapters/1m/${chapter.key}`}
        />
      ) : (
        <EmptyState
          title="이 달에는 기록이 없어요"
          description="기록을 남기면 그 달의 이야기 카드를 만들 수 있어요."
          action={chapter.isOpen ? { href: "/write", label: "기록 남기기" } : undefined}
        />
      )}
      {chapter.isOpen && model && (
        <p className="text-sm text-ink-mute">
          아직 진행 중인 달이에요. 기록을 더 남기면 앨범에도 새 기록이 함께 담겨요.
        </p>
      )}
    </>
  );
}
