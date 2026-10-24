import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChildForm } from "@/components/child-form";
import { Logo } from "@/components/logo";
import { Eyebrow, PageSkeleton } from "@/components/states";
import { requireUser, safeNextPath } from "@/lib/auth";
import { earliestBirthDate } from "@/lib/child-validation";
import { getMyChild } from "@/lib/children";
import { todayKst } from "@/lib/date";

export const metadata = { title: "아이 등록 · Hello Archive jr" };

// 첫 로그인 뒤 자녀를 등록하는 화면. 자녀가 없으면 보호 화면들이 이곳으로 보낸다 (requireChild).
export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <>
      <header className="border-b border-ink">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center px-5 md:px-6">
          <Logo />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-14 md:px-6">
        <div>
          <Eyebrow>처음 한 번만</Eyebrow>
          <h1 className="mt-4 font-serif text-3xl font-bold leading-snug">
            어떤 아이의 이야기를 남길까요?
          </h1>
          <p className="mt-3 leading-relaxed text-ink-soft">
            별명과 생년월일만 알려 주세요. 기록에 아이의 나이를 함께 보여 드리는 데
            쓰고, 나중에 프로필에서 바꿀 수 있어요.
          </p>
        </div>
        <Suspense fallback={<PageSkeleton rows={2} />}>
          <OnboardingForm searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function OnboardingForm({
  searchParams,
}: {
  searchParams: PageProps<"/onboarding">["searchParams"];
}) {
  await requireUser();
  const { next } = await searchParams;
  const nextPath = safeNextPath(Array.isArray(next) ? next[0] : next);

  // 이미 등록했다면 온보딩을 건너뛴다.
  if (await getMyChild()) redirect(nextPath);

  const today = todayKst();
  return (
    <ChildForm
      mode="create"
      initial={{ nickname: "", birthDate: "" }}
      next={nextPath}
      min={earliestBirthDate(today)}
      max={today}
    />
  );
}
