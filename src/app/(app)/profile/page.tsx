import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { Eyebrow, PageSkeleton } from "@/components/states";
import { ChildForm } from "@/components/child-form";
import { ChildPhotoEditor } from "@/components/child-photo-editor";
import { setEmailConsent } from "@/app/actions/settings";
import { requireUser } from "@/lib/auth";
import { CONTACT_EMAIL, contactHref } from "@/lib/contact";
import { earliestBirthDate } from "@/lib/child-validation";
import { requireChild } from "@/lib/children";
import { getMyEmailConsent } from "@/lib/email-consent";
import { getChildPhotoUrl } from "@/lib/photos";
import { formatAge, formatKoreanDate, todayKst } from "@/lib/date";

export const metadata = { title: "프로필 · Hello Archive jr" };

// 자녀 정보 조회·수정, 주간 이메일 수신 설정, 로그아웃이 동작한다.
// 의견·데이터 삭제 요청은 앱 기능이 아니라 문의 메일(mailto)로 받고 운영자가 수동 처리한다 (BETA.md 7절).
export default function ProfilePage(props: PageProps<"/profile">) {
  return (
    <>
      <header>
        <Eyebrow>Profile</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl font-bold">프로필</h1>
      </header>

      <Suspense fallback={<PageSkeleton rows={1} />}>
        <ChildSection searchParams={props.searchParams} />
      </Suspense>

      <Suspense fallback={<PageSkeleton rows={1} />}>
        <EmailSection searchParams={props.searchParams} />
      </Suspense>

      <section aria-labelledby="account" className="flex flex-col gap-2">
        <h2
          id="account"
          className="border-b border-ink pb-2 font-serif text-lg font-bold"
        >
          계정
        </h2>
        <Suspense fallback={<p className="mt-2 text-sm text-ink-mute">불러오는 중…</p>}>
          <SignedInAs />
        </Suspense>
        <form action={signOut}>
          <button
            type="submit"
            className="min-h-12 w-full border border-ink px-5 text-left font-semibold hover:bg-ink hover:text-paper"
          >
            로그아웃
          </button>
        </form>
        <a
          href={contactHref("[Hello Archive jr] 의견 보내기")}
          className="flex min-h-12 items-center px-1 text-sm text-ink-soft underline underline-offset-4"
        >
          의견 보내기
        </a>
        <a
          href={contactHref("[Hello Archive jr] 데이터 삭제 요청")}
          className="flex min-h-12 items-center px-1 text-sm text-ink-soft underline underline-offset-4"
        >
          데이터 삭제 요청
        </a>
        <p className="px-1 text-xs leading-relaxed text-ink-mute">
          메일로 보내 주시면 확인 후 처리해 드려요. 문의 {CONTACT_EMAIL}
        </p>
        <nav aria-label="약관" className="flex flex-wrap gap-x-5 px-1 text-sm text-ink-soft">
          <Link href="/terms" className="flex min-h-12 items-center underline underline-offset-4 hover:text-brand">
            이용약관
          </Link>
          <Link href="/privacy" className="flex min-h-12 items-center underline underline-offset-4 hover:text-brand">
            개인정보 처리방침
          </Link>
        </nav>
      </section>
    </>
  );
}

// 로그인한 이메일 표시. 쿠키를 읽으므로 Suspense 안에서 렌더링한다.
async function SignedInAs() {
  const user = await requireUser();
  return (
    <p className="mt-2 text-sm text-ink-soft">
      로그인한 이메일 <span className="font-semibold text-ink break-all">{user.email}</span>
    </p>
  );
}

// 자녀 정보: 읽기 화면 ↔ 수정 폼(?edit=1). 서버가 로그인한 부모의 자녀만 읽는다.
async function ChildSection({
  searchParams,
}: {
  searchParams: PageProps<"/profile">["searchParams"];
}) {
  const child = await requireChild("/profile");
  const { edit, saved } = await searchParams;
  const today = todayKst();
  const editing = edit === "1";
  const photoUrl = await getChildPhotoUrl(child.photoPath);

  return (
    <section aria-labelledby="child">
      <h2
        id="child"
        className="border-b border-ink pb-2 font-serif text-lg font-bold"
      >
        아이
      </h2>
      <ChildPhotoEditor nickname={child.nickname} photoUrl={photoUrl} />
      {editing ? (
        <div className="mt-5">
          <ChildForm
            mode="update"
            initial={{ nickname: child.nickname, birthDate: child.birthDate }}
            min={earliestBirthDate(today)}
            max={today}
          />
        </div>
      ) : (
        <>
          {saved === "1" && (
            <p role="status" className="mt-4 border-l-4 border-brand bg-sheet px-4 py-3 text-sm">
              저장했어요.
            </p>
          )}
          <dl className="divide-y divide-line">
            <div className="grid grid-cols-[5.5rem_1fr] gap-4 py-4">
              <dt className="text-ink-soft">별명</dt>
              <dd className="font-serif font-semibold break-all">{child.nickname}</dd>
            </div>
            <div className="grid grid-cols-[5.5rem_1fr] gap-4 py-4">
              <dt className="text-ink-soft">생년월일</dt>
              <dd className="font-serif">
                {formatKoreanDate(`${child.birthDate}T00:00:00+09:00`)}
                <span className="ml-2 text-sm text-ink-soft">
                  {formatAge(child.birthDate, today)}
                </span>
              </dd>
            </div>
          </dl>
          <Link
            href="/profile?edit=1"
            className="mt-2 flex min-h-12 w-full items-center justify-between border border-ink px-5 font-semibold hover:bg-ink hover:text-paper"
          >
            수정하기
            <span aria-hidden>↗</span>
          </Link>
        </>
      )}
    </section>
  );
}

// 주간 이메일 수신 설정. 기본은 받지 않음이고, 켜면 다음 월요일(저녁 7시 무렵)부터 온다 (D-022).
async function EmailSection({
  searchParams,
}: {
  searchParams: PageProps<"/profile">["searchParams"];
}) {
  const consent = await getMyEmailConsent();
  const { consent: result } = await searchParams;

  return (
    <section aria-labelledby="email">
      <h2 id="email" className="border-b border-ink pb-2 font-serif text-lg font-bold">
        주간 질문 이메일
      </h2>
      {result === "error" && (
        <p role="alert" className="mt-4 border-l-4 border-brand bg-sheet px-4 py-3 text-sm">
          저장하지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
      {(result === "on" || result === "off") && (
        <p role="status" className="mt-4 border-l-4 border-brand bg-sheet px-4 py-3 text-sm">
          {result === "on"
            ? "수신을 켰어요. 다음 월요일 저녁부터 이번 주 질문을 보내 드려요."
            : "수신을 껐어요."}
        </p>
      )}
      <p className="mt-4 leading-relaxed text-ink-soft">
        {consent
          ? "받는 중이에요. 매주 월요일 저녁 7시 무렵에 이번 주 질문을 보내 드려요."
          : "받지 않고 있어요. 켜면 매주 월요일 저녁 7시 무렵에 이번 주 질문을 보내 드려요."}
      </p>
      <form action={setEmailConsent} className="mt-4">
        <input type="hidden" name="consent" value={consent ? "0" : "1"} />
        <button
          type="submit"
          className="flex min-h-12 w-full items-center justify-between border border-ink px-5 font-semibold hover:bg-ink hover:text-paper"
        >
          {consent ? "이메일 받지 않기" : "이메일 받기"}
          <span aria-hidden>↗</span>
        </button>
      </form>
    </section>
  );
}
