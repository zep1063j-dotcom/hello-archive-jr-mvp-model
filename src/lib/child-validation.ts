// 자녀 프로필 입력 검증. Next.js에 묶이지 않는 순수 함수라 서버 액션(웹)과 이후 앱에서 함께 쓸 수 있다 (D-015).
// DB 제약(별명 1~30자·공백만 불가, 생년월일 오늘 이후 불가)과 같은 기준이며, DB는 최종 방어선이다.

export const NICKNAME_MAX_LENGTH = 30;
// "어린 자녀" 서비스라 오타(예: 1922년)를 걸러내는 하한이다. 필요하면 늘린다.
export const MAX_CHILD_AGE_YEARS = 18;

export type ChildInput = { nickname: string; birthDate: string };

export type ChildFieldErrors = { nickname?: string; birthDate?: string };

export type ChildValidation =
  | { ok: true; value: ChildInput }
  | { ok: false; fieldErrors: ChildFieldErrors };

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
// 제어 문자(줄바꿈 포함)는 별명에 쓸 수 없다.
const CONTROL_CHARS = /\p{Cc}/u;
// 공백으로 보이지 않는 글자가 하나라도 있어야 한다 (DB의 정규식 검사와 같은 기준: 공백·전각 공백·NBSP·zero-width space 제외).
const HAS_VISIBLE_CHAR = /[^\s\u200B]/u;

/** YYYY-MM-DD가 실제 달력에 있는 날짜인지 (예: 2026-02-30은 거짓) */
export function isValidDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** 입력 가능한 가장 이른 생년월일 (today에서 MAX_CHILD_AGE_YEARS년 전, 문자열 비교용) */
export function earliestBirthDate(today: string): string {
  const [year, month, day] = today.split("-");
  return `${String(Number(year) - MAX_CHILD_AGE_YEARS).padStart(4, "0")}-${month}-${day}`;
}

/**
 * 폼 값(FormData에서 꺼낸 값)을 검증하고 정리한다.
 * today는 한국 시간 기준 오늘(YYYY-MM-DD)이다 — 호출하는 쪽이 넘긴다.
 */
export function validateChildInput(
  raw: { nickname: unknown; birthDate: unknown },
  today: string,
): ChildValidation {
  const fieldErrors: ChildFieldErrors = {};

  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : "";
  if (!nickname || !HAS_VISIBLE_CHAR.test(nickname)) {
    fieldErrors.nickname = "아이의 별명을 입력해 주세요.";
  } else if (CONTROL_CHARS.test(nickname)) {
    fieldErrors.nickname = "별명에 쓸 수 없는 문자가 있어요.";
  } else if ([...nickname].length > NICKNAME_MAX_LENGTH) {
    fieldErrors.nickname = `별명은 ${NICKNAME_MAX_LENGTH}자 이하로 입력해 주세요.`;
  }

  const birthDate = typeof raw.birthDate === "string" ? raw.birthDate.trim() : "";
  if (!birthDate) {
    fieldErrors.birthDate = "생년월일을 입력해 주세요.";
  } else if (!isValidDateKey(birthDate)) {
    fieldErrors.birthDate = "생년월일을 다시 확인해 주세요.";
  } else if (birthDate > today) {
    fieldErrors.birthDate = "오늘 이후의 날짜는 입력할 수 없어요.";
  } else if (birthDate < earliestBirthDate(today)) {
    fieldErrors.birthDate = `${MAX_CHILD_AGE_YEARS}년 이내에 태어난 아이만 등록할 수 있어요. 연도를 다시 확인해 주세요.`;
  }

  if (fieldErrors.nickname || fieldErrors.birthDate) {
    return { ok: false, fieldErrors };
  }
  return { ok: true, value: { nickname, birthDate } };
}
