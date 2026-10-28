import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ageInYearsAt, isLifeStage, LIFE_STAGE_KEYS, stageAt, stageOfAge, stageLabel } from "./life-stage.ts";

describe("만 나이 (기준일)", () => {
  it("생일 전에는 한 살 적다", () => {
    assert.equal(ageInYearsAt("2022-05-14", "2026-05-13"), 3);
    assert.equal(ageInYearsAt("2022-05-14", "2026-05-14"), 4);
    assert.equal(ageInYearsAt("2022-05-14", "2026-12-31"), 4);
  });

  it("태어나기 전 날짜는 0세로 본다", () => {
    assert.equal(ageInYearsAt("2022-05-14", "2020-01-06"), 0);
  });

  it("윤일 생일은 평년에는 3월 1일에 한 살을 더한다(2월 28일까지는 전)", () => {
    assert.equal(ageInYearsAt("2020-02-29", "2025-02-28"), 4);
    assert.equal(ageInYearsAt("2020-02-29", "2025-03-01"), 5);
  });
});

describe("시기 구간", () => {
  it("만 6세까지 유년, 7~12 아동, 13~18 청소년, 19 이상 청년", () => {
    assert.equal(stageOfAge(0), "early");
    assert.equal(stageOfAge(6), "early");
    assert.equal(stageOfAge(7), "child");
    assert.equal(stageOfAge(12), "child");
    assert.equal(stageOfAge(13), "teen");
    assert.equal(stageOfAge(18), "teen");
    assert.equal(stageOfAge(19), "young");
    assert.equal(stageOfAge(40), "young");
  });

  it("질문이 나오는 주의 만 나이로 정한다: 7번째 생일이 주 중간이어도 그 주 월요일 기준이면 아직 유년", () => {
    // 2026-10-28(수)이 7번째 생일. 그 주 월요일(10/26)은 아직 만 6세.
    assert.equal(stageAt("2019-10-28", "2026-10-26"), "early");
    // 다음 주 월요일(11/2)부터 아동.
    assert.equal(stageAt("2019-10-28", "2026-11-02"), "child");
  });

  it("시기 키는 DB 제약과 같은 4개이고 라벨이 있다", () => {
    assert.deepEqual(LIFE_STAGE_KEYS, ["early", "child", "teen", "young"]);
    assert.deepEqual(LIFE_STAGE_KEYS.map(stageLabel), ["유년", "아동", "청소년", "청년"]);
    assert.equal(isLifeStage("teen"), true);
    assert.equal(isLifeStage("adult"), false);
  });
});
