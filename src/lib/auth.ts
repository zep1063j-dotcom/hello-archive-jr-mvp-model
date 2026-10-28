import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// 로그인 후 돌아갈 수 있는 경로. 외부 주소·로그인 페이지로의 이탈(open redirect)을 막기 위해
// 앱 안의 보호 화면만 허용한다.
const SAFE_NEXT_PREFIXES = ["/home", "/write", "/archive", "/profile", "/yearly"];
export const DEFAULT_AFTER_LOGIN = "/home";

export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return DEFAULT_AFTER_LOGIN;
  // 경로만 허용: "/"로 시작, "//"(프로토콜 상대 URL)·역슬래시·제어문자 불가
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) {
    return DEFAULT_AFTER_LOGIN;
  }
  const pathname = next.split(/[?#]/)[0];
  const allowed = SAFE_NEXT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return allowed ? next : DEFAULT_AFTER_LOGIN;
}

/** 로그인 화면 주소 (돌아올 경로 포함) */
export function loginUrl(next?: string) {
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}

/**
 * 현재 로그인한 부모를 서버에서 확인한다. 쿠키 값을 믿지 않고 Auth 서버에 검증한다.
 * 로그인하지 않았으면 /login으로 보낸다. 권한이 필요한 서버 코드는 이 함수를 먼저 부른다.
 * (쿠키를 읽으므로 Suspense 경계 안에서 호출해야 한다.)
 */
// 한 화면을 그리는 동안 여러 조회 함수가 각자 부르므로, 같은 요청 안에서는 Auth 서버 왕복을 한 번만 한다 (React cache).
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect("/login");
  }
  return data.user;
});
