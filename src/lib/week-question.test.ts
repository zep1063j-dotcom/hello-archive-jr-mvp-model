// 이번 주 카드의 질문과 저장된 기록의 질문 구분 (D-039). 실행: npm run test:unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { entryOfWeek, questionForWeekCard } from "./week-question.ts";
import type { Entry, WeeklyQuestion } from "../types/archive.ts";

const question = (id: string, weekStart: string, body: string): WeeklyQuestion => ({ id, weekStart, body });
const entry = (id: string, q: WeeklyQuestion, createdAt: string): Entry => ({
  id,
  question: q,
  body: `답 ${id}`,
  photos: [],
  createdAt,
  updatedAt: createdAt,
});

// 실제로 확인된 상황: 2026-10-26 주에 기록은 옛 질문 행(early)에 매달려 있고,
// 지금 아이의 시기(child) 질문 행에는 다른 질문이 추천된다.
const savedQuestion = question("early-1026", "2026-10-26", "세상에서 제일 무서운 게 뭐야? 그게 나타나면 어떻게 할 거야?");
const recommended = question("child-1026", "2026-10-26", "엄마(아빠)가 잔소리할 때 어떤 생각이 들어?");
const saved = entry("e1", savedQuestion, "2026-10-27T01:00:00Z");

describe("이번 주 카드의 질문", () => {
  it("기록이 있으면 추천 질문이 달라도 저장된 기록의 질문을 보인다", () => {
    assert.equal(questionForWeekCard(recommended, saved), savedQuestion);
  });

  it("기록이 없으면 지금 추천 질문을 보인다", () => {
    assert.equal(questionForWeekCard(recommended, null), recommended);
  });

  it("추천 질문이 없어도 기록이 있으면 기록의 질문으로 카드를 만든다", () => {
    assert.equal(questionForWeekCard(null, saved), savedQuestion);
    assert.equal(questionForWeekCard(null, null), null);
  });
});

describe("그 주의 기록 찾기", () => {
  it("질문 행의 시기가 달라도 같은 주면 그 기록을 찾는다", () => {
    const other = entry("e0", question("early-1019", "2026-10-19", "지난주 질문"), "2026-10-21T01:00:00Z");
    assert.equal(entryOfWeek([other, saved], "2026-10-26"), saved);
    assert.equal(entryOfWeek([other, saved], "2026-11-02"), null);
  });

  it("같은 주에 기록이 둘이면(예전 중복) 먼저 쓴 기록을 고른다", () => {
    const later = entry("e2", recommended, "2026-10-28T01:00:00Z");
    assert.equal(entryOfWeek([later, saved], "2026-10-26"), saved);
    assert.equal(entryOfWeek([saved, later], "2026-10-26"), saved);
  });
});
