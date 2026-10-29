// 로그인 복귀 경로의 순수 규칙. URL의 ../ 등을 정리한 실제 목적지가 앱 안인지 확인한다.
const SAFE_NEXT_PREFIXES = ["/home", "/write", "/archive", "/profile", "/yearly", "/make"];
export const DEFAULT_AFTER_LOGIN = "/home";

export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) {
    return DEFAULT_AFTER_LOGIN;
  }
  const url = new URL(next, "https://internal.invalid");
  const allowed = SAFE_NEXT_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
  return allowed ? `${url.pathname}${url.search}${url.hash}` : DEFAULT_AFTER_LOGIN;
}
