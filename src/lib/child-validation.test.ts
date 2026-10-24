// 자녀 입력 검증 단위 테스트 (SESSION 04). 실행: npm run test:unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  earliestBirthDate,
  isValidDateKey,
  validateChildInput,
} from "./child-validation.ts";

const TODAY = "2026-10-24";

function check(nickname: unknown, birthDate: unknown) {
  return validateChildInput({ nickname, birthDate }, TODAY);
}

describe("별명", () => {
  it("앞뒤 공백은 지우고 통과한다", () => {
    const result = check("  콩이  ", "2022-05-14");
    assert.deepEqual(result, { ok: true, value: { nickname: "콩이", birthDate: "2022-05-14" } });
  });

  for (const [label, value] of [
    ["빈 문자열", ""],
    ["스페이스만", "   "],
    ["줄바꿈·탭만", "\n\t \n"],
    ["전각 공백만", "　　"],
    ["NBSP만", "  "],
    ["zero-width space만", "​​"],
    ["문자열이 아닌 값", null],
  ] as const) {
    it(`${label}은 거부한다`, () => {
      const result = check(value, "2022-05-14");
      assert.equal(result.ok, false);
      assert.ok(!result.ok && result.fieldErrors.nickname);
    });
  }

  it("30자는 통과하고 31자는 거부한다 (이모지도 1글자로 센다)", () => {
    assert.equal(check("가".repeat(30), "2022-05-14").ok, true);
    assert.equal(check("😀".repeat(30), "2022-05-14").ok, true);
    assert.equal(check("가".repeat(31), "2022-05-14").ok, false);
  });

  it("가운데 줄바꿈 같은 제어 문자는 거부한다", () => {
    assert.equal(check("콩\n이", "2022-05-14").ok, false);
  });
});

describe("생년월일", () => {
  it("오늘은 통과하고 내일은 거부한다", () => {
    assert.equal(check("콩이", TODAY).ok, true);
    const result = check("콩이", "2026-10-25");
    assert.ok(!result.ok && result.fieldErrors.birthDate);
  });

  it("달력에 없는 날짜·형식 오류는 거부한다", () => {
    for (const value of ["2026-02-30", "2025-13-01", "2022-5-14", "20220514", "abc", ""]) {
      const result = check("콩이", value);
      assert.ok(!result.ok && result.fieldErrors.birthDate, value);
    }
  });

  it("윤일은 윤년에만 통과한다", () => {
    assert.equal(isValidDateKey("2024-02-29"), true);
    assert.equal(isValidDateKey("2023-02-29"), false);
  });

  it("18년보다 오래된 날짜는 거부한다 (경계 포함)", () => {
    assert.equal(earliestBirthDate(TODAY), "2008-10-24");
    assert.equal(check("콩이", "2008-10-24").ok, true);
    assert.equal(check("콩이", "2008-10-23").ok, false);
    assert.equal(check("콩이", "1922-01-01").ok, false);
  });

  it("문자열이 아닌 값은 거부한다", () => {
    assert.equal(check("콩이", undefined).ok, false);
  });
});

describe("여러 오류", () => {
  it("별명과 생년월일 오류를 함께 돌려준다", () => {
    const result = check("", "2999-01-01");
    assert.ok(!result.ok && result.fieldErrors.nickname && result.fieldErrors.birthDate);
  });
});
