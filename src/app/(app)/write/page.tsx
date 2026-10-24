import { Suspense } from "react";
import { ErrorState, Eyebrow, PageSkeleton } from "@/components/states";
import { WriteForm } from "@/components/write-form";
import { requireChild } from "@/lib/children";
import { formatKoreanDate, formatWeekLabel } from "@/lib/date";
import {
  getMockThisWeekEntry,
  parseScenario,
  thisWeekQuestion,
} from "@/lib/mock-data";

export const metadata = { title: "기록 쓰기 · Hello Archive jr" };

// 이메일 딥링크 목적지. 같은 주 재작성은 새 기록이 아니라 수정으로 처리한다 (D-005).
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
  await requireChild("/write");
  const params = await searchParams;
  const scenario = parseScenario(params.mock);
  if (scenario === "error") {
    return <ErrorState title="이번 주 질문을 불러오지 못했어요" />;
  }

  const existing = getMockThisWeekEntry(scenario);

  return (
    <>
      <header className="border-b border-ink pb-6">
        <Eyebrow>{formatWeekLabel(thisWeekQuestion.weekStart)}의 질문</Eyebrow>
        <h1 className="mt-4 font-serif text-[1.75rem] font-bold leading-[1.5]">
          {thisWeekQuestion.body}
        </h1>
        {thisWeekQuestion.hint && (
          <p className="mt-4 leading-relaxed text-ink-soft">
            {thisWeekQuestion.hint}
          </p>
        )}
      </header>

      {existing && (
        <p className="-mt-3 text-sm text-ink-soft">
          {formatKoreanDate(existing.createdAt)}에 쓴 기록이에요. 고쳐서 다시 저장할 수 있어요.
        </p>
      )}

      <WriteForm
        key={scenario}
        initialBody={existing?.body}
        simulateError={params.fail === "1"}
      />
    </>
  );
}
