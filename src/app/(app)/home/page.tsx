import { Suspense } from "react";
import { HomeHub } from "@/components/home/home-hub";
import { PageSkeleton } from "@/components/states";
import { requireChild } from "@/lib/children";
import { todayKst } from "@/lib/date";
import { getMyEntries, getThisWeekQuestion } from "@/lib/my-entries";

export const metadata = { title: "홈 · Hello Archive jr" };

// 메인 화면: 이번 주 질문에 바로 쓰고, 최근 기록 현황과 지난 기록을 한 화면에서 본다.
export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const child = await requireChild("/home");
  const [question, entries] = await Promise.all([
    getThisWeekQuestion(),
    getMyEntries(child.id),
  ]);

  return (
    <HomeHub child={child} question={question} entries={entries} today={todayKst()} />
  );
}
