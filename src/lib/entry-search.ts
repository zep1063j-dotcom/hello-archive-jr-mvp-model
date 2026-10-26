// 기록 검색어 정리. Next.js에 묶이지 않는 순수 TS (D-015). 정책은 D-024.
// 본문에서 검색어가 들어 있는 기록을 찾는다(대소문자 무시 부분 일치). 검색어는 그대로 로그·분석에 보내지 않는다.

export const SEARCH_QUERY_MAX_LENGTH = 50;

/** 쿼리스트링 값(문자열/배열/없음)을 검색어로. 비었으면 null. 연속 공백은 하나로, 최대 길이로 자른다. */
export function normalizeSearchQuery(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/gu, " ").trim().slice(0, SEARCH_QUERY_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/** LIKE 패턴의 와일드카드(`%`, `_`)와 이스케이프(`\`)를 글자 그대로 찾도록 막고 앞뒤에 `%`를 붙인다. */
export function toLikePattern(query: string): string {
  return `%${query.replace(/[\\%_]/gu, (char) => `\\${char}`)}%`;
}
