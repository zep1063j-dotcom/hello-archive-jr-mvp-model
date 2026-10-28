// 로그인 코드 다시 받기 대기 시간 (D-044). 실행: npm run test:unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RESEND_WAIT_SECONDS, resendWaitSeconds } from "./resend-wait.ts";

describe("코드 다시 받기 대기", () => {
  const sentAt = 1_000_000;

  it("보낸 직후에는 전체 대기 시간이 남는다", () => {
    assert.equal(resendWaitSeconds(sentAt, sentAt), RESEND_WAIT_SECONDS);
  });

  it("시간이 지날수록 줄고 0 아래로 내려가지 않는다", () => {
    assert.equal(resendWaitSeconds(sentAt, sentAt + 1_000), RESEND_WAIT_SECONDS - 1);
    assert.equal(resendWaitSeconds(sentAt, sentAt + 59_999), 1);
    assert.equal(resendWaitSeconds(sentAt, sentAt + 60_000), 0);
    assert.equal(resendWaitSeconds(sentAt, sentAt + 600_000), 0);
  });

  it("시계가 어긋나 지금이 보낸 시각보다 이르게 보여도 대기 시간이 전체를 넘지 않는다", () => {
    assert.equal(resendWaitSeconds(sentAt, sentAt - 5_000), RESEND_WAIT_SECONDS);
  });

  it("보낸 시각이 없으면 기다리지 않는다", () => {
    assert.equal(resendWaitSeconds(undefined, sentAt), 0);
  });
});
