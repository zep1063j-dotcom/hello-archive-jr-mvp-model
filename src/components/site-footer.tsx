import Link from "next/link";
import { CONTACT_EMAIL, contactHref } from "@/lib/contact";

// 공개 화면(소개·로그인·약관) 맨 아래. 약관·처리방침 링크와 문의 창구. 앱 안에서는 프로필 화면 아래에 같은 링크가 있다.
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-5 py-6 text-xs text-ink-mute md:px-6">
        <nav aria-label="약관 및 문의" className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/terms" className="flex min-h-10 items-center underline underline-offset-4 hover:text-brand">
            이용약관
          </Link>
          <Link href="/privacy" className="flex min-h-10 items-center underline underline-offset-4 hover:text-brand">
            개인정보 처리방침
          </Link>
          <a
            href={contactHref("[Hello Archive jr] 문의")}
            className="flex min-h-10 items-center underline underline-offset-4 hover:text-brand"
          >
            문의 {CONTACT_EMAIL}
          </a>
        </nav>
        <p>© Hello Archive jr</p>
      </div>
    </footer>
  );
}
