// 공개 화면 방문 측정(GA4)의 순수 규칙 (D-035). Next.js·브라우저에 묶이지 않는 순수 TS (D-015).
//  - 측정하는 화면은 로그인 전 공개 화면뿐이다: 소개(`/`), 로그인(`/login`), 이용약관(`/terms`), 개인정보 처리방침(`/privacy`).
//  - 로그인 이후 앱 화면(홈·아카이브·기록 상세 등)은 주소에 기록 id가 들어가고 기록·자녀 정보가 닿으므로 측정하지 않는다.
//  - 보내는 주소에서는 광고 유입 구분에 필요한 `utm_*` 말고는 쿼리를 버린다 (예: 로그인 후 이동 경로 `next`).

const TRACKED_PATHS: ReadonlySet<string> = new Set(["/", "/login", "/terms", "/privacy"]);

/** 측정해도 되는 화면인지 */
export function isTrackedPath(pathname: string): boolean {
  return TRACKED_PATHS.has(pathname);
}

/** 쿼리에서 `utm_*`만 남긴 문자열 ("?utm_source=meta" 또는 ""). */
export function trackedQuery(search: string): string {
  const kept = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(search)) {
    if (key.startsWith("utm_") && value.length <= 100) kept.append(key, value);
  }
  const text = kept.toString();
  return text ? `?${text}` : "";
}

/** GA4에 보낼 page_location. 측정하지 않는 화면이면 null. */
export function pageLocation(origin: string, pathname: string, search: string): string | null {
  if (!isTrackedPath(pathname)) return null;
  return `${origin}${pathname}${trackedQuery(search)}`;
}
