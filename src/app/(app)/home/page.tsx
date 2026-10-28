import { Suspense } from "react";
import { HomeHub } from "@/components/home/home-hub";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { PageSkeleton } from "@/components/states";
import { requireUser } from "@/lib/auth";
import { earliestBirthDate } from "@/lib/child-validation";
import { getMyChild } from "@/lib/children";
import { todayKst, weekStartOf } from "@/lib/date";
import { getMissedQuestions, getMyEntries, getThisWeekQuestion } from "@/lib/my-entries";
import { getOnboardingStep } from "@/lib/onboarding";
import { getChildPhotoUrl } from "@/lib/photos";
import { entryOfWeek } from "@/lib/week-question";

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
  const user = await requireUser();
  const child = await getMyChild();
  const today = todayKst();
  // 첫 가입 환영 온보딩 (D-040): 계정 기준 상태를 서버가 정해 처음 그릴 때부터 맞는 화면을 낸다(홈과 번갈아 깜빡이지 않는다).
  const onboarding = await getOnboardingStep(Boolean(child));

  if (!child) {
    // 아이 등록 전: 홈의 내용 대신 조용한 배경 위에 환영 창만 띄운다.
    return (
      <>
        <PageSkeleton rows={2} />
        <OnboardingDialog initialStep="welcome" today={today} minBirthDate={earliestBirthDate(today)} />
      </>
    );
  }

  // 서로 기다릴 필요가 없는 조회는 한꺼번에 시작한다 (놓친 질문도 기록 조회와 나란히 읽는다).
  const entriesPromise = getMyEntries(child.id);
  const [recommended, entries, photoUrl, missed] = await Promise.all([
    getThisWeekQuestion(child),
    entriesPromise,
    getChildPhotoUrl(child.photoPath),
    getMissedQuestions(child, entriesPromise),
  ]);

  // 이번 주 기록이 이미 있으면 카드는 그 기록의 질문만 보인다. 지금 시기의 추천 질문은 화면에 보내지도 않는다 (D-039).
  const hasThisWeekEntry = entryOfWeek(entries, weekStartOf(today)) !== null;

  return (
    <>
      <HomeHub
        userId={user.id}
        child={child}
        recommended={hasThisWeekEntry ? null : recommended}
        entries={entries}
        missed={missed}
        photoUrl={photoUrl}
        today={today}
      />
      {onboarding === "finish" && (
        <OnboardingDialog initialStep="finish" today={today} minBirthDate={earliestBirthDate(today)} />
      )}
    </>
  );
}
