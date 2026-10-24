// 기록 본문 검증. Next.js에 묶이지 않는 순수 함수라 서버 액션(웹)과 이후 앱에서 함께 쓸 수 있다 (D-015).
// DB 제약(`entries_body_length`: 공백만 불가, 원본 5000자 이하)과 같은 기준이며, DB는 최종 방어선이다.

export const ENTRY_BODY_MAX_LENGTH = 5000;

// 공백으로 보이지 않는 글자가 하나라도 있어야 한다 (DB의 정규식 검사와 같은 기준: 공백·전각 공백·NBSP·zero-width space 제외).
const HAS_VISIBLE_CHAR = /[^\s​]/u;

export type EntryBodyValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** 입력 본문을 검증하고 앞뒤 공백을 지운다. 길이는 사용자가 보는 글자 수(이모지 1자)로 센다. */
export function validateEntryBody(raw: unknown): EntryBodyValidation {
  const body = typeof raw === "string" ? raw.trim() : "";
  if (!body || !HAS_VISIBLE_CHAR.test(body)) {
    return { ok: false, error: "내용을 입력해 주세요." };
  }
  if ([...body].length > ENTRY_BODY_MAX_LENGTH) {
    return {
      ok: false,
      error: `${ENTRY_BODY_MAX_LENGTH.toLocaleString("ko-KR")}자 이하로 줄여 주세요.`,
    };
  }
  return { ok: true, value: body };
}
