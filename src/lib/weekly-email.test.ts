// 주간 이메일 규칙 단위 테스트 (SESSION 07). 실행: npm run test:unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWeeklyEmail,
  decideDelivery,
  idempotencyKey,
  isEligible,
  MAX_ATTEMPTS,
  STALE_PROCESSING_MS,
  weeklySendTime,
} from "./weekly-email.ts";

const now = new Date("2026-10-26T10:30:00Z");

describe("발송 시각", () => {
  it("월요일 19:00 KST = 같은 날 10:00 UTC", () => {
    assert.equal(weeklySendTime("2026-10-26").toISOString(), "2026-10-26T10:00:00.000Z");
  });
});

describe("발송 기록 기반 판단 (멱등·보정)", () => {
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

  it("기록이 없으면 1번째 시도로 보낸다", () => {
    assert.deepEqual(decideDelivery(null, now), { action: "send", attempt: 1 });
  });

  for (const status of ["sent", "skipped"] as const) {
    it(`${status}는 다시 보내지 않는다`, () => {
      assert.deepEqual(
        decideDelivery({ status, attempts: 1, lastAttemptAt: minutesAgo(5) }, now),
        { action: "skip", reason: "done" },
      );
    });
  }

  it("failed는 시도 횟수를 늘려 다시 보낸다", () => {
    assert.deepEqual(
      decideDelivery({ status: "failed", attempts: 1, lastAttemptAt: minutesAgo(5) }, now),
      { action: "send", attempt: 2 },
    );
  });

  it(`failed가 ${MAX_ATTEMPTS}회에 이르면 더 보내지 않는다`, () => {
    assert.deepEqual(
      decideDelivery({ status: "failed", attempts: MAX_ATTEMPTS, lastAttemptAt: minutesAgo(5) }, now),
      { action: "skip", reason: "exhausted" },
    );
  });

  it("방금 시작한 processing은 다른 실행이 처리 중이므로 건너뛴다", () => {
    assert.deepEqual(
      decideDelivery({ status: "processing", attempts: 1, lastAttemptAt: minutesAgo(1) }, now),
      { action: "skip", reason: "in_progress" },
    );
  });

  it("오래된 processing은 중단된 것으로 보고 이어서 시도한다", () => {
    const stale = new Date(now.getTime() - STALE_PROCESSING_MS - 1000).toISOString();
    assert.deepEqual(
      decideDelivery({ status: "processing", attempts: 1, lastAttemptAt: stale }, now),
      { action: "send", attempt: 2 },
    );
  });

  it("마지막 시도 시각이 없는 processing도 중단된 것으로 본다", () => {
    assert.deepEqual(
      decideDelivery({ status: "processing", attempts: 1, lastAttemptAt: null }, now),
      { action: "send", attempt: 2 },
    );
  });
});

describe("발송 대상", () => {
  const sendAt = weeklySendTime("2026-10-26");
  const base = {
    emailConsent: true,
    consentUpdatedAt: "2026-10-20T00:00:00Z",
    hasChild: true,
    sendAt,
  };

  it("동의·자녀 있음·발송 시각 이전 동의면 대상", () => {
    assert.equal(isEligible(base), true);
  });
  it("동의하지 않았으면 제외", () => {
    assert.equal(isEligible({ ...base, emailConsent: false }), false);
  });
  it("자녀가 없으면 제외", () => {
    assert.equal(isEligible({ ...base, hasChild: false }), false);
  });
  it("발송 시각 이후에 동의했으면 다음 주부터(제외)", () => {
    assert.equal(isEligible({ ...base, consentUpdatedAt: "2026-10-26T10:00:01Z" }), false);
  });
  it("발송 시각 정각에 동의한 경우는 포함", () => {
    assert.equal(isEligible({ ...base, consentUpdatedAt: "2026-10-26T10:00:00Z" }), true);
  });
});

describe("메일 본문", () => {
  const appUrl = "https://example.com";
  const unsubscribeUrl = "https://example.com/unsubscribe?u=u1&t=sig";

  it("질문·일반 링크·수신 설정 링크가 들어가고 로그인 토큰은 없다", () => {
    const mail = buildWeeklyEmail({ questionBody: "요즘 아이가 자주 하는 말은?", hint: "힌트 문장", appUrl, unsubscribeUrl });
    for (const part of [mail.html, mail.text]) {
      assert.ok(part.includes("요즘 아이가 자주 하는 말은?"));
      assert.ok(part.includes("힌트 문장"));
      assert.ok(part.includes("https://example.com/write"));
      assert.ok(part.includes("https://example.com/profile"));
      assert.ok(!/token|code=|access_token|refresh_token/i.test(part));
    }
    assert.equal(mail.subject, "이번 주 질문이 도착했어요");
  });

  it("힌트가 없으면 힌트 문단을 만들지 않는다", () => {
    const mail = buildWeeklyEmail({ questionBody: "질문", hint: null, appUrl, unsubscribeUrl });
    assert.ok(!mail.html.includes("null"));
    assert.ok(!mail.text.includes("null"));
  });

  it("HTML 특수문자는 이스케이프한다", () => {
    const mail = buildWeeklyEmail({ questionBody: `<b>"a" & 'b'</b>`, hint: null, appUrl, unsubscribeUrl });
    assert.ok(!mail.html.includes("<b>"));
    assert.ok(mail.html.includes("&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;"));
    // 텍스트 본문은 원문 그대로
    assert.ok(mail.text.includes(`<b>"a" & 'b'</b>`));
  });

  it("멱등 키는 질문·부모·시도 번호로 만든다", () => {
    assert.equal(idempotencyKey("q1", "u1", 2), "weekly/q1/u1/2");
  });
});
