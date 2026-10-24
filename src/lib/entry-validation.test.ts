// 기록 본문 검증·주차 계산 단위 테스트 (SESSION 05). 실행: npm run test:unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { weekStartOf } from "./date.ts";
import { ENTRY_BODY_MAX_LENGTH, validateEntryBody } from "./entry-validation.ts";

describe("기록 본문", () => {
  it("앞뒤 공백은 지우고 줄바꿈은 가운데에 유지한다", () => {
    assert.deepEqual(validateEntryBody("  첫 줄\n둘째 줄 \n"), {
      ok: true,
      value: "첫 줄\n둘째 줄",
    });
  });

  for (const [label, value] of [
    ["빈 문자열", ""],
    ["스페이스만", "   "],
    ["줄바꿈·탭만", "\n\t \n"],
    ["전각 공백만", "　　"],
    ["NBSP만", "  "],
    ["zero-width space만", "​​"],
    ["문자열이 아닌 값", null],
  ] as const) {
    it(`${label}은 거부한다`, () => {
      assert.equal(validateEntryBody(value).ok, false);
    });
  }

  it("5000자는 통과하고 5001자는 거부한다 (이모지도 1글자로 센다)", () => {
    assert.equal(validateEntryBody("가".repeat(ENTRY_BODY_MAX_LENGTH)).ok, true);
    assert.equal(validateEntryBody("😀".repeat(ENTRY_BODY_MAX_LENGTH)).ok, true);
    assert.equal(validateEntryBody("가".repeat(ENTRY_BODY_MAX_LENGTH + 1)).ok, false);
  });
});

describe("주 시작일(한국 시간 월요일)", () => {
  for (const [label, today, expected] of [
    ["월요일은 그대로", "2026-10-19", "2026-10-19"],
    ["수요일", "2026-10-21", "2026-10-19"],
    ["일요일은 그 주의 월요일", "2026-10-25", "2026-10-19"],
    ["다음 월요일", "2026-10-26", "2026-10-26"],
    ["월 경계를 넘는 주", "2026-11-01", "2026-10-26"],
    ["연 경계를 넘는 주", "2027-01-01", "2026-12-28"],
    ["윤일 주", "2028-02-29", "2028-02-28"],
  ] as const) {
    it(label, () => {
      assert.equal(weekStartOf(today), expected);
    });
  }
});
