import { Suspense } from "react";
import { HomeHub } from "@/components/home/home-hub";
import { ErrorState, PageSkeleton } from "@/components/states";
import {
  getMockEntries,
  MOCK_TODAY,
  mockChild,
  parseScenario,
  thisWeekQuestion,
} from "@/lib/mock-data";

export const metadata = { title: "홈 · Hello Archive jr" };

// 메인 화면: 이번 주 질문에 바로 쓰고, 최근 기록 현황과 지난 기록을 한 화면에서 본다.
export default function HomePage(props: PageProps<"/home">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomeContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function HomeContent({
  searchParams,
}: {
  searchParams: PageProps<"/home">["searchParams"];
}) {
  const params = await searchParams;
  const scenario = parseScenario(params.mock);
  if (scenario === "error") {
    return <ErrorState title="홈을 불러오지 못했어요" />;
  }

  return (
    <HomeHub
      key={scenario}
      child={mockChild}
      question={thisWeekQuestion}
      initialEntries={getMockEntries(scenario)}
      today={MOCK_TODAY}
      simulateError={params.fail === "1"}
    />
  );
}
