import Link from "next/link";
import { Suspense } from "react";
import { confirmUnsubscribe } from "@/app/actions/unsubscribe";
import { Logo } from "@/components/logo";
import { Eyebrow, PageSkeleton } from "@/components/states";
import { verifyUnsubscribe } from "@/lib/unsubscribe";

export const metadata = {
  title: "수신 거부 · Hello Archive jr",
  robots: { index: false, follow: false },
};

// 주간 메일의 수신 거부 링크 도착 화면. 링크를 여는 것(GET)만으로는 아무것도 바뀌지 않고,
// 확인 버튼을 눌러야 꺼진다(메일 보안 스캐너가 링크를 미리 열어도 안전). 로그인 불필요 (D-024).
export default function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  return (
    <>
      <header className="border-b border-ink">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center px-5 md:px-6">
          <Logo />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-14 md:px-6">
        <Suspense fallback={<PageSkeleton rows={1} />}>
          <UnsubscribeContent searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

async function UnsubscribeContent({
  searchParams,
}: {
  searchParams: PageProps<"/unsubscribe">["searchParams"];
}) {
  const params = await searchParams;
  const userId = first(params.u);
  const token = first(params.t);

  if (first(params.done) === "1") {
    return (
      <Message title="수신을 껐어요">
        이제 주간 질문 메일을 보내지 않아요. 다시 받고 싶으면 로그인한 뒤 프로필에서 언제든 켤 수 있어요.
        <Link
          href="/login"
          className="mt-6 flex min-h-12 w-full items-center justify-between border border-ink px-5 font-semibold hover:bg-ink hover:text-paper"
        >
          앱으로 가기 <span aria-hidden>↗</span>
        </Link>
      </Message>
    );
  }

  if (first(params.error) === "failed") {
    return (
      <Message title="처리하지 못했어요" alert>
        잠시 후 메일의 링크를 다시 눌러 주세요. 계속 안 되면 로그인해서 프로필에서 수신을 끌 수 있어요.
      </Message>
    );
  }

  const valid = verifyUnsubscribe(userId, token, process.env.CRON_SECRET ?? "");
  if (first(params.error) === "invalid" || !valid) {
    return (
      <Message title="올바르지 않은 링크예요" alert>
        링크가 잘렸거나 바뀌었을 수 있어요. 메일의 링크를 다시 눌러 보시거나, 로그인한 뒤 프로필에서 수신을 끌 수 있어요.
      </Message>
    );
  }

  return (
    <Message title="주간 질문 메일을 그만 받을까요?">
      <form action={confirmUnsubscribe} className="mt-6">
        <input type="hidden" name="u" value={userId} />
        <input type="hidden" name="t" value={token} />
        <button
          type="submit"
          className="flex min-h-12 w-full items-center justify-between bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-deep"
        >
          수신 거부하기 <span aria-hidden>↗</span>
        </button>
      </form>
      <p className="mt-4 text-sm text-ink-mute">기록은 그대로 남아요. 프로필에서 언제든 다시 켤 수 있어요.</p>
    </Message>
  );
}

function Message({
  title,
  alert,
  children,
}: {
  title: string;
  alert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div role={alert ? "alert" : undefined}>
      <Eyebrow>수신 설정</Eyebrow>
      <h1 className="mt-4 font-serif text-3xl leading-snug font-bold">{title}</h1>
      <div className="mt-4 leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}
