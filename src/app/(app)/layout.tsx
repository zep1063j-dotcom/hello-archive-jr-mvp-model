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
      <main className="app-main">
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
