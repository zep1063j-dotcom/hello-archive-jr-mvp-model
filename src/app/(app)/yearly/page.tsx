import Link from "next/link";
import { Suspense } from "react";
import { YearlyForm } from "@/components/yearly-form";
import { Eyebrow, PageSkeleton } from "@/components/states";
import { requireChild } from "@/lib/children";
import { todayKst } from "@/lib/date";
import { getMyYearlyAnswers } from "@/lib/my-yearly";
import { groupAnswersByQuestion, yearOfDateKey } from "@/lib/yearly-questions";

export const metadata = { title: "매년 같은 질문 · Hello Archive jr" };

// 해마다 같은 질문에 답하고, 지난해의 답과 나란히 본다 (D-026).
export default function YearlyPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <YearlyContent />
    </Suspense>
  );
}

async function YearlyContent() {
  const child = await requireChild("/yearly");
  const rows = await getMyYearlyAnswers(child.id);
  const today = todayKst();
  const year = yearOfDateKey(today);
  const birthMonth = Number(child.birthDate.slice(5, 7));
  const isBirthMonth = Number(today.slice(5, 7)) === birthMonth;

  const questions = groupAnswersByQuestion(rows).map((group) => {
    const current = group.answers.find((answer) => answer.year === year);
    return {
      key: group.key,
      label: group.label,
      hint: group.hint,
      current: current?.body ?? "",
      past: group.answers.filter((answer) => answer.year !== year),
      editable: !group.retired,
    };
  });

  return (
    <>
      <header>
        <Eyebrow>Every year, the same questions</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl font-bold">매년 같은 질문</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          해마다 같은 질문에 답해 두면, 1년 전의 모습과 지금의 모습을 나란히 볼 수 있어요. 한 해에 한 번이면 충분해요.
        </p>
        {isBirthMonth ? (
          <p className="mt-3 border-l-4 border-brand bg-blush px-4 py-3 text-sm">
            <span className="break-all">{child.nickname}</span>의 생일 달이에요. 오늘 답해 두기 좋은 때예요.
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-mute">생일이 있는 달({birthMonth}월)에 쓰는 것을 추천해요. 언제든 올해 답을 쓸 수 있어요.</p>
        )}
      </header>

      <YearlyForm year={year} questions={questions} />

      <Link
        href="/archive"
        className="min-h-12 content-center text-sm text-ink-soft underline underline-offset-4 hover:text-brand"
      >
        아카이브로 돌아가기
      </Link>
    </>
  );
}
