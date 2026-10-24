import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { PageSkeleton } from "@/components/states";
import { requireUser } from "@/lib/auth";

// 인증이 필요한 영역의 공통 레이아웃.
// proxy.ts가 1차로 막고, 여기서 서버가 세션을 다시 검증한다(쿠키를 읽으므로 Suspense 안에서).
// 데이터를 읽거나 쓰는 서버 코드는 각자 requireUser()로 소유자를 확인한다 (레이아웃 게이트만으로 보호하지 않는다).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 pt-5 pb-16 md:px-6">
        <Suspense fallback={<PageSkeleton />}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </main>
    </>
  );
}

async function AuthGate({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
