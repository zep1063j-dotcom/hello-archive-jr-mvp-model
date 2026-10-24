import { Suspense } from "react";
import { WeekComposer } from "@/components/home/week-composer";
import { EmptyState, PageSkeleton } from "@/components/states";
import { requireChild } from "@/lib/children";
import { weekStartOf, todayKst } from "@/lib/date";
import { getMyEntries, getThisWeekQuestion } from "@/lib/my-entries";

export const metadata = { title: "기록 쓰기 · Hello Archive jr" };

// 이메일 딥링크 목적지(안정적인 공개 URL, D-015). 홈의 이번 주 카드와 같은 컴포넌트를 펼친 채로 보여준다.
// 같은 주 재작성은 새 기록이 아니라 수정으로 처리한다 (D-005).
export default function WritePage() {
  return (
    <Suspense fallback={<PageSkeleton rows={2} />}>
      <WriteContent />
    </Suspense>
  );
}

async function WriteContent() {
  const child = await requireChild("/write");
  const [question, entries] = await Promise.all([
    getThisWeekQuestion(),
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
