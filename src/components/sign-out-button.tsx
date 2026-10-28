"use client";

import { signOut } from "@/app/actions/auth";
import { clearAllDrafts } from "@/lib/draft-store";

// 로그아웃: 이 기기에 남은 작성 중인 글(초안)도 함께 지워 다음 사용자에게 남지 않게 한다 (D-041).
export function SignOutButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <form action={signOut} onSubmit={clearAllDrafts}>
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
