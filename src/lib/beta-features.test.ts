// 베타 전 추가 기능(지난 질문 쓰기·기록 검색·수신 거부 링크)의 순수 규칙 테스트 (D-024). 실행: npm run test:unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSearchQuery, SEARCH_QUERY_MAX_LENGTH, toLikePattern } from "./entry-search.ts";
import { isPastQuestionAnswerable, joinedWeekStart, missedQuestions } from "./past-questions.ts";
import {
  buildUnsubscribeUrl,
  isUserId,
  signUnsubscribe,
  unsubscribeWithToken,
  verifyUnsubscribe,
} from "./unsubscribe.ts";
import { buildWeeklyEmail } from "./weekly-email.ts";

describe("지난 질문 쓰기 규칙", () => {
  it("자녀를 등록한 주(KST 월요일)를 구한다 — 일요일 밤은 그 주, 월요일 0시 직후는 새 주", () => {
    // 2026-10-25(일) 23:30 KST = 14:30Z → 주 시작 2026-10-19
    assert.equal(joinedWeekStart("2026-10-25T14:30:00Z"), "2026-10-19");
    // 2026-10-26(월) 00:10 KST = 2026-10-25T15:10Z → 주 시작 2026-10-26
    assert.equal(joinedWeekStart("2026-10-25T15:10:00Z"), "2026-10-26");
  });

  it("등록한 주 이후 ~ 지난주만 쓸 수 있다. 이번 주·미래·등록 전은 안 된다", () => {
    const base = { thisWeekStart: "2026-11-09", joinedWeekStart: "2026-10-26" };
    const can = (questionWeekStart: string) =>
      isPastQuestionAnswerable({ ...base, questionWeekStart });
    assert.equal(can("2026-11-02"), true); // 지난주
    assert.equal(can("2026-10-26"), true); // 등록한 주 (경계 포함)
    assert.equal(can("2026-10-19"), false); // 등록 전
    assert.equal(can("2026-11-09"), false); // 이번 주는 기존 흐름
    assert.equal(can("2026-11-16"), false); // 미래
  });

  it("놓친 질문은 답하지 않은 것만, 최근 주 먼저 나온다", () => {
    const questions = [
      { id: "a", weekStart: "2026-10-26" },
      { id: "b", weekStart: "2026-11-02" },
      { id: "c", weekStart: "2026-11-09" },
      { id: "d", weekStart: "2026-10-19" },
    ];
    const missed = missedQuestions({
      questions,
      answeredQuestionIds: new Set(["a"]),
      thisWeekStart: "2026-11-09",
      joinedWeekStart: "2026-10-26",
    });
    assert.deepEqual(
      missed.map((q) => q.id),
      ["b"],
    );
  });

  it("가입 주에는 놓친 질문이 없다", () => {
    const missed = missedQuestions({
      questions: [{ id: "a", weekStart: "2026-10-19" }],
      answeredQuestionIds: new Set(),
      thisWeekStart: "2026-10-26",
      joinedWeekStart: "2026-10-26",
    });
    assert.deepEqual(missed, []);
  });
});

describe("기록 검색어", () => {
  it("공백을 정리하고 비면 null", () => {
    assert.equal(normalizeSearchQuery("  첫   걸음 "), "첫 걸음");
    assert.equal(normalizeSearchQuery("   "), null);
    assert.equal(normalizeSearchQuery(undefined), null);
    assert.equal(normalizeSearchQuery(["공룡", "다른"]), "공룡");
  });

  it("너무 길면 자른다", () => {
    assert.equal(normalizeSearchQuery("가".repeat(500))?.length, SEARCH_QUERY_MAX_LENGTH);
  });

  it("LIKE 와일드카드는 글자 그대로 찾는다", () => {
    assert.equal(toLikePattern("공룡"), "%공룡%");
    assert.equal(toLikePattern("100%"), "%100\\%%");
    assert.equal(toLikePattern("a_b"), "%a\\_b%");
    assert.equal(toLikePattern("a\\b"), "%a\\\\b%");
  });
});

describe("수신 거부 링크", () => {
  const SECRET = "test-secret-not-real";
  const USER = "11111111-2222-3333-4444-555555555555";
  const OTHER = "11111111-2222-3333-4444-555555555556";

  it("서명은 부모 id·키에 묶인다", () => {
    const token = signUnsubscribe(USER, SECRET);
    assert.equal(verifyUnsubscribe(USER, token, SECRET), true);
    assert.equal(verifyUnsubscribe(OTHER, token, SECRET), false); // 다른 부모에게 재사용 불가
    assert.equal(verifyUnsubscribe(USER, token, "other-secret"), false);
    assert.equal(verifyUnsubscribe(USER, token.slice(0, -1) + "0", SECRET), false);
    assert.equal(verifyUnsubscribe(USER, "", SECRET), false);
    assert.equal(verifyUnsubscribe(USER, token, ""), false); // 키가 없으면 항상 거부
    assert.equal(verifyUnsubscribe("not-a-uuid", token, SECRET), false);
  });

  it("대문자 id도 같은 서명으로 본다", () => {
    const token = signUnsubscribe(USER, SECRET);
    assert.equal(verifyUnsubscribe(USER.toUpperCase(), token, SECRET), true);
  });

  it("링크 모양: 로그인 토큰이 아니라 id와 서명만 담는다", () => {
    const url = new URL(buildUnsubscribeUrl("https://example.test", USER, SECRET));
    assert.equal(url.origin + url.pathname, "https://example.test/unsubscribe");
    assert.deepEqual([...url.searchParams.keys()].sort(), ["t", "u"]);
    assert.equal(url.searchParams.get("u"), USER);
    assert.equal(isUserId(url.searchParams.get("u")!), true);
  });

  it("잘못된 서명이면 DB를 건드리지 않는다", async () => {
    let touched = false;
    const db = {
      from() {
        touched = true;
        throw new Error("호출되면 안 된다");
      },
    } as never;
    const result = await unsubscribeWithToken({ db, userId: USER, token: "bad", secret: SECRET });
    assert.deepEqual(result, { ok: false, reason: "invalid" });
    assert.equal(touched, false);
  });
});

describe("주간 메일 본문의 수신 거부", () => {
  it("수신 거부 링크가 html·text에 들어가고 프로필 링크도 남는다", () => {
    const mail = buildWeeklyEmail({
      questionBody: "질문",
      hint: null,
      appUrl: "https://example.test",
      unsubscribeUrl: "https://example.test/unsubscribe?u=x&t=y",
    });
    assert.ok(mail.html.includes("https://example.test/unsubscribe?u=x&amp;t=y"));
    assert.ok(mail.text.includes("https://example.test/unsubscribe?u=x&t=y"));
    assert.ok(mail.html.includes("https://example.test/profile"));
  });
});

import {
  applyChoice,
  CUSTOM_QUESTION_MAX_LENGTH,
  emojiForQuestion,
  pickRandomBankQuestion,
  validateCustomQuestion,
} from "./question-choice-rules.ts";

describe("직접 쓴 질문 검증", () => {
  it("공백을 정리하고 한 줄로 만든다", () => {
    assert.deepEqual(validateCustomQuestion("  요즘   아이가\n좋아하는 건? "), {
      ok: true,
      value: "요즘 아이가 좋아하는 건?",
    });
  });
  it("비었거나 공백뿐이면 거부", () => {
    for (const raw of ["", "   ", "\n\t", "　", undefined, 5]) {
      assert.equal(validateCustomQuestion(raw).ok, false);
    }
  });
  it("100자까지, 초과는 거부", () => {
    assert.equal(validateCustomQuestion("가".repeat(CUSTOM_QUESTION_MAX_LENGTH)).ok, true);
    assert.equal(validateCustomQuestion("가".repeat(CUSTOM_QUESTION_MAX_LENGTH + 1)).ok, false);
  });
});

describe("은행에서 질문 고르기", () => {
  const bank = [
    { id: "1", body: "하나" },
    { id: "2", body: "둘" },
    { id: "3", body: "셋" },
  ];
  it("제외한 문구는 피하고 현재 질문은 고르지 않는다", () => {
    for (let i = 0; i < 20; i++) {
      const picked = pickRandomBankQuestion({
        bank,
        excludeBodies: new Set(["하나", "둘"]),
        currentBody: "하나",
        random: () => i / 20,
      });
      assert.equal(picked?.id, "3");
    }
  });
  it("전부 제외되면 현재 질문만 피한다", () => {
    const picked = pickRandomBankQuestion({
      bank,
      excludeBodies: new Set(["하나", "둘", "셋"]),
      currentBody: "하나",
      random: () => 0,
    });
    assert.notEqual(picked?.body, "하나");
  });
  it("고를 것이 없으면 null (은행이 비었거나 현재 질문뿐)", () => {
    assert.equal(pickRandomBankQuestion({ bank: [], excludeBodies: new Set(), currentBody: "x" }), null);
    assert.equal(
      pickRandomBankQuestion({ bank: [bank[0]], excludeBodies: new Set(), currentBody: "하나" }),
      null,
    );
  });
  it("random이 1에 가까워도 범위를 넘지 않는다", () => {
    const picked = pickRandomBankQuestion({
      bank,
      excludeBodies: new Set(),
      currentBody: "",
      random: () => 0.9999999,
    });
    assert.equal(picked?.id, "3");
  });
});

describe("질문 바꾸기 표시", () => {
  const base = { id: "q", weekStart: "2026-10-26", body: "기본 질문", hint: "도움말" };
  it("선택이 없으면 그대로, 있으면 문구·출처만 바뀌고 주 id는 유지한다", () => {
    assert.equal(applyChoice(base, undefined), base);
    const changed = applyChoice(base, { source: "custom", body: "내 질문" });
    assert.deepEqual(changed, { id: "q", weekStart: "2026-10-26", body: "내 질문", source: "custom" });
  });
  it("질문마다 같은 이모티콘이 나오고 값이 비어 있지 않다", () => {
    assert.equal(emojiForQuestion("a"), emojiForQuestion("a"));
    const seen = new Set(["가", "나", "다", "라", "마", "바", "사", "아"].map(emojiForQuestion));
    assert.ok(seen.size > 1);
    for (const emoji of seen) assert.ok(emoji.length > 0);
  });
});

import {
  groupAnswersByQuestion,
  isYearlyKey,
  validateYearlyAnswer,
  YEARLY_ANSWER_MAX_LENGTH,
  YEARLY_QUESTIONS,
  yearOfDateKey,
} from "./yearly-questions.ts";

describe("매년 같은 질문", () => {
  it("질문 키는 서로 다르고 DB 키 형식(소문자·숫자·밑줄)을 따른다", () => {
    const keys = YEARLY_QUESTIONS.map((q) => q.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const key of keys) assert.match(key, /^[a-z][a-z0-9_]{0,29}$/);
    assert.equal(isYearlyKey("growth"), true);
    assert.equal(isYearlyKey("nope"), false);
  });

  it("연도는 날짜 문자열에서 읽는다", () => {
    assert.equal(yearOfDateKey("2026-12-31"), 2026);
  });

  it("빈 답은 '답하지 않음'(null), 줄바꿈은 유지, 길이 초과는 거부", () => {
    assert.deepEqual(validateYearlyAnswer(""), { ok: true, value: null });
    assert.deepEqual(validateYearlyAnswer("  \n "), { ok: true, value: null });
    assert.deepEqual(validateYearlyAnswer(null), { ok: true, value: null });
    assert.deepEqual(validateYearlyAnswer(" 키 100cm\n몸무게 16kg "), { ok: true, value: "키 100cm\n몸무게 16kg" });
    assert.equal(validateYearlyAnswer("가".repeat(YEARLY_ANSWER_MAX_LENGTH)).ok, true);
    assert.equal(validateYearlyAnswer("가".repeat(YEARLY_ANSWER_MAX_LENGTH + 1)).ok, false);
    assert.equal(validateYearlyAnswer(5).ok, false);
  });

  it("질문별로 묶고 최근 해 먼저, 목록에 없는 옛 키도 버리지 않는다", () => {
    const groups = groupAnswersByQuestion([
      { year: 2026, questionKey: "growth", body: "새 답" },
      { year: 2027, questionKey: "growth", body: "더 새 답" },
      { year: 2026, questionKey: "retired_q", body: "옛 질문 답" },
    ]);
    assert.equal(groups.length, YEARLY_QUESTIONS.length + 1);
    assert.deepEqual(groups[0].answers.map((a) => a.year), [2027, 2026]);
    assert.deepEqual(groups[1].answers, []);
    assert.equal(groups.at(-1)?.key, "retired_q");
    assert.equal(groups.at(-1)?.retired, true);
    assert.equal(groups[0].retired, false);
    assert.equal(groups.at(-1)?.answers[0].body, "옛 질문 답");
  });
});

import {
  centerSquare,
  checkUpload,
  detectImageKind,
  fitWithin,
  isOwnPhotoPath,
  MAX_UPLOAD_BYTES,
  newPhotoPath,
} from "./photo-rules.ts";

const bytesOf = (head: number[], total = 64) => {
  const out = new Uint8Array(total);
  out.set(head);
  return out;
};
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

describe("사진 업로드 규칙", () => {
  it("파일 머리로 JPEG·PNG·WebP를 판별하고 나머지는 거부한다", () => {
    assert.equal(detectImageKind(bytesOf(JPEG)), "jpeg");
    assert.equal(detectImageKind(bytesOf(PNG)), "png");
    assert.equal(detectImageKind(bytesOf(WEBP)), "webp");
    assert.equal(detectImageKind(bytesOf([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), null); // GIF
    assert.equal(detectImageKind(bytesOf([0x3c, 0x73, 0x76, 0x67])), null); // SVG(스크립트 가능)
    assert.equal(detectImageKind(bytesOf([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])), null); // WAV
    assert.equal(detectImageKind(new Uint8Array(5)), null);
  });

  it("빈 파일·너무 큰 파일·형식 위반은 사용자 문구로 거부", () => {
    assert.equal(checkUpload(new Uint8Array(0)).ok, false);
    assert.equal(checkUpload(bytesOf(JPEG, MAX_UPLOAD_BYTES + 1)).ok, false);
    assert.equal(checkUpload(bytesOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).ok, false);
    assert.deepEqual(checkUpload(bytesOf(JPEG, MAX_UPLOAD_BYTES)), { ok: true, kind: "jpeg" });
  });

  it("경로는 내 폴더 안의 안전한 파일명만 허용한다", () => {
    const me = "11111111-2222-3333-4444-555555555555";
    const other = "99999999-2222-3333-4444-555555555555";
    assert.equal(isOwnPhotoPath(me, newPhotoPath(me, "abc-123", "jpeg")), true);
    assert.equal(newPhotoPath(me, "u1", "webp"), `${me}/u1.webp`);
    assert.equal(isOwnPhotoPath(me, `${other}/a.jpg`), false);
    assert.equal(isOwnPhotoPath(me, `${me}/../${other}/a.jpg`), false);
    assert.equal(isOwnPhotoPath(me, `${me}/sub/a.jpg`), false);
    assert.equal(isOwnPhotoPath(me, `${me}/`), false);
    assert.equal(isOwnPhotoPath(me, `${me}/a b.jpg`), false);
  });

  it("줄이기·정사각 잘라내기 계산", () => {
    assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 });
    assert.deepEqual(fitWithin(3000, 4000, 1600), { width: 1200, height: 1600 });
    assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 }); // 확대하지 않는다
    assert.deepEqual(centerSquare(4000, 3000), { x: 500, y: 0, size: 3000 });
    assert.deepEqual(centerSquare(300, 500), { x: 0, y: 100, size: 300 });
  });
});
