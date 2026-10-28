import Link from "next/link";
import { CONTACT_EMAIL, contactHref } from "@/lib/contact";

// 아이 등록·첫 기록 때 보여 주는 짧은 개인정보 안내. 실제 구현과 처리방침에 있는 사실만 쓴다:
//  - 기록·사진은 계정별로 분리되고(RLS) 다른 이용자에게 보이지 않는다.
//  - 삭제는 이메일 요청으로 처리한다(처리방침 7항).
// 운영자의 열람 범위처럼 정책으로 정해지지 않은 내용은 쓰지 않는다.
export function PrivacyNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[12px] leading-relaxed text-ink-soft ${className}`}>
      기록과 사진은 내 계정에만 저장되고 다른 이용자에게 보이지 않아요. 삭제하고 싶다면{" "}
      <a
        className="underline underline-offset-2 hover:text-brand"
        href={contactHref("[Hello Archive jr] 데이터 삭제 요청")}
      >
        {CONTACT_EMAIL}
      </a>
      로 요청해 주세요.{" "}
      <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-brand">
        개인정보 처리방침
      </Link>
    </p>
  );
}
