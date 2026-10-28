// 환영 온보딩 시작 단계 규칙 (D-040). 실행: npm run test:unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideOnboardingStep } from "./onboarding-rules.ts";

describe("환영 온보딩 시작 단계", () => {
  it("아이가 없으면 상태와 상관없이 처음(welcome)부터", () => {
    assert.equal(decideOnboardingStep(false, { kind: "row", completedAt: null }), "welcome");
    assert.equal(decideOnboardingStep(false, { kind: "no-row" }), "welcome");
    assert.equal(decideOnboardingStep(false, { kind: "column-missing" }), "welcome");
  });

  it("아이를 등록했지만 완료 전이면 마지막 환영 창(finish)부터 이어간다 — 아이를 다시 만들지 않는다", () => {
    assert.equal(decideOnboardingStep(true, { kind: "row", completedAt: null }), "finish");
    assert.equal(decideOnboardingStep(true, { kind: "no-row" }), "finish");
  });

  it("완료한 계정과 기존 사용자(마이그레이션이 완료로 채움)에게는 온보딩이 없다", () => {
    assert.equal(decideOnboardingStep(true, { kind: "row", completedAt: "2026-10-28T01:00:00Z" }), null);
  });

  it("완료 시각 컬럼이 없는 DB(마이그레이션 전)에서도 아이가 있는 기존 사용자는 방해받지 않는다", () => {
    assert.equal(decideOnboardingStep(true, { kind: "column-missing" }), null);
  });
});
