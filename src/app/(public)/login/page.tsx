import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/login-form";
import { Eyebrow, PageSkeleton } from "@/components/states";
import { safeNextPath } from "@/lib/auth";

export const metadata = { title: "로그인 · Hello Archive jr" };

// 이미 로그인한 사용자는 proxy.ts가 /home으로 보낸다.
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <header className="border-b border-ink">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center px-5 md:px-6">
          <Logo />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-14 md:px-6">
        <div>
          <Eyebrow>로그인</Eyebrow>
          <h1 className="mt-4 font-serif text-3xl font-bold leading-snug">
            이메일로 시작해요
          </h1>
        </div>
        <Suspense fallback={<PageSkeleton rows={1} />}>
          <LoginFormLoader searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

// 돌아갈 경로(next)는 쿼리에서 읽고, 서버에서 한 번 더 허용 목록으로 검증한다.
async function LoginFormLoader({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { next } = await searchParams;
  return <LoginForm next={safeNextPath(Array.isArray(next) ? next[0] : next)} />;
}
