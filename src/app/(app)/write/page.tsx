import Link from "next/link";
import { Suspense } from "react";
import { WeekComposer } from "@/components/home/week-composer";
import { EmptyState, PageSkeleton } from "@/components/states";
import { requireChild } from "@/lib/children";
import { weekStartOf, todayKst } from "@/lib/date";
import { getMyEntries, getPastQuestion, getThisWeekQuestion } from "@/lib/my-entries";

export const metadata = { title: "기록 쓰기 · Hello Archive jr" };

// 이메일 딥링크 목적지(안정적인 공개 URL, D-015). 홈의 이번 주 카드와 같은 컴포넌트를 펼친 채로 보여준다.
// 같은 주 재작성은 새 기록이 아니라 수정으로 처리한다 (D-005).
// `?week=YYYY-MM-DD`(월요일)이 있으면 놓친 지난 질문에 쓰는 화면이다 (D-024).
export default function WritePage(props: PageProps<"/write">) {
  return (
    <Suspense fallback={<PageSkeleton rows={2} />}>
      <WriteContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function WriteContent({
  searchParams,
}: {
  searchParams: PageProps<"/write">["searchParams"];
}) {
  const { week } = await searchParams;
  const weekParam = Array.isArray(week) ? week[0] : week;
  const child = await requireChild(weekParam ? `/write?week=${encodeURIComponent(weekParam)}` : "/write");

  if (weekParam) {
    const [pastQuestion, entries] = await Promise.all([
      getPastQuestion(child, weekParam),
      getMyEntries(child.id),
    ]);
    if (!pastQuestion) {
      return (
        <EmptyState
          title="이 질문에는 기록을 남길 수 없어요"
          description="지난 질문은 아이를 등록한 주부터 지난주까지, 아직 답하지 않은 질문에 남길 수 있어요."
          action={{ href: "/write", label: "이번 주 질문 쓰기" }}
        />
      );
    }
    const existingPast = entries.find((entry) => entry.question.id === pastQuestion.id) ?? null;
    return (
      <>
        <h1 className="sr-only">지난 질문에 기록 쓰기</h1>
        <WeekComposer key={pastQuestion.id} question={pastQuestion} entry={existingPast} defaultOpen past />
        <Link
          href="/home"
          className="min-h-12 content-center text-sm text-ink-soft underline underline-offset-4 hover:text-brand"
        >
          홈으로 돌아가기
        </Link>
      </>
    );
  }

  const [question, entries] = await Promise.all([
    getThisWeekQuestion(child),
    getMyEntries(child.id),
  ]);

  if (!question) {
    return (
      <EmptyState
        title="이번 주 질문을 준비하고 있어요"
        description="질문이 준비되면 이곳에서 바로 기록할 수 있어요."
        action={{ href: "/home", label: "홈으로" }}
      />
    );
  }

  const thisWeekStart = weekStartOf(todayKst());
  const existing =
    entries.find((entry) => entry.question.weekStart === thisWeekStart) ?? null;

  return (
    <>
      <h1 className="sr-only">이번 주 기록 쓰기</h1>
      <WeekComposer key={question.id} question={question} entry={existing} defaultOpen />
    </>
  );
}
